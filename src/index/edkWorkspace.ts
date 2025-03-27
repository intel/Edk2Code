
import * as vscode from 'vscode';
import { gCompileCommands, gConfigAgent, gDebugLog, gMapFileManager, gPathFind, gWorkspacePath } from '../extension';
import { GrayoutController } from '../grayout';
import { createRange, openTextDocument, pathCompare, split } from '../utils';
import { REGEX_DEFINE as REGEX_DEFINE, REGEX_DSC_SECTION, REGEX_INCLUDE as REGEX_INCLUDE, REGEX_LIBRARY_PATH, REGEX_MODULE_PATH, REGEX_PCD_LINE, REGEX_VAR_USAGE } from "../edkParser/commonParser";
import { UNDEFINED_VARIABLE, WorkspaceDefinitions } from "./definitions";
import * as fs from 'fs';
import path = require('path');
import { ParserFactory, getParser } from '../edkParser/parserFactory';
import { Edk2SymbolType } from '../symbols/symbolsType';
import { EdkSymbolInfLibrary } from '../symbols/infSymbols';
import { DiagnosticManager, EdkDiagnosticCodes } from '../diagnostics';
import { PathFind } from '../pathfind';

const OPERATORS = {
    'or': { precedence: 1, fn: (x: boolean, y: boolean) => x || y },
    'OR': { precedence: 1, fn: (x: boolean, y: boolean) => x || y },
    '||': { precedence: 1, fn: (x: boolean, y: boolean) => x || y },
    'and': { precedence: 2, fn: (x: boolean, y: boolean) => x && y },
    'AND': { precedence: 2, fn: (x: boolean, y: boolean) => x && y },
    '&&': { precedence: 2, fn: (x: boolean, y: boolean) => x && y },
    '|': { precedence: 3, fn: (x: number, y: number) => x | y },
    '^': { precedence: 4, fn: (x: number, y: number) => x ^ y },
    '&': { precedence: 5, fn: (x: number, y: number) => x & y },
    '==': { precedence: 6, fn: (x: any, y: any) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x === y },
    '!=': { precedence: 6, fn: (x: any, y: any) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x !== y },
    'EQ': { precedence: 6, fn: (x: any, y: any) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x === y },
    'NE': { precedence: 6, fn: (x: any, y: any) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x !== y },
    '<=': { precedence: 7, fn: (x: number, y: number) => x <= y },
    '>=': { precedence: 7, fn: (x: number, y: number) => x >= y },
    '<': { precedence: 7, fn: (x: number, y: number) => x < y },
    '>': { precedence: 7, fn: (x: number, y: number) => x > y },
    '+': { precedence: 8, fn: (x: number, y: number) => x + y },
    '-': { precedence: 8, fn: (x: number, y: number) => x - y },
    '*': { precedence: 9, fn: (x: number, y: number) => x * y },
    '/': { precedence: 9, fn: (x: number, y: number) => x / y },
    '%': { precedence: 9, fn: (x: number, y: number) => x % y },
    '!': { precedence: 10, fn: (y:any, x: boolean) => !x },
    'not': { precedence: 10, fn: (y:any, x: boolean) => !x },
    'NOT': { precedence: 10, fn: (y:any, x: boolean) => !x },
    '~': { precedence: 10, fn: (y:any, x: number) => ~x },
    '<<': { precedence: 11, fn: (x: number, y: number) => x << y },
    '>>': { precedence: 11, fn: (x: number, y: number) => x >> y },
    'in': { precedence: 12, fn: (x: string, y: string) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x.includes(y) },
    'IN': { precedence: 12, fn: (x: string, y: string) => (x===UNDEFINED_VARIABLE||y===UNDEFINED_VARIABLE)?false:x.includes(y) },
};



const dscSectionTypes = ['defines','packages','buildoptions','skuids','libraryclasses','components','userextensions','defaultstores','pcdsfeatureflag','pcdsfixedatbuild','pcdspatchableinmodule','pcdsdynamicdefault','pcdsdynamichii','pcdsdynamicvpd','pcdsdynamicexdefault','pcdsdynamicexhii','pcdsdynamicexvpd'];

type ConditionBlock = {
    active: boolean;      // Whether the block is active or not
    satisfied: boolean;   // Whether the condition has been satisfied
  };

type ConditonOpenBlock = {
    uri:vscode.Uri;
    lineNo:number;
};

interface Pcd {
    name:string;
    value:string
    position:vscode.Location
}

export class SectionProperties{
    properties: SectionProperty[] = [];
    constructor(){
        
    }



    addProperty(sectionType:string, arch:string, moduleType:string){
        let property = new SectionProperty(sectionType, arch, moduleType);
        this.properties.push(property);
    }

    compareArch(other:SectionProperties){
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

    compareLibSectionType(other:SectionProperties){
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

    compareModuleType(other:SectionProperties){
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

    toString(){
        return this.properties.map(x=>x.toString()).join(",");
    }

}

export class SectionProperty{
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
    sectionProperties: SectionProperties;
    text:string;
    parent: string|undefined;
    constructor(filePath:string, location:vscode.Location, parent:string, line:string){
        this.path = filePath.replaceAll("\\",path.sep).replaceAll("/",path.sep);
        this.location = location;
        this.sectionProperties = new SectionProperties();
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
                this.sectionProperties.addProperty(sectionType, arch, moduleType);
            }
        }
        
    }

    toString(): string {
        return `${this.path}:${this.location.range.start.line} - ${JSON.stringify(this.sectionProperties)} }`;
    }




    /**
     * Retrieves a comma-separated string of module types from the properties.
     *
     * @returns {string} A comma-separated string of module types.
     *
     */
    getModuleTypeStr(){
        return this.sectionProperties.properties.map(x=>x.moduleType).join(",");
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



/**
 * Asynchronously retrieves a list of workspaces that are using the specified file.
 *
 * @param uri - The URI of the file to check for usage within the workspaces.
 * @returns A promise that resolves to an array of workspaces that are using the specified file.
 *
 */
async getWorkspace(uri: vscode.Uri): Promise<EdkWorkspace[]> {
    let wps = [];
    for (const workspace of this.workspaces) {
        let result = await workspace.isFileInUse(uri);
        if (result === true) {
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
        gDebugLog.trace("Loading Configuration");
        // TODO: enable to get more commands available
        //await vscode.commands.executeCommand('setContext', 'edk2code.parseComplete', false);
        let dscPaths = gConfigAgent.getBuildDscPaths();
        gDebugLog.trace(`dscPaths = ${dscPaths}`);
        for (const dscPath of dscPaths) {
            let dscDocument = await openTextDocument(vscode.Uri.file(path.join(gWorkspacePath, dscPath)));
            let edkWorkspace = new EdkWorkspace(dscDocument);
            await edkWorkspace.proccessWorkspace();
            this.workspaces.push(edkWorkspace);
            gDebugLog.info(`Workspace loaded: ${dscDocument.fileName}`);
        }
        gMapFileManager.load();
        gCompileCommands.load();
        //await vscode.commands.executeCommand('setContext', 'edk2code.parseComplete', true);
    }
}


export class EdkWorkspace {

    id:number = 0;
    mainDsc: vscode.Uri;
    platformName: string | undefined = undefined;
    flashDefinitionDocument: vscode.TextDocument | undefined = undefined;

    conditionStack: ConditionBlock[] = [];
    result: boolean[] = [];
    conditionOpen:ConditonOpenBlock[] = [];

    private workInProgress: boolean = false;
    private processComplete: boolean = false;

    private conditionalStack: boolean[] = [];
    private sectionsStack: string[] = [];
    private parsedDocuments: Map<string, vscode.Range[]> = new Map();

    private defines: WorkspaceDefinitions = new WorkspaceDefinitions();
    definesFdf: WorkspaceDefinitions = new WorkspaceDefinitions();
    private pcdDefinitions: Map<string,Map<string,Pcd>> = new Map();

    private libraryTypeTrack = new Map<string,InfDsc>();

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
    private _filesFdf: vscode.TextDocument[] = [];

    public get filesDsc(): vscode.TextDocument[] {
        return this._filesDsc;
    }
    public set filesDsc(value: vscode.TextDocument[]) {
        this._filesDsc = value;
    }
    public get filesFdf(): vscode.TextDocument[] {
        return this._filesFdf;
    }
    public set filesFdf(value: vscode.TextDocument[]) {
        this._filesFdf = value;
    }

    private _grayoutControllers:GrayoutController[] = [];

    public updateGrayoutRange(document: vscode.TextDocument, range: vscode.Range[]){
        for (const grayoutController of this._grayoutControllers) {
            
            if(grayoutController.document.uri.fsPath === document.uri.fsPath){
                grayoutController.range = range;
                grayoutController.doGrayOut();
                return;
            }
        }
        const dscGrayoutController = new GrayoutController(document, range);
        dscGrayoutController.doGrayOut();
        this._grayoutControllers.push(dscGrayoutController);

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
    }


    

    async proccessWorkspace() {
        if (this.workInProgress) {
            return false;
        }
        // reset conditional stack
        this.workInProgress = true;
        gDebugLog.trace(`Start finding defines in ${this.mainDsc.fsPath}`);
        this.conditionalStack = [];

        this.defines.resetDefines();
        this.definesFdf.resetDefines();

        this.filesLibraries = [];
        this.filesModules = [];
        this.filesDsc = [];
        for (const ctrl of this._grayoutControllers) {
            ctrl.dispose();
        }
        this._grayoutControllers = [];
        this.libraryTypeTrack = new Map<string,InfDsc>(); 

        
        this.conditionStack = [];
        this.result = [];
        this.conditionOpen = [];

        


        

        this.parsedDocuments = new Map();
        let mainDscDocument = await vscode.workspace.openTextDocument(this.mainDsc);
        await this._processDocument(mainDscDocument, "DSC");
        for (const conditionOpen of this.conditionOpen) {
            DiagnosticManager.error(conditionOpen.uri,conditionOpen.lineNo,EdkDiagnosticCodes.conditionalMissform, "Condition block not closed");
        }
        this.workInProgress = false;
        gDebugLog.trace("Finding done.");

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


    private stripComment(line: string): string {
        if (!line.includes("#")) {
            return line.trim();
        }
    
        const result: string[] = [];
        let insideQuotes = false;
        let quoteChar: string | null = null;
        let escaped = false;
    
        for (const char of line) {
            if ((char === '"' || char === "'") && !escaped) {
                if (!insideQuotes) {
                    insideQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    insideQuotes = false;
                    quoteChar = null;
                }
            } else if (char === "#" && !insideQuotes) {
                break;
            } else if (char === "\\" && !escaped) {
                escaped = true;
            } else {
                escaped = false;
            }
    
            result.push(char);
        }
    
        return result.join("").trimEnd();
    }
    

    private async _processDocument(document: vscode.TextDocument, type: 'DSC' | 'FDF') {
        DiagnosticManager.clearProblems(document.uri);
        gDebugLog.trace(`_process${type}: ${document.fileName}`);

        if (this.isDocumentInIndex(document)) {
            gDebugLog.warning(`_process${type}: ${document.fileName} already in inactiveLines`);
            return;
        }

        let doucumentGrayoutRange = [];
        this.parsedDocuments.set(document.uri.fsPath, []);
        if (type === 'DSC') {
            this.filesDsc.push(document);
        } else {
            this.filesFdf.push(document);
        }

        let text = document.getText().split(/\r?\n/);
        let lineIndex = -1;
        let isRangeActive = false;
        let unuseRangeStart = 0;

        gDebugLog.trace(`# Parsing ${type} Document: ${document.uri.fsPath}`);
        for (let line of text) {
            lineIndex++;
            gDebugLog.trace(`\t\t${lineIndex}: ${line}`);
            line = this.stripComment(line);

            if (line.length === 0){continue;}

            // PCDs
            if (line.match(REGEX_PCD_LINE)) {
                let [fullPcd, pcdValue] = split(line, "|", 2);
                pcdValue = pcdValue.split("|")[0].trim();
                if (pcdValue.startsWith('L"')) {
                    pcdValue = pcdValue.slice(1);
                }
                let [pcdNamespace, pcdName] = split(fullPcd, ".", 2);
                if (!this.pcdDefinitions.has(pcdNamespace)) {
                    this.pcdDefinitions.set(pcdNamespace, new Map());
                }
                this.pcdDefinitions.get(pcdNamespace)?.set(
                    pcdName,
                    {
                        name: pcdName,
                        value: pcdValue,
                        position: new vscode.Location(document.uri, new vscode.Position(lineIndex, 0))
                    }
                );
            }

            line = this.defines.replaceDefines(line);
            line = this.replacePcds(line);
            let isInActiveCode = this.processConditional(line, lineIndex, document.uri);

            if (!isInActiveCode) {
                if (!isRangeActive) {
                    isRangeActive = true;
                    unuseRangeStart = lineIndex;
                }
                continue;
            }

            if(line.startsWith("!error ")){
                DiagnosticManager.error(document.uri, lineIndex, EdkDiagnosticCodes.errorMessage, line.replace("!error ",""));
            }

            if (isRangeActive) {
                isRangeActive = false;
                let lineIndexEnd = lineIndex - 1;
                gDebugLog.debug(`New grayout ${document.fileName} -> unuseRangeStart: ${unuseRangeStart} lineIndexEnd: ${lineIndexEnd}`);
                doucumentGrayoutRange.push(new vscode.Range(new vscode.Position(unuseRangeStart, 0), new vscode.Position(lineIndexEnd, 0)));
            }

            if (type === 'DSC') {
                // Sections
                let match = line.match(REGEX_DSC_SECTION);
                if (match) {
                    const sectionType = match[0].split(".")[0];
                    if (!dscSectionTypes.includes(sectionType.toLowerCase())) {
                        DiagnosticManager.warning(document.uri, lineIndex, EdkDiagnosticCodes.unknownSectionType, sectionType);
                    }
                    this.sectionsStack = [match[0]];
                    continue;
                }
            }

            // Defines
            if (line.match(REGEX_DEFINE)) {
                let key = line.replace(/define/gi, "").trim();
                key = split(key, "=", 2)[0].trim();
                let value = split(line, "=", 2)[1].trim();
                if (value.includes(`$(${key})`)) {
                    gDebugLog.info(`Circular define: ${key}: ${value}`);
                } else {
                    if (type === 'DSC') {
                        this.defines.setDefinition(key, value, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)));
                    } else {
                        this.definesFdf.setDefinition(key, value, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)));
                    }
                }
                continue;
            }

            // Includes
            if (line.match(REGEX_INCLUDE)) {
                let value = line.replace(/!include/gi, "").trim();
                let location = await gPathFind.findPath(value, document.uri.fsPath);
                if (location.length > 0) {
                    let includedDocument = await openTextDocument(location[0].uri);
                    if (type === 'DSC') {
                        await this._processDocument(includedDocument, 'DSC');
                    } else {
                        this.filesFdf.push(includedDocument);
                        await this._processDocument(includedDocument, 'FDF');
                    }
                }
                continue;
            }

            if (type === 'DSC') {

                // Libraries
                let match = line.match(REGEX_LIBRARY_PATH);
                if (match) {
                    let filePath = match[0].trim();
                    let results = await gPathFind.findPath(filePath, document.uri.fsPath);
                    if (results.length === 0) {
                        DiagnosticManager.error(document.uri, lineIndex, EdkDiagnosticCodes.missingPath, filePath);
                    }
                    let newLibDefinition = new InfDsc(filePath, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)), this.sectionsStack[this.sectionsStack.length - 1], line);
                    const libName = newLibDefinition.text.split("|")[0].trim();
                    const libNameTag = libName + " - " + newLibDefinition.getModuleTypeStr();
                    if (this.libraryTypeTrack.has(libNameTag) && (libName.toLocaleLowerCase() !== "null") && newLibDefinition.parent === undefined) {
                        if (this.sectionsStack[this.sectionsStack.length - 1].toLowerCase().endsWith(".inf")) {
                            continue;
                        }
                        let previousLibDefinition = this.libraryTypeTrack.get(libNameTag)!;
                        DiagnosticManager.warning(previousLibDefinition.location.uri, previousLibDefinition.location.range.start.line,
                            EdkDiagnosticCodes.duplicateStatement,
                            `Library overwritten: ${libName}`,
                            [vscode.DiagnosticTag.Unnecessary],
                            [new vscode.DiagnosticRelatedInformation(newLibDefinition.location, "New definition")]);
                        const index = this.filesLibraries.indexOf(previousLibDefinition);
                        if (index > -1) {
                            this.filesLibraries[index] = newLibDefinition;
                        }
                    } else {
                        this.filesLibraries.push(newLibDefinition);
                    }
                    this.libraryTypeTrack.set(libNameTag, newLibDefinition);
                    continue;
                }

                // Modules
                match = line.match(REGEX_MODULE_PATH);
                if (match) {
                    let filePath = match[0].trim();
                    let results = await gPathFind.findPath(filePath, document.uri.fsPath);
                    if (results.length === 0) {
                        DiagnosticManager.error(document.uri, lineIndex, EdkDiagnosticCodes.missingPath, filePath);
                    }
                    let inf = new InfDsc(filePath, new vscode.Location(document.uri, new vscode.Position(lineIndex, 0)), this.sectionsStack[0], line);
                    if (filePath.toLowerCase().endsWith(".inf")) {
                        if (this.sectionsStack[this.sectionsStack.length - 1].toLowerCase().endsWith(".inf")) {
                            this.sectionsStack.pop();
                        }
                    }
                    this.sectionsStack.push(filePath);
                    this.filesModules.push(inf);
                    continue;
                }
            }
        }

        if (isRangeActive) {
            isRangeActive = false;
            let lineIndexEnd = lineIndex - 1;
            gDebugLog.debug(`New grayout ${document.fileName} -> unuseRangeStart: ${unuseRangeStart} lineIndexEnd: ${lineIndexEnd}`);
            doucumentGrayoutRange.push(new vscode.Range(new vscode.Position(unuseRangeStart, 0), new vscode.Position(lineIndexEnd, 0)));
        }

        this.updateGrayoutRange(document, doucumentGrayoutRange);
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



    async findDefinesFdf() {
        if (this.workInProgress) {
            return false;
        }
        // reset conditional stack
        this.workInProgress = true;
        gDebugLog.trace(`Start finding defines fdf`);
        this.conditionalStack = [];
        
        if (this.flashDefinitionDocument) {
            if (!this.isDocumentInIndex(this.flashDefinitionDocument)) {
                this.filesFdf = [];
                await this._processDocument(this.flashDefinitionDocument,"FDF");
            }
        }
        this.workInProgress = false;
        gDebugLog.trace("Finding fdf done.");
        return true;
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


    private processConditional(inputText: string, lineIndex:number, documentUri:vscode.Uri):boolean {
        let conditionStr = inputText.replaceAll(REGEX_VAR_USAGE, `"${UNDEFINED_VARIABLE}"`);
        
        // text = text.replaceAll(UNDEFINED_VARIABLE, '"???"');

        let tokens = [];
        if (conditionStr.includes('"')) {
            tokens = conditionStr.split('"');
            if(tokens.length%2 !== 1){ // check if there is an open string
                DiagnosticManager.error(documentUri,lineIndex,EdkDiagnosticCodes.syntaxStatement, inputText);
                return true;
            }
            tokens = [...tokens[0].trim().split(" "), ...[tokens[1].trim()], ...tokens[2].trim().split(" ")];
        } else {
            tokens = conditionStr.trim().split(" ");
        }
        tokens = tokens.filter(x => { return x.length > 0; });
        if (tokens.length === 0) {
            return this.result[this.result.length - 1];
        }

        let conditionValue;
        let parentActive;
        let block;
        switch (tokens[0].toLowerCase()) {
            case "!if":
            case "!ifdef":
            case "!ifndef":
                this.conditionOpen.push({uri:documentUri, lineNo:lineIndex});
                switch(tokens[0].toLowerCase()){
                    case "!if":
                        conditionValue = this.evaluateConditional(conditionStr, documentUri, lineIndex);
                        break;
                    case "!ifdef":
                        conditionValue = this.pushConditional(this.defines.isDefined(tokens[1]));
                        break;
                    case "!ifndef":
                        conditionValue = this.pushConditional(!this.defines.isDefined(tokens[1]));
                        break;
                }
                
                // Determine if this block is active
                parentActive = this.conditionStack.length === 0 || this.conditionStack[this.conditionStack.length - 1].active;
                const active = parentActive && conditionValue;

                // Push new condition block
                this.conditionStack.push({ active: active, satisfied: conditionValue });
                this.result.push(active); // This line is a control statement
                break;
            case "!elseif":
                // Pop the last condition block
                if (this.conditionStack.length === 0) {
                    //throw new Error('!elseif without !if');
                    DiagnosticManager.error(documentUri, lineIndex, EdkDiagnosticCodes.conditionalMissform, "!elseif without !if");
                    return true;
                }
                conditionValue = this.evaluateConditional(conditionStr, documentUri, lineIndex);
                parentActive = this.conditionStack.length <= 1 || this.conditionStack[this.conditionStack.length - 2].active;

                // Update the top of the stack
                block = this.conditionStack[this.conditionStack.length - 1];
                if (block.satisfied) {
                    // If already satisfied, this block is inactive
                    block.active = false;
                } else {
                    // If not satisfied yet, check this condition
                    block.active = parentActive && conditionValue;
                    block.satisfied = conditionValue || block.satisfied;
                }
                this.result.push(block.active); // This line is a control statement
                break;
            case "!else":
                if (this.conditionStack.length === 0) {
                    //throw new Error('!else without !if');
                    DiagnosticManager.error(documentUri, lineIndex, EdkDiagnosticCodes.conditionalMissform, "!else without !if");
                    return true;
                  }
                  parentActive = this.conditionStack.length <= 1 || this.conditionStack[this.conditionStack.length - 2].active;
            
                  block = this.conditionStack[this.conditionStack.length - 1];
                  if (block.satisfied) {
                    // If already satisfied, this block is inactive
                    block.active = false;
                  } else {
                    // Else block is active if parent is active and no previous condition satisfied
                    block.active = parentActive && !block.satisfied;
                    block.satisfied = true;
                  }
                  this.result.push(block.active); // This line is a control statement
                break;
            case "!endif":
                
                this.conditionOpen.pop();
  
                if (this.conditionStack.length === 0) {
                    //throw new Error('!endif without !if');
                    DiagnosticManager.error(documentUri, lineIndex, EdkDiagnosticCodes.conditionalMissform, "!endif without !if");
                    return true;
                  }

                  parentActive = this.conditionStack.length <= 1 || this.conditionStack[this.conditionStack.length - 2].active;
                  block = this.conditionStack[this.conditionStack.length - 1];
                  
                  if (!parentActive) {
                    // If already satisfied, this block is inactive
                    this.result.push(false);
                  } else {
                    // Else block is active if parent is active and no previous condition satisfied
                    block.active = parentActive && !block.satisfied;
                    if(parentActive && block.satisfied){
                        this.result.push(true);
                    }else{
                        this.result.push(false);
                    }
                  }
                  this.conditionStack.pop();
                break;
            default:
                const isActive = this.conditionStack.every(block => block.active);
                this.result.push(isActive);
        }

        return this.result[this.result.length - 1];


    }

    private pushConditional(v: boolean) {
        this.conditionalStack.push(v);
        return v;
    }
    
    evaluateExpression(expression: string): any {
        const originalExpression = expression;
        if(expression.includes(UNDEFINED_VARIABLE)){
            gDebugLog.debug(`Evaluate expression: ${expression} -> ${false}`);
            return false;
        }
        // add space to parenteses
        expression = expression.replaceAll(/\(/g, " ( ");
        expression = expression.replaceAll(/\)/g, " ) ");
        expression = expression.replaceAll(/\s+/g, " ");


        let tokens = expression.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        let outputQueue = [];
        let operatorStack: string[] = [];
        let parentesisBalance = 0;
        for (const token of tokens) {
            if (!isNaN(Number(token))) {
                outputQueue.push(Number(token));
            } else if (token.toLowerCase() === 'true' || token.toLowerCase() === 'false') {
                outputQueue.push(token.toLowerCase() === 'true');
            } else if(token.trim().startsWith('"') && token.trim().endsWith('"')){
                outputQueue.push(token.trim().slice(1,-1));
            } else if (token in OPERATORS) {
                while (operatorStack.length && operatorStack[operatorStack.length - 1] in OPERATORS &&
                    OPERATORS[token as keyof typeof OPERATORS].precedence <= OPERATORS[operatorStack[operatorStack.length - 1] as keyof typeof OPERATORS].precedence) {
                    outputQueue.push(operatorStack.pop());
                }
                operatorStack.push(token);
            } else if (token === '(') {
                parentesisBalance++;
                operatorStack.push(token);
            } else if (token === ')') {
                parentesisBalance--;
                while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
                    outputQueue.push(operatorStack.pop());
                }
                operatorStack.pop();
            } else{
                throw new Error(`Error evaluating expression: ${originalExpression} - bad Operand ${token}`);
            }
        }

        if(parentesisBalance !== 0){
            throw new Error(`Error evaluating expression: ${originalExpression} - Parenthesis balance error`);
        }
    
        while (operatorStack.length) {
            outputQueue.push(operatorStack.pop());
        }
    
        let stack: any[] = [];
        for (const token of outputQueue) {
           if (token! as keyof typeof OPERATORS in OPERATORS) {
                let y = stack.pop() as never;
                let x = stack.pop() as never;
                stack.push(OPERATORS[token! as keyof typeof OPERATORS].fn(x, y));
            }else{
                stack.push(token);
            }
        }

        if(stack.length > 1){
            throw new Error(`Error evaluating expression: ${originalExpression}`);
        }

        const retValue = (stack[0]===UNDEFINED_VARIABLE)? false : stack[0];
        gDebugLog.debug(`Evaluate expression: ${originalExpression} -> ${retValue}`);
        return retValue;
    }

    private evaluateConditional(text: string, documentUri:vscode.Uri, lineNo:number): any {


        // let data = text.replaceAll(/(?<![\!"])\b(\w+)\b(?!")/gi, '"$1"'); // convert words to string
        let data = text.replace(/^\!\w+/gi, "");  // remove conditional keyword
        gDebugLog.debug(`Evaluate conditional ${documentUri.fsPath}:${lineNo + 1} - ${text}`);

        let result = false;
        try {
            result = this.evaluateExpression(data);
        } catch (error) {
            gDebugLog.warning(`Evaluate conditional ${documentUri.fsPath}:${lineNo + 1} - ${(error as Error).message} - ${text}`);
            DiagnosticManager.error(documentUri,lineNo,EdkDiagnosticCodes.edk2CodeUnsuported,`${(error as Error).message}` );

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


    async getDscProperties(uri:vscode.Uri){
        let declarations = await this.getDscDeclaration(uri);
        if(declarations.length){
            return declarations[declarations.length-1].sectionProperties;
        }
        return undefined;
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
                let entryPathList = await gPathFind.findPath(entry.path);
                if(entryPathList.length){
                    for (const entryPath of entryPathList) {
                        if(pathCompare(entryPath.uri.fsPath,uri.fsPath)){
                            dscInfs.push(entry);
                        }   
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
     * Retrieves the DSC files and positions where the given library is declared.
     * 
     * This function performs the following steps:
     * 1. Checks if the library is overwritten in the module definition.
     * 2. Retrieves the MODULE_TYPE from the original INF file.
     * 3. Gets properties from the module URI.
     * 4. Checks all module declarations to match library classes with module properties.
     * 
     * @param contextUri - The URI of the INF where the library is being used. If INF is a library it will return multiple declarations. For Modules i
     * should return single one.
     * @param libName - The name of the library to be found.
     * 
     * @returns A promise that resolves to an array of `InfDsc` objects representing the libraries that match the module properties.
     * 
     * @throws Will throw an error if the file cannot be read or if there are issues processing the library declarations.
     */
    async getLibDeclarationModule(contextUri:vscode.Uri,libName:string, ) {
    
        let dscLibDeclarations: InfDsc[] = await this.getLibDeclaration(libName);
        
        // Check if library is overwritten in module definition
        // 1. <LibraryClasses> associated with the INF file in the [Components] section
        for (const library of dscLibDeclarations) {
            if(library.parent === undefined){continue;}
            let parentPaths = await gPathFind.findPath(library.parent);
            for (const parentLocation of parentPaths) {
                if(parentLocation.uri.fsPath === contextUri.fsPath){
                    return [library];
                }
            }
        }

        // Return libraries that match module properties
        
        // Get MODULE_TYPE from original INF file
        let infText = (await vscode.workspace.openTextDocument(contextUri)).getText();
        let m = /MODULE_TYPE\s*=\s*\b(\w*)\b/gi.exec(infText);
        let moduleType = "common";
        if(m!==null){
            moduleType = m[1].toLocaleLowerCase();
        }

        //Get properties from moduleUri
        let modulesDeclarations = await this.getDscDeclaration(contextUri);
        let currentAccuracy = 0;
        let locations = new Map<string,InfDsc>();

        // Check all module declarations.
        for (const module of modulesDeclarations) {
            let locationFound = false;

            // Module contains the properties obtained from DSC file.
            // Here overwrite module type with the actual definition of the INF file
            for (const property of module.sectionProperties.properties) {
                property.moduleType = moduleType;
            }

            for (const library of dscLibDeclarations) {
                // 2. Library Class Instance that is defined in the [LibraryClasses.$(ARCH).$(MODULE_TYPE)] section will be used
                
                if(library.sectionProperties.compareArch(module.sectionProperties) && library.sectionProperties.compareModuleType(module.sectionProperties)){
                    locationFound = true;
                    locations.set(library.path, library);
                    
                    break;
                }
            }
            if(locationFound){continue;}

            for (const library of dscLibDeclarations) {
                if(library.sectionProperties.compareArchStr("common") && library.sectionProperties.compareModuleType(module.sectionProperties)){
                    locationFound = true;
                    locations.set(library.path, library);
                    break;
                }
            }
            if(locationFound){continue;}

            // ? common.common
            for (const library of dscLibDeclarations) {
                if(library.sectionProperties.compareArchStr("common") && library.sectionProperties.compareModuleTypeStr("common")){
                    locationFound = true;
                    locations.set(library.path, library);
                    break;
                }
            }
            if(locationFound){continue;}


            for (const library of dscLibDeclarations) {
                // ?? just check for library classes
                if(library.sectionProperties.compareLibSectionTypeStr("libraryclasses")){
                    locationFound = true;
                    locations.set(library.path, library);
                    break;
                }
            }
            if(locationFound){continue;}


            gDebugLog.error(`Library ${libName} not found in ${module.path}`);

        }
        return Array.from(locations.values());
    }


}