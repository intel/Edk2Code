
import * as vscode from 'vscode';
import { gConfigAgent, gDebugLog, gPathFind, gWorkspacePath } from '../extension';
import { GrayoutController } from '../grayout';
import { createRange, openTextDocument, split } from '../utils';
import { REGEX_DEFINE as REGEX_DEFINE, REGEX_DSC_SECTION, REGEX_INCLUDE as REGEX_INCLUDE, REGEX_LIBRARY_PATH, REGEX_MODULE_PATH, REGEX_PCD_LINE, REGEX_VAR_USAGE } from "../edkParser/commonParser";
import { UNDEFINED_VARIABLE, WorkspaceDefinitions } from "./definitions";
import * as fs from 'fs';
import path = require('path');
import { ParserFactory, getParser } from '../edkParser/parserFactory';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { EdkSymbolInfLibrary } from '../symbols/infSymbols';
import { DiagnosticManager, EdkDiagnosticCodes } from '../diagnostics';
import { PathFind } from '../pathfind';


const dscSectionTypes = ['defines','packages','buildoptions','skuids','libraryclasses','components','userextensions','defaultstores','pcdsfeatureflag','pcdsfixedatbuild','pcdspatchableinmodule','pcdsdynamicdefault','pcdsdynamichii','pcdsdynamicvpd','pcdsdynamicexdefault','pcdsdynamicexhii','pcdsdynamicexvpd'];

interface Pcd {
    name:string;
    value:string
    position:vscode.Location
}

export class Property{
    sectionType:string;
    arch:string;
    moduleType:string;

    constructor(sectionType:string, arch:string, moduleType:string){
        this.sectionType = sectionType.toLocaleLowerCase();
        this.arch = arch.toLocaleLowerCase();
        this.moduleType = moduleType.toLocaleLowerCase();
    }

}

export class InfDsc{
    path: string;
    location:vscode.Location;
    properties: Property[];
    text:string;
    parent: string|undefined;
    constructor(filePath:string, location:vscode.Location, parent:string, line:string){
        this.path = filePath.replaceAll("\\",path.sep).replaceAll("/",path.sep);
        this.location = location;
        this.properties = [];
        this.text = line;

        if(parent.match(/\.inf$/gi)){
            // Parent its a file
            this.parent = parent.replaceAll("\\",path.sep).replaceAll("/",path.sep);;
        }else{
            // Parent its a section
            this.parent = undefined;
            let props = parent.split(",");
            for (const p of props) {
                let [sectionType,arch,moduleType] = split(p.toLowerCase(),".",3,"common");
                let property = new Property(sectionType, arch, moduleType);
                this.properties.push(property);
            }
        }
        
    }

    toString(): string {
        return `${this.path}:${this.location.range.start.line} - ${JSON.stringify(this.properties)} }`;
    }


    compareArch(other:InfDsc){
        for (const thisProperty of this.properties) {
            for (const otherProperty of other.properties) {
                if(otherProperty.arch === thisProperty.arch){
                    return true;
                }
            }
        }
        return false;
    }

    compareArchStr(arch:string){
        arch = arch.toLowerCase();
        for (const thisProperty of this.properties) {
            if(arch === thisProperty.arch){
                return true;
            }
        }
        return false;
    }

    compareLibSectionType(other:InfDsc){
        for (const thisProperty of this.properties) {
            for (const otherProperty of other.properties) {
                if(otherProperty.sectionType === thisProperty.sectionType){
                    return true;
                }
            }
        }
        return false;
    }

    compareLibSectionTypeStr(sectionType:string){
        sectionType = sectionType.toLowerCase();
        for (const thisProperty of this.properties) {
            if(sectionType === thisProperty.sectionType){
                return true;
            }
        }
        return false;
    }

    compareModuleType(other:InfDsc){
        for (const thisProperty of this.properties) {
            for (const otherProperty of other.properties) {
                if(otherProperty.moduleType === thisProperty.moduleType){
                    return true;
                }
            }
        }
        return false;
    }

    compareModuleTypeStr(moduleType:string){
        moduleType = moduleType.toLowerCase();
        for (const thisProperty of this.properties) {
            if(moduleType === thisProperty.moduleType){
                return true;
            }
        }
        return false;
    }
}




export class EdkWorkspaces {
    
    private static instance: EdkWorkspaces;
    private _workspaces: EdkWorkspace[] = [];
    public get workspaces(): EdkWorkspace[] {
        return this._workspaces;
    }
    public set workspaces(value: EdkWorkspace[]) {
        this._workspaces = value;
    }

    isConfigured(){
        if(this.workspaces.length > 0){
            return true;
        }
        return false;
    }

    public static getInstance() {
        if (!EdkWorkspaces.instance) {
            EdkWorkspaces.instance = new EdkWorkspaces();
        }
        return EdkWorkspaces.instance;
    }

    constructor() {

    }

    async getDefinition(uri: vscode.Uri, word: string) {
        for (const workspace of this.workspaces) {
            let isInUse = await workspace.isFileInUse(uri);
            if(isInUse === true){
                return workspace.getDefinitions().get(word);
            }
        }
        return undefined;
    }

    async replaceDefines(uri: vscode.Uri, text: string) {
        for (const workspace of this.workspaces) {
            let isInUse = await workspace.isFileInUse(uri);
            if(isInUse === true){
                return workspace.replaceDefine(text);
            }
        }
        return text;
    }

    async getLib(location:vscode.Location){
        let libs:InfDsc[] = [];
        for (const workspace of this.workspaces) {
            let result = await workspace.getLib(location);
            if(result){
                libs.push(result);
            }
        }
        return libs;
    }



    async getWorkspace(uri:vscode.Uri){
        let wps = [];
        for (const workspace of this.workspaces) {
            let result = await workspace.isFileInUse(uri);
            if(result === true){
                wps.push(workspace);
            }
        }
        return wps;
    }

    async isFileInUse(uri: vscode.Uri) {
        let isUndefined = true;
        for (const workspace of this.workspaces) {
            let result = await workspace.isFileInUse(uri);
            if(result === true){
                return true;
            }
            if(result === false){
                isUndefined = false;
                continue;
            }
        }
        if(isUndefined){return undefined;}
        return false;
    }

    async loadConfig() {
        this.workspaces = [];
        gDebugLog.verbose("Loading Configuration");
        let dscPaths = gConfigAgent.getBuildDscPaths();
        gDebugLog.verbose(`dscPaths = ${dscPaths}`);
        for (const dscPath of dscPaths) {
            let dscDocument = await openTextDocument(vscode.Uri.file(path.join(gWorkspacePath, dscPath)));
            let edkWorkspace = new EdkWorkspace(dscDocument);
            await edkWorkspace.proccessWorkspace();
            this.workspaces.push(edkWorkspace);
            gDebugLog.info(`Workspace loaded: ${dscDocument.fileName}`);
        }
    }
}


export class EdkWorkspace {






    id:number = 0;
    mainDsc: vscode.Uri;
    platformName: string | undefined = undefined;
    flashDefinitionDocument: vscode.TextDocument | undefined = undefined;

    private workInProgress: boolean = false;
    private processComplete: boolean = false;

    private conditionalStack: boolean[] = [];
    private lastConditionalPop = true;
    private sectionsStack: string[] = [];
    private parsedDocuments: Map<string, vscode.Range[]> = new Map();

    private defines: WorkspaceDefinitions = new WorkspaceDefinitions();
    definesFdf: WorkspaceDefinitions = new WorkspaceDefinitions();
    private pcdDefinitions: Map<string,Map<string,Pcd>> = new Map();

    private grayoutControllers:Map<vscode.Uri,GrayoutController>;

    private _filesLibraries: InfDsc[] = [];
    public get filesLibraries(): InfDsc[] {
        return this._filesLibraries;
    }
    public set filesLibraries(value: InfDsc[]) {
        this._filesLibraries = value;
    }
    private _filesModules: InfDsc[] = [];
    public get filesModules(): InfDsc[] {
        return this._filesModules;
    }
    public set filesModules(value: InfDsc[]) {
        this._filesModules = value;
    }
    private _filesDsc: vscode.TextDocument[] = [];
    public get filesDsc(): vscode.TextDocument[] {
        return this._filesDsc;
    }
    public set filesDsc(value: vscode.TextDocument[]) {
        this._filesDsc = value;
    }
    private _filesFdf: vscode.TextDocument[] = [];
    public get filesFdf(): vscode.TextDocument[] {
        return this._filesFdf;
    }
    public set filesFdf(value: vscode.TextDocument[]) {
        this._filesFdf = value;
    }

    public dscList(){
        return this.filesDsc.map(x=>x.uri.fsPath);
    }

    public fdfList(){
        return this.filesFdf.map(x=>x.uri.fsPath);
    }

    public getFilesList(){
        let fileList = [...this.dscList(),...this.fdfList(),...this.filesModules.map(x=>x.path),...this.filesLibraries.map(x=>x.path)];
        return fileList;
    }


    constructor(document: vscode.TextDocument) {
        this.mainDsc = document.uri;
        // generate random number
        this.id = Math.floor(Math.random() * 100000000000000);
        this.grayoutControllers = new Map();
    }



    async proccessWorkspace() {
        if (this.workInProgress) {
            return false;
        }
        // reset conditional stack
        this.workInProgress = true;
        gDebugLog.verbose(`Start finding defines in ${this.mainDsc.fsPath}`);
        this.conditionalStack = [];

        this.defines.resetDefines();
        this.definesFdf.resetDefines();

        this.filesLibraries = [];
        this.filesModules = [];
        this.filesDsc = [];

        DiagnosticManager.clearProblems();

        this.parsedDocuments = new Map();
        let mainDscDocument = await vscode.workspace.openTextDocument(this.mainDsc);
        await this._proccessDsc(mainDscDocument);
        this.workInProgress = false;
        gDebugLog.verbose("Finding done.");

        // Populate workspace definitions
        this.platformName = this.defines.getDefinition("PLATFORM_NAME") || undefined;
        let flashDefinitionString = this.defines.getDefinition("FLASH_DEFINITION") || undefined;
        if (flashDefinitionString) {
            let flashDefinitionPath = await gPathFind.findPath(flashDefinitionString);
            if(flashDefinitionPath.length>0){
                this.flashDefinitionDocument = await openTextDocument(flashDefinitionPath[0].uri);
            }
        }

        await this.findDefinesFdf();

        this.processComplete = true;
        return true;
    }

    async getInfReference(uri: vscode.Uri) {
        const workspaceBase = vscode.Uri.file(gWorkspacePath);
        let fileName = path.basename(uri.fsPath);
        let folder = vscode.Uri.file(path.dirname(uri.fsPath));
        
        let returns:vscode.Location[] = [];
        let found = false;
        while(folder.fsPath !== workspaceBase.fsPath){
            let files = fs.readdirSync(folder.fsPath);
            for (const file of files) {
                if (file.match(/\.inf$/gi)) {
                    // open textdocument from file
                    let filePath = path.join(folder.fsPath, file);
                    let infDocument = await openTextDocument(vscode.Uri.file(filePath));
                    
                    if(!await this.isFileInUse(infDocument.uri)){continue;}
                    let lineIndex = 0;
                    for(const line of infDocument.getText().split(/\r?\n/g)){
                        let m = line.match(new RegExp(`\\b${fileName}\\b`,"gim"));
                        if(m){
                            found = true;
                            returns.push(new vscode.Location(infDocument.uri, createRange(lineIndex,lineIndex,0)));
                        }
                        lineIndex++;
                    }
                }
                if(found){
                    return returns;
                }
            }
            folder = vscode.Uri.file(path.dirname(folder.fsPath));
        }
        
        return returns;
    }

    getDefinitions() {
        return this.defines.getDefinitions();
    }

    getDefinition(key:string){
        return this.defines.getDefinition(key);
    }

    getDefinitionLocation(key:string){
        return this.defines.getDefinitionLocation(key);
    }

    replaceDefine(text: string) {
        return this.defines.replaceDefines(text);
    }

    getPcds(namespace: any) {
        return this.pcdDefinitions.get(namespace);
    }

    private async _proccessDsc(document: vscode.TextDocument) {
        gDebugLog.verbose(`findDefines: ${document.fileName}`);

        // Add document to inactiveLines
        if (this.isDocumentInIndex(document)) {
            gDebugLog.warning(`findDefines: ${document.fileName} already in inactiveLines`);
            return;
        }

        this.parsedDocuments.set(document.uri.fsPath, []);
        this.filesDsc.push(document);

        let text = document.getText().split(/\r?\n/);
        let lineIndex = -1;

        let isRangeActive = false;
        let unuseRangeStart = 0;

        gDebugLog.verbose(`# Parsing DSC Document: ${document.uri.fsPath}`);
        for (let line of text) {
            
            lineIndex++;
            gDebugLog.verbose(`\t\t${lineIndex}: ${line}`);
            line = line.trim();
            // Skip comments
            if(line.startsWith("#")){continue;}

            let rawLine = line;
            // replace definitions
            line = this.defines.replaceDefines(line);

            // Check PCDS
            // find PCDS variables
            if(line.match(REGEX_PCD_LINE)){
                let [fullPcd, pcdValue] = split(line,"|",2);
                pcdValue = pcdValue.split("|")[0].trim();
                if(pcdValue.startsWith('L"')){
                    pcdValue = pcdValue.slice(1);
                }
                let [pcdNamespace, pcdName] = split(fullPcd, ".", 2);
                if(!this.pcdDefinitions.has(pcdNamespace)){
                    this.pcdDefinitions.set(pcdNamespace, new Map());
                }
                this.pcdDefinitions.get(pcdNamespace)?.set(
                    pcdName,
                    {
                        name:pcdName,
                        value:pcdValue, 
                        position: new vscode.Location(document.uri, new vscode.Position(lineIndex, 0))}
                    );
                continue;
            }

            line = this.replacePcds(line);

            let conditinalResult = this.processConditional(line);
            if(conditinalResult !==undefined){
                DiagnosticManager.reportProblem(document.uri, lineIndex, conditinalResult,vscode.DiagnosticSeverity.Error);
            }

            if (!this.isInActiveCode()) {
                if (!isRangeActive) {
                    isRangeActive = true;
                    unuseRangeStart = lineIndex;
                }
                continue;
            }

            if (isRangeActive === true) {
                isRangeActive = false;
                let arr = this.parsedDocuments.get(document.uri.fsPath);
                if (arr) {
                    let lineIndexEnd = lineIndex-1;
                    
                    // check if as special condition to match false blocks until it the !endif label.
                    if(line === "!endif" && this.lastConditionalPop === false){
                        lineIndexEnd = lineIndex;
                    }

                    arr.push(new vscode.Range(new vscode.Position(unuseRangeStart, 0), new vscode.Position(lineIndexEnd, 0)));
                } else {
                    gDebugLog.error(`findDefines: ${document.fileName} has no range for unuseRange`);
                }
            }

            let match = line.match(REGEX_DSC_SECTION);
            if (match) {
                const sectionType = match[0].split(".")[0];
                if(!dscSectionTypes.includes(sectionType.toLowerCase())){
                    DiagnosticManager.warning(document.uri,lineIndex,EdkDiagnosticCodes.unknownSectionType, sectionType);
                }
                this.sectionsStack = [match[0]];
                continue;
            }

            if (line.match(REGEX_DEFINE)) {
                let key = line.replace(/define/gi, "").trim();
                key = split(key, "=", 2)[0].trim();
                let value = split(line, "=", 2)[1].trim();
                if (value.includes(`$(${key})`)) {
                    gDebugLog.info(`Circular define: ${key}: ${value}`);
                } else {
                    this.defines.setDefinition(key, value, new vscode.Location(document.uri, new vscode.Position(lineIndex,0)));
                }
                continue;
            }

            if (line.match(REGEX_INCLUDE)) {

                let value = line.replace(/!include/gi, "").trim();
                let location = await gPathFind.findPath(value, document.uri.fsPath);

                if(location.length > 0){
                    let includedDocument = await openTextDocument(location[0].uri);
                    await this._proccessDsc(includedDocument);
                }

                
                continue;
            }




            // Libraries
            match = line.match(REGEX_LIBRARY_PATH);
            if (match) {
                // get matched string 
                let filePath = match[0].trim();
                let results = await gPathFind.findPath(filePath, document.uri.fsPath);
                if(results.length === 0){
                    DiagnosticManager.error(document.uri,lineIndex,EdkDiagnosticCodes.missingPath, filePath);
                }
                let inf = new InfDsc(filePath, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)), this.sectionsStack[this.sectionsStack.length - 1], line);
                this.filesLibraries.push(inf);
                continue;
            }

            // Modules
            match = line.match(REGEX_MODULE_PATH);
            if (match) {

                // get matched string 
                let filePath = match[0].trim();
                
                let inf = new InfDsc(filePath, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)), this.sectionsStack[0], line);
                this.sectionsStack.push(filePath);
                this.filesModules.push(inf);
                continue;
            }
            
        }

    }

    private getLangId(uri:vscode.Uri){
        if(uri.fsPath.toLowerCase().endsWith(".dsc") || uri.fsPath.toLowerCase().endsWith(".dsc.inc")){
            return "edk2_dsc";
        }
        if(uri.fsPath.toLowerCase().endsWith(".fdf") || uri.fsPath.toLowerCase().endsWith(".fdf.inc")){
            return "edk2_fdf";
        }

        if(uri.fsPath.toLowerCase().endsWith(".dec") || uri.fsPath.toLowerCase().endsWith(".dec.inc")){
            return "edk2_dec";
        }
        if(uri.fsPath.toLowerCase().endsWith(".c") || uri.fsPath.toLowerCase().endsWith(".h")){
            return "c";
        }
        if(uri.fsPath.toLowerCase().endsWith(".inf")){
            return "edk2_inf";
        }

        return undefined;
    }

    replacePcds(line:string){
        // replace PCDS
        let pcds = line.match(/(?:[\w\d\[\]]+\.)+[\w\d\[\]]+/gi);
        if(pcds){
            for (const pcd of pcds) {
                let [namespace,name] = split(pcd,".",2);
                let defPcd = this.pcdDefinitions.get(namespace);
                if(defPcd){
                    let foundPcd = defPcd.get(name);
                    if(foundPcd){
                        line = line.replaceAll(pcd,foundPcd.value);
                    }
                }

            }
        }
        return line;
    }


    async isFileInUse(uri: vscode.Uri) {

        if (this.processComplete) {
            
            switch (this.getLangId(uri)) {
                case "edk2_dsc":
                    for (const dsc of this.filesDsc) {
                        
                        if(uri.fsPath === dsc.fileName) {
                            return true;
                        }
                    }
                    return false;
                    
                case "edk2_fdf":
                    for (const fdf of this.filesFdf) {
                        if(uri.fsPath === fdf.fileName){
                            return true;
                        }
                    }
                    break;
                case "edk2_dec":
                    break;
                case "edk2_inf":
                    for (const mods of this.filesModules) {
                        if(uri.fsPath.includes(mods.path)){
                            return true;
                        }
                    }
                    for (const lib of this.filesLibraries) {
                        if(uri.fsPath.includes(lib.path)){
                            return true;
                        }
                    }
                    return false;
                    
                case "c":
                    let relativeInf:string[] = [];
                    let cDirName = path.dirname(uri.fsPath);
                    for (const mods of this.filesModules) {
                        let modDir = path.dirname(mods.path);
                        if(cDirName.includes(modDir)){
                            relativeInf.push(mods.path);
                        }
                    }
                    for (const lib of this.filesLibraries) {
                        let libDir = path.dirname(lib.path);
                        if(cDirName.includes(libDir)){
                            relativeInf.push(lib.path);
                        }
                    }
                    for (const inf of relativeInf) {
                        let location = await gPathFind.findPath(inf);
                        
                        if (location.length === 0){continue;}

                        let parser = await getParser(location[0].uri);
                        if (parser) {
                            let sources = parser.getSymbolsType(Edk2SymbolType.infSource);
                            for (const source of sources) {
                                let location = await gPathFind.findPath(await source.getValue());
                                if(location[0].uri.fsPath === uri.fsPath){
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
            }
        }
        return undefined;
    }

    async getIncludeReference(uri:vscode.Uri){
        let includePathsFiles:string[] = [];
        let retLocations:vscode.Location[] = [];
        for (const p  of this.filesDsc) {
            includePathsFiles.push(p.fileName);
        }
        for (const p  of this.filesFdf) {
            includePathsFiles.push(p.fileName);
        }
        for (const includedFile of includePathsFiles) {
            let filePath = await gPathFind.findPath(includedFile);
            if(filePath.length){
                let document = await openTextDocument(filePath[0].uri);
                let lineIndex = -1;
                for (let line of document.getText().split(/\r?\n/)) {
                    lineIndex ++;
                    if(line.match(/\!include\s/gi)){
                        line = this.defines.replaceDefines(line);
                        let value = line.replace(/!include/gi, "").trim();
                        let location = await gPathFind.findPath(value);
                        if (!location.length){continue;}
                        if(location[0].uri.fsPath === uri.fsPath){
                            retLocations.push(new vscode.Location(document.uri, createRange(lineIndex,lineIndex,0)));
                        }
                    }
                }
            }
        }
        return retLocations;
    }

    isDocumentInIndex(document: vscode.TextDocument): boolean {
        for (const doc of this.parsedDocuments.keys()) {
            if(doc === document.fileName) {
                return true;
            }
        }
        return false;
    }

    getGrayoutRange(document: vscode.TextDocument): vscode.Range[] {
        return this.parsedDocuments.get(document.uri.fsPath) || [];
    }

    async grayoutDocument(document: vscode.TextDocument) {

        if (this.processComplete) {
            // check if document is in index documents
            if (this.isDocumentInIndex(document)) {
                let grayoutRange = this.getGrayoutRange(document);
                let grayoutController = this.grayoutControllers.get(document.uri);
                if(!grayoutController){
                    grayoutController = new GrayoutController(document, grayoutRange);
                    this.grayoutControllers.set(document.uri, grayoutController);
                }
                grayoutController.grayoutRange(grayoutRange);
                // grayoutController.doGrayOut();
                return;
            }
        }
    }

    async findDefinesFdf() {
        if (this.workInProgress) {
            return false;
        }
        // reset conditional stack
        this.workInProgress = true;
        gDebugLog.verbose(`Start finding defines fdf`);
        this.conditionalStack = [];
        
        if (this.flashDefinitionDocument) {
            if (!this.isDocumentInIndex(this.flashDefinitionDocument)) {
                this.filesFdf = [];
                await this._proccessFdf(this.flashDefinitionDocument);
            }
        }
        this.workInProgress = false;
        gDebugLog.verbose("Finding fdf done.");
        return true;
    }


    // TODO: Unifiy this function with _proccessDsc
    private async _proccessFdf(document: vscode.TextDocument) {
        gDebugLog.verbose(`findDefines Fdf: ${document.fileName}`);

        // Add document to inactiveLines
        if (this.isDocumentInIndex(document)) {
            gDebugLog.warning(`findDefines Fdf: ${document.fileName} already in inactiveLines`);
            return;
        }
        this.parsedDocuments.set(document.uri.fsPath, []);
        this.filesFdf.push(document);
        let text = document.getText().split(/\r?\n/);
        let lineIndex = -1;


        let isInUnuseRange = false;
        let unuseRangeStart = 0;

        for (let line of text) {
            lineIndex++;
            // Skip comments
            line = line.trim();
            if(line.startsWith("#")){continue;}

            // replace definitions
            let originalLine = line;
            line = this.definesFdf.replaceDefines(line);
            if(line.includes(UNDEFINED_VARIABLE)){
                line = this.defines.replaceDefines(originalLine);
            }

            // find PCDS variables
            if(line.match(REGEX_PCD_LINE)){
                let [fullPcd, pcdValue] = split(line,"|",2);
                pcdValue = pcdValue.split("|")[0].trim();
                if(pcdValue.startsWith('L"')){
                    pcdValue = pcdValue.slice(1);
                }
                let [pcdNamespace, pcdName] = split(fullPcd, ".", 2);
                if(!this.pcdDefinitions.has(pcdNamespace)){
                    this.pcdDefinitions.set(pcdNamespace, new Map());
                }
                this.pcdDefinitions.get(pcdNamespace)?.set(
                    pcdName,
                    {
                        name:pcdName,
                        value:pcdValue, 
                        position: new vscode.Location(document.uri, new vscode.Position(lineIndex, 0))}
                    );
                continue;
            }

            line = this.replacePcds(line);

            let conditinalResult = this.processConditional(line);
            if(conditinalResult !==undefined){
                DiagnosticManager.error(document.uri, lineIndex, EdkDiagnosticCodes.syntaxStatement, conditinalResult);
            }
            
            if (!this.isInActiveCode()) {
                if (!isInUnuseRange) {
                    isInUnuseRange = true;
                    unuseRangeStart = lineIndex;
                }
                continue;
            }

            if (isInUnuseRange === true) {
                isInUnuseRange = false;
                let arr = this.parsedDocuments.get(document.uri.fsPath);
                if (arr) {
                    arr.push(new vscode.Range(new vscode.Position(unuseRangeStart, 0), new vscode.Position(lineIndex, 0)));
                } else {
                    gDebugLog.error(`findDefines: ${document.fileName} has no range for unuseRange`);
                }
            }

            if (line.match(/^define\s+(?:(?![=\!]).)*=.*/gi)) {
                let key = line.replace(/define/gi, "").trim();
                key = split(key, "=", 2)[0].trim();
                let value = split(line, "=", 2)[1].trim();
                if (value.includes(`$(${key})`)) {
                    gDebugLog.info(`Circular define: ${key}: ${value}`);
                } else {
                    this.definesFdf.setDefinition(key, value, new vscode.Location(document.uri, new vscode.Position(lineIndex,0)));
                }
                continue;
            }

            if (line.match(REGEX_INCLUDE)) {

                let value = line.replace(/!include/gi, "").trim();
                let location = await gPathFind.findPath(value);
                if(location.length > 0){
                    let includedDocument = await openTextDocument(location[0].uri);
                    this.filesFdf.push(includedDocument);
                    await this._proccessFdf(includedDocument);
                }
                continue;
            }
        }
        gDebugLog.verbose(`findDefines End: ${document.fileName}`);


    }



    async fdfPostProcces(document: vscode.TextDocument) {
        // preprocess fdf files
        if (this.processComplete) {
            let isComplete = await this.findDefinesFdf();
            if (isComplete) {
                // check if document is in index documents
                if (this.isDocumentInIndex(document)) {
                    let grayoutRange = this.getGrayoutRange(document);
                    let grayoutController = new GrayoutController(document, grayoutRange);
                    grayoutController.doGrayOut();
                    return;
                }
            }
        }
    }


    private processConditional(text: string):string|undefined {
        let originalText = text;
        text = text.replaceAll(REGEX_VAR_USAGE, `"${UNDEFINED_VARIABLE}"`);
        // text = text.replaceAll(UNDEFINED_VARIABLE, '"???"');

        let tokens = [];
        if (text.includes('"')) {
            tokens = text.split('"');
            if(tokens.length%2 !== 1){ // check if there is an open string
                return `Open string: ${originalText}`;
            }
            tokens = [...tokens[0].trim().split(" "), ...[tokens[1].trim()], ...tokens[2].trim().split(" ")];
        } else {
            tokens = text.trim().split(" ");
        }
        tokens = tokens.filter(x => { return x.length > 0; });
        if (tokens.length === 0) {
            return;
        }
        if (tokens[0].toLowerCase() === "!if") {
            this.pushConditional(this.evaluateConditional(text));
            return;
        } else if (tokens[0].toLowerCase() === "!elseif") {
            let v = this.popConditional();
            this.pushConditional(this.evaluateConditional(text));
            return;
        }
        else if (tokens[0].toLowerCase() === "!ifdef") {
            if (tokens.length !== 2) {
                
               return `!ifdef conditionals need to be formatted correctly (!ifdef [definition]): ${text}`;
            }
            this.pushConditional((tokens[1] !== UNDEFINED_VARIABLE));
            return;
        }
        else if (tokens[0].toLowerCase() === "!ifndef") {
            if (tokens.length !== 2) {
               return `!ifndef conditionals need to be formatted correctly (!ifndef [definition]): ${text}`;
            }
            this.pushConditional((tokens[1] === UNDEFINED_VARIABLE));
            return;
        }
        else if (tokens[0].toLowerCase() === "!else") {
            if (tokens.length !== 1) {
               return `!else conditional has additional tokens: ${text}`;
            }
            let v = this.popConditional();
            this.pushConditional(!v);
            return;
        }

        else if (tokens[0].toLowerCase() === "!endif") {
            if (tokens.length !== 1) {
               return `!endif conditional has additional tokens: ${text}`;
            }
            this.popConditional();
            return;
        }
        return;
    }



    private pushConditional(v: boolean) {
        this.conditionalStack.push(v);
    }

    private popConditional() {
        if (this.conditionalStack.length > 0) {
            this.lastConditionalPop = this.conditionalStack[this.conditionalStack.length -1];
            return this.conditionalStack.pop();
        }
    }

    private getLastConditional(){
        return this.conditionalStack[this.conditionalStack.length -1];
    }


    private evaluateConditional(text: string): any {


        let data = text.replaceAll(/(?<![\!"])\b(\w+)\b(?!")/gi, '"$1"'); // convert words to string
        data = data.replace(/\!\w+/gi, "");  // remove conditional keyword


        while (data.match(/"in"/gi)) {
            let inIndex = data.search(/"in"/i);
            let last = data.slice(inIndex + '"in"'.length).replace(/("\w+")/i, '$1)').trim();
            let beging = data.slice(0, inIndex).trim();
            data = beging + ".includes(" + last;
        }

        data = data.replaceAll(/"true"/gi, "true"); // replace booleans
        data = data.replaceAll(/"false"/gi, "false");
        data = data.replaceAll(/"and"/gi, "&&");
        data = data.replaceAll(/"or"/gi, "||");
        data = data.replace(/"not"\s/gi, "!");

        let result = false;
        try {
            if(data.includes(UNDEFINED_VARIABLE)){
                return false;
            }
            result = eval(data);
        } catch (error) {
            gDebugLog.error(`Evaluation problem ${text}`);
            return false;
        }

        return result;
    }

    private isInActiveCode() {
        var ret = true;
        for (const a of this.conditionalStack) {
            if (!a) {
                ret = false;
                break;
            }
        }
        return ret;
    }

    

    async getLib(location: vscode.Location) {
        for (const lib of this.filesLibraries) {
            if(lib.location.uri.fsPath === location.uri.fsPath){
                if(lib.location.range.start.line === location.range.start.line){
                    return lib;
                }
            }
        }    
    }


    // Helper functions
    /**
     * Looks for DSC files in the workspace to find where
     * The INF file was declared
     * @param uri uri file for an INF file
     * @returns infDsc objects
     */
    async getDscDeclaration(uri:vscode.Uri) {
    
        let thisDocument = await openTextDocument(uri);
        if(thisDocument.languageId !== "edk2_inf"){
            gDebugLog.error(`getDscDeclaration: ${uri.fsPath} is not a INF file`);
            return [];
        }

        let isLibrary = false;
        if(thisDocument.getText().match(/^\s*library_class\s*=/gmi)){
            isLibrary = true;
        }

        let dscInfs: InfDsc[] = [];
  
            let entryList = this.filesModules;
            if(isLibrary){
                entryList = this.filesLibraries;
            }
            for (const entry of entryList) {
                let entryPath = await gPathFind.findPath(entry.path);
                if(entryPath.length){
                    if(entryPath[0].uri.fsPath === uri.fsPath){
                        dscInfs.push(entry);
                    }
                }
            }

        return dscInfs;
    }

    /**
     * Looks for DSC libraries in the workspace to find where
     * The library was declared
     * @param libName String with the name of the library to find
     * @returns INF files locations
     */
    async getLibDefinition(libName:string) {
    
        let locations: vscode.Location[] = [];

            for (const lib of this.filesLibraries) {
                let libNameDsc = split(lib.text, "|", 2)[0].trim();
                if(libNameDsc.toLowerCase() === libName.toLowerCase()){
                    let libLocation = await gPathFind.findPath(lib.path);
                    locations = locations.concat(libLocation);
                }
            }

        return locations;
    }



    /**
     * Looks for DSC libraries in the workspace to find where
     * The library was declared
     * @param libName String with the name of the library to find
     * @returns InfDsc objects where the libName was declared
     */
    async getLibDeclaration(libName:string) {
    
        let locations: InfDsc[] = [];

            for (const lib of this.filesLibraries) {
                let libNameDsc = split(lib.text, "|", 2)[0].trim();
                if(libNameDsc.toLowerCase() === libName.toLowerCase()){
                    locations = locations.concat(lib);
                }
            }

        return locations;
    }


    /**
     * Retrieves the library declaration module for a given file and library name.
     * 
     * This function performs the following steps:
     * 1. Checks if the library is overwritten in the module definition.
     * 2. Retrieves the MODULE_TYPE from the original INF file.
     * 3. Gets properties from the module URI.
     * 4. Checks all module declarations to match library classes with module properties.
     * 
     * @param fileUri - The URI of the INF where the library is being used.
     * @param libName - The name of the library to be found.
     * 
     * @returns A promise that resolves to an array of `InfDsc` objects representing the libraries that match the module properties.
     * 
     * @throws Will throw an error if the file cannot be read or if there are issues processing the library declarations.
     */
    async getLibDeclarationModule(fileUri:vscode.Uri,libName:string, ) {
    
        let dscLibDeclarations: InfDsc[] = await this.getLibDeclaration(libName);
        
        // Check if library is overwritten in module definition
        // 1. <LibraryClasses> associated with the INF file in the [Components] section
        for (const library of dscLibDeclarations) {
            if(library.parent === undefined){continue;}
            let parentPaths = await gPathFind.findPath(library.parent);
            for (const parentLocation of parentPaths) {
                if(parentLocation.uri.fsPath === fileUri.fsPath){
                    return [library];
                }
            }
        }

        // Return libraries that match module properties
        
        // Get MODULE_TYPE from original INF file
        let infText = (await vscode.workspace.openTextDocument(fileUri)).getText();
        let m = /MODULE_TYPE\s*=\s*\b(\w*)\b/gi.exec(infText);
        let moduleType = "common";
        if(m!==null){
            moduleType = m[1].toLocaleLowerCase();
        }

        //Get properties from moduleUri
        let modulesDeclarations = await this.getDscDeclaration(fileUri);
        let currentAccuracy = 0;
        let locations:InfDsc[] = [];

        // Check all module declarations.
        for (const module of modulesDeclarations) {
            let locationFound = false;

            // Module contains the properties obtained from DSC file.
            // Here overwrite module type with the actual definition of the INF file
            for (const property of module.properties) {
                property.moduleType = moduleType;
            }

            for (const library of dscLibDeclarations) {
                // 2. [LibraryClasses.$(Arch).$(MODULE_TYPE), LibraryClasses.$(Arch).$(MODULE_TYPE)]
                // 3. [LibraryClasses.$(Arch).$(MODULE_TYPE)]
                console.log(`${library.toString()} === ${module.toString()}`);
                if(library.compareArch(module) && library.compareModuleType(module)){
                    console.log("equal");
                    locationFound = true;
                    locations.push(library);
                    break;
                }
            }
            if(locationFound){continue;}

            for (const library of dscLibDeclarations) {
                // 4. [LibraryClasses.common.$(MODULE_TYPE)]
                if(library.compareArchStr("common") && library.compareModuleType(module)){
                    locationFound = true;
                    locations.push(library);
                    break;
                }
            }
            if(locationFound){continue;}

            for (const library of dscLibDeclarations) {
                // 5. [LibraryClasses.$(Arch)]
                if(library.compareArch(module)){
                    locationFound = true;
                    locations.push(library);
                    break;
                }
            }
            if(locationFound){continue;}

            for (const library of dscLibDeclarations) {
                // 6. [LibraryClasses.common] or [LibraryClasses]
                if(library.compareArchStr("common")){
                    locationFound = true;
                    locations.push(library);
                    break;
                }
            }
            if(locationFound){continue;}
        }
        return locations;


    }


}