import path = require('path');
import * as fs from 'fs';
import * as vscode from 'vscode';
import { gConfigAgent, gCscope, gCscopeAgen as gCscopeAgent, gDebugLog, gEdkDatabase, gGrayOutController, gWorkspacePath } from '../extension';

import { createRange, deleteEdkCodeFolder, getRealPathRelative, normalizePath, pathCompare, pcdRegexLineMatch, pcdRegexMatch, readEdkCodeFolder, readLines, split, toPosix } from '../utils';
import { LanguageParser } from './languageParser';
import glob = require("fast-glob");

import { Edk2Symbol, Edk2SymbolProperties, Edk2SymbolType } from './edkSymbols';

import * as edkStatusBar from '../statusBar';
import { AslParser } from './aslParser';
import { VfrParser } from './vfrParser';
import { DecParser } from './decParser';
import { DscParser } from './dscParser';
import { FdfParser } from './fdfParser';
import { InfParser } from './infParser';
import { rgSearch } from '../rg';




export const UNDEFINED_VARIABLE = "???";

interface Pcd {
    name:string;
    value:string
    position:vscode.Location
}

/**
 * Holds the list of all parsed symbols
 */
export class EdkDatabase {

    buildFolders: string[] = [];

    async clearWorkspace() {
        gCscopeAgent.removeFiles();
        this.deleteIgnoreFile();
        await gConfigAgent.set("buildDefines", []);
        await gConfigAgent.set("mainDscFile", []);
        await gConfigAgent.set("buildPackagePaths", []);
        deleteEdkCodeFolder();
    }


    isFileInuse(filePath: string) {
        filePath = normalizePath(filePath).toUpperCase();
        if (this.usedFilesSet.has(filePath)) {
            return true;
        }
        return false;
    }
    private mapFiles: Map<string, string> = new Map();
    private parsersProduceMap: Map<string, any> = new Map();
    private parsersFile: Map<string, LanguageParser> = new Map();
    private parsersLangId: Map<string, LanguageParser[]> = new Map();
    private usedFilesSet: Map<string, string> = new Map();
    pcdDefinitions: Map<string,Map<string,Pcd>> = new Map();
    private buildDefines!: Map<string, string>;
    private packagesPaths!: string[];
    private inputVars!: Map<string, string>;
    private conditionalStack!: string[];
    private currentLine!: number;
    private targetFilePath!: string;
    private dscFilePaths!: Set<string>;
    private pathsNotFound!: string[];
    private missingPathVars!: Map<string, any>;
    private missingPaths!: Set<string>;
    private inactiveCode!: Map<string, vscode.Range[]>;
    unusedLibrariesList: Edk2Symbol[] = [];
    includeSource!: Map<string, vscode.Location>;

    parseComplete:boolean = false;

    /**
     * Saves configuration settings as DSC files, Build defines and include paths to a json file
     * This json file can be loaded using the loadSettings function
     * @param buildDefines 
     * @param dscFiles 
     * @param includePaths 
     */
    async saveSettings(
        buildDefines: Map<string, string>,
        dscFiles: string[],
        includePaths: string[],
    ) {

        // Make settings relative to workspace
        let relativeDscFiles = dscFiles.map((x) => { return getRealPathRelative(x); });
        let relativeIncludePaths = includePaths.map((x) => { return getRealPathRelative(x); });

        let definitions: string[] = [];
        for (const [key, value] of buildDefines.entries()) {
            definitions.push(`${key}=${value}`);
        }

        await gConfigAgent.set("buildDefines", definitions.sort());
        await gConfigAgent.set("mainDscFile", relativeDscFiles);
        await gConfigAgent.set("buildPackagePaths", relativeIncludePaths);
    }


    async getLibraryDefinition(symbol: Edk2Symbol) {
        let infParser = await this.getParser(symbol.filePath);
        if (!infParser) { return []; }
        let filePath = symbol.filePath;
        if (!filePath) { return []; }

        // Check if current INF is a library
        let isLibrary = false;
        if (infParser.findByName("LIBRARY_CLASS").length) {
            isLibrary = true;
        }

        let symbolListTemp = this.findByName(symbol.name, "edk2_dsc");
        let symbolList: Edk2Symbol[] = [];
        for (const s of symbolListTemp) {
            // check if symbol is in active code
            if (!this.isLocationActive(s.location)) {
                continue;
            }
            symbolList.push(s);
        }


        let fullSymbolLocations: Edk2Symbol[] = [];


        for (const symbol of symbolList) {

            fullSymbolLocations.push(symbol);
            // Check if this is an overwrite
            if (symbol.parent !== undefined &&
                symbol.parent.type === Edk2SymbolType.dscModuleDefinition &&
                symbol.parent.value === filePath) {
                return [symbol];
            }
        }

        // We are not sure which driver is the context of the library
        // so return all
        if (isLibrary) {
            return fullSymbolLocations;
        }

        let infModuleTypes = infParser.findByName("MODULE_TYPE");
        let dscModuleProperties = await this.findByValue(filePath, "edk2_dsc");



        let thisModuleProperties: Edk2SymbolProperties[] = [];
        for (const moduleType of infModuleTypes) {
            for (const dscMod of dscModuleProperties) {
                for (const prop of dscMod.properties) {
                    thisModuleProperties.push({
                        arch: prop.arch,
                        moduleType: moduleType.value.toLowerCase(),
                        sectionType: "libraryclasses"
                    });
                }
            }
        }

        let moduleTypeTargets: Edk2Symbol[] = [];
        let moduleTypeTargetsGeneral: Edk2Symbol[] = [];
        let moduleTypeTargetsSpecific: Edk2Symbol[] = [];
        for (const symbol of symbolList) {
            // Skip overwrites
            if (symbol.parent && symbol.parent.type !== Edk2SymbolType.dscSection) { continue; }

            let targetAdded = false;
            for (const targetProp of symbol.properties) {
                for (const thisProp of thisModuleProperties) {

                    // Divide matches by specific and general
                    if (thisProp.moduleType === "*" || targetProp.moduleType === "*") {
                        moduleTypeTargetsGeneral.push(symbol);
                        targetAdded = true;
                        break;
                    }
                    if (thisProp.moduleType === targetProp.moduleType) {
                        moduleTypeTargetsSpecific.push(symbol);
                        targetAdded = true;
                        break;
                    }

                }
                if (targetAdded) { break; }
            }
        }

        // Check if there is specific match
        if (moduleTypeTargetsSpecific.length > 0) {
            moduleTypeTargets = moduleTypeTargetsSpecific;
        } else {
            moduleTypeTargets = moduleTypeTargetsGeneral;
        }


        let archTargets: Edk2Symbol[] = [];
        let archTargetsGeneral: Edk2Symbol[] = [];
        let archTargetsSpecific: Edk2Symbol[] = [];
        for (const symbol of moduleTypeTargets) {
            // Skip overwrites
            if (symbol.parent && symbol.parent.type !== Edk2SymbolType.dscSection) { continue; }

            let targetAdded = false;
            for (const targetProp of symbol.properties) {
                for (const thisProp of thisModuleProperties) {

                    // Divide matches by specific and general
                    if (thisProp.arch === "*" || targetProp.arch === "*") {
                        archTargetsGeneral.push(symbol);
                        targetAdded = true;
                        break;
                    }
                    if (thisProp.arch === targetProp.arch) {
                        archTargetsSpecific.push(symbol);
                        targetAdded = true;
                        break;
                    }

                }
                if (targetAdded) { break; }
            }
        }

        // Check if there is specific match
        if (archTargetsSpecific.length > 0) {
            archTargets = archTargetsSpecific;
        } else {
            archTargets = archTargetsGeneral;
        }

        let retLocations: Edk2Symbol[] = [];
        for (const target of archTargets) {
            retLocations.push(target);
        }
        return retLocations;
    }


    getMissingPathVars() {
        return this.missingPathVars;
    }

    getBuildDefines(){
        return this.buildDefines;
    }

    getDscPaths(){
        return Array.from(this.dscFilePaths.values());
    }


    

    /**
     * Reads the extension settings: Build defines, Include paths and DSC files
     * @returns 
     */
    getSettings() {
        let buildDefines = gConfigAgent.getBuildDefines();
        let includePaths = gConfigAgent.getBuildPackagePaths();
        let mainDscfiles = gConfigAgent.getBuildDscPaths();

        // Load Map files from edk2code extension folder in worksapce
        let mapFilesText = readEdkCodeFolder("mapFiles.txt");
        if (mapFilesText) {
            for (let m of mapFilesText.split("\n")) {
                m = m.trim();
                if (m.length === 0) { continue; }
                this.mapFiles.set(path.basename(m.toLowerCase().split(".")[0]), normalizePath(m));
            }
        }
        return { defines: buildDefines, includes: includePaths, dscFiles: mainDscfiles };
    }





    /**
     * Returns the list of files in use. This list comes from cscope.files
     * @returns 
     */
    getFilesInUse() {
        let t = [];
        for (const val of this.usedFilesSet.values()) {
            t.push(val);
        }
        return t;
    }

    setPackagesPaths(packagesPaths: string[]) {
        this.packagesPaths = packagesPaths;
    }

    /**
     * Parses a .map file. from the list of map files loaded
     * (Im not sure if this works in GCC in the same way)
     * @param fileName 
     * @returns 
     */
    parseMapFile(fileName: string) {
        let name = path.basename(fileName).toLowerCase().split(".")[0];
        let mapPath = this.mapFiles.get(name);
        let mapValues: MapData[] = [];
        if (!mapPath) { return []; }
        if (fs.existsSync(mapPath)) {
            let mapText = readLines(mapPath);
            let mapStart = false;
            for (let l of mapText) {
                l = l.trim();
                if (l.length === 0) { continue; }
                if (l.startsWith("Address")) { mapStart = true; continue; }
                if (!mapStart) { continue; }
                let data = split(l, " ", 5);
                let lib;
                let obj = "";
                if (data[3].length === 1) {
                    [lib, obj] = split(data[4], ":", 2);
                } else {
                    [lib, obj] = split(data[3], ":", 2);
                }
                obj = obj.split(".")[0];
                let publics = data[1];
                let isFunction = false;
                if (publics.startsWith("_")) {
                    publics = publics.slice(1);
                    isFunction = true;
                }
                mapValues.push({ address: data[0], publics: publics, base: data[2], lib: lib, obj: obj, isFunction: isFunction });
            }
            return mapValues;
        }
        return [];
    }

    getPackagesPaths() {
        return this.packagesPaths;
    }



    setBuildDefine(name: any, value: string) {
        this.buildDefines.set(name, value);
    }

    setInputBuildDefines(buildDefines: Map<string, string>) {
        this.inputVars = buildDefines;
    }

    setBuildFolders(buildFolders: string[]) {
        this.buildFolders = buildFolders;
    }

    getInputBuildDefines() {
        return this.inputVars;
    }

    /**
     * Adds an inactive line to a file. This inactive code will be dim
     * @param fileName 
     * @param lineNo 
     */
    addInactiveLine(fileName: string, lineNo: number) {
        fileName = fileName.toLowerCase();
        if (!this.inactiveCode.has(fileName)) {
            this.inactiveCode.set(fileName, []);
        }
        this.inactiveCode.get(fileName)?.push(createRange(lineNo - 1, lineNo - 1));
    }

    clearInactiveLines(fileName: string) {
        fileName = fileName.toLowerCase();
        if (this.inactiveCode.has(fileName)) {
            this.inactiveCode.set(fileName, []);
        }
    }

    /**
     * Returns the list of inactive lines of filePath
     * @param filePath 
     * @returns 
     */
    getInactiveLines(filePath: string) {

        let d = this.inactiveCode.get(filePath.toLowerCase());
        if (d) {
            return d;
        }
        return [];
    }

    /**
     * Creates a parser and binds it to filePath
     * @param filePath 
     * @returns 
     */
    async setParser(filePath: string): Promise<LanguageParser | undefined> {
        if (!fs.existsSync(filePath)) {
            gDebugLog.error(`Trying to create parser from file not found ${filePath}`);
            return;
        }
        let document = await vscode.workspace.openTextDocument(filePath);
        let parser = this.parsersProduceMap.get(document.languageId);
        if (parser) {
            gDebugLog.verbose(`New parser: ${filePath}`);
            let newPar = new parser(this, filePath);
            await newPar.parseFile();
            this.parsersFile.set(filePath, newPar);
            this.parsersLangId.get(document.languageId)?.push(newPar);
            return newPar;
        }
    }

    /**
     * Returns parsed assigned to filePath
     * @param filePath 
     * @returns 
     */
    async getParser(filePath: string): Promise<LanguageParser | undefined> {
        if (this.parsersFile.has(filePath)) {
            return this.parsersFile.get(filePath);
        }
        return await this.setParser(filePath);
    }

    /**
     * Returns all the parsers created for specific langId (edk2_inf, edk2_dsc, ...)
     * @param langId 
     * @returns 
     */
    getParsersLang(langId: string | undefined = undefined) {
        if (langId) {

            let parseList = this.parsersLangId.get(langId);
            if (parseList !== undefined) {
                return parseList;
            }

        }

        return Array.from(this.parsersFile.values());
    }

    /**
     * Resets internal class variables to default
     */
    resetVariables() {
        this.pcdDefinitions = new Map();
        this.parseComplete = false;
        this.buildDefines = new Map();
        this.conditionalStack = [];
        this.currentLine = 0;
        this.targetFilePath = "";
        this.dscFilePaths = new Set();
        this.pathsNotFound = [];
        this.missingPathVars = new Map();
        this.missingPaths = new Set();
        this.packagesPaths = [];
        this.inactiveCode = new Map();
        this.inputVars = new Map();
        this.includeSource = new Map();
        this.unusedLibrariesList = [];
       
    }

    constructor() {
        this.parsersProduceMap.set("edk2_dsc", DscParser);
        this.parsersProduceMap.set("edk2_inf", InfParser);
        this.parsersProduceMap.set("edk2_dec", DecParser);
        this.parsersProduceMap.set("asl", AslParser);
        this.parsersProduceMap.set("edk2_vfr", VfrParser);
        this.parsersProduceMap.set("edk2_fdf", FdfParser);

        this.parsersLangId.set("edk2_dsc", []);
        this.parsersLangId.set("edk2_inf", []);
        this.parsersLangId.set("edk2_dec", []);
        this.parsersLangId.set("edk2_vfr", []);
        this.parsersLangId.set("edk2_fdf", []);
        this.parsersLangId.set("asl", []);

        this.resetVariables();

        let subscriptions: vscode.Disposable[] = [];
        vscode.workspace.onDidSaveTextDocument(this._onFileSave, this, subscriptions);
    }

    private taskUpdateId: NodeJS.Timeout | undefined;
    private updateFrequency: number = 300;
    private async _onFileSave(savedFile: vscode.TextDocument) {
        if (this.taskUpdateId !== undefined) {
            clearTimeout(this.taskUpdateId);
        }

        this.taskUpdateId = setTimeout(async () => {
            // Event when files are saved
            let x;
            if (savedFile.languageId === "edk2_dsc") {
                x = await this._parseDscFile(savedFile.fileName);
                await gGrayOutController.doGrayOut();
            }
            let fileParser = await this.getParser(savedFile.fileName);
            if (fileParser) {
                await fileParser.reloadSymbols();
            }
        }, this.updateFrequency);
    }

    /**
     * Loads new database base on dscFilesPath
     * @param dscFilesPath List of dsc files paths. Can be relative to workspace
     */
    async load(dscFilesPath: string[], quick:boolean=false) {

        gDebugLog.verbose("Load command");
        edkStatusBar.setText("Reloading index...");
        edkStatusBar.setWorking();

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading EDK2 database",
            cancellable: true
        }, async (progress, reject) => {
            try {
                // Clear files in use
                this.usedFilesSet = new Map();

                for (let dscPath of dscFilesPath) {
                    gDebugLog.verbose(`Parsing path: ${dscPath}`);
                    dscPath = await this._parseDscFile(dscPath);
                }

                let incremet = 100 / this.dscFilePaths.size;
                for (let dscPath of this.dscFilePaths) {
                    // Load DSC parses
                    if (reject.isCancellationRequested) { break; }
                    progress.report({ message: `(1/3) ${dscPath}`, increment: incremet });
                    await this.setParser(dscPath);
                    this.usedFilesSet.set(dscPath.toUpperCase(), dscPath);
                }

                if(quick){
                    edkStatusBar.setText("Config in progress");
                    edkStatusBar.clearWorking();
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    vscode.window.showInformationMessage(`Loaded ${this.usedFilesSet.size} files.`);
                    await gGrayOutController.doGrayOut();
                    return;
                }

                progress.report({ message: "", increment: -100 });
                let infSymbols = await this.findByValueRegex(/.*\.inf$/gi, "edk2_dsc");
                incremet = 100 / infSymbols.length;
                for (const infSymbol of infSymbols) {
                    progress.report({ message: `(2/3) ${infSymbol.value}`, increment: incremet });
                    if (reject.isCancellationRequested) { break; }
                    gDebugLog.verbose(`Load INF file ${infSymbol.value}`);
                    await this.setParser(infSymbol.value);
                    this.usedFilesSet.set(infSymbol.value.toUpperCase(), infSymbol.value);
                }


                progress.report({ message: "", increment: -100 });
                let decSymbols = await this.findByValueRegex(/.*\.dec$/gi, "edk2_inf");
                incremet = decSymbols.length / 100;
                for (const decSymbol of decSymbols) {
                    progress.report({ message: `(3/3) ${decSymbol.value}`, increment: incremet });
                    if (reject.isCancellationRequested) { break; }
                    gDebugLog.verbose(`Load DEC file ${decSymbol.value}`);
                    await this.getParser(decSymbol.value);
                    this.usedFilesSet.set(decSymbol.value.toUpperCase(), decSymbol.value);
                }

                if (!reject.isCancellationRequested) {
                    // Set files in use
                    let cscopeFiles = gCscopeAgent.readCscopeFile();
                    if (cscopeFiles.length) {
                        gDebugLog.info("Valid Cscope.list file");
                        this.usedFilesSet = new Map();
                        for (const filePath of cscopeFiles) {
                            this.usedFilesSet.set(filePath.toUpperCase(), filePath);
                        }

                        // Check if libraries are being used
                        if (gConfigAgent.getIsDimmUnusedLibraries()) {
                            let libSymbols = await this.findByType(Edk2SymbolType.dscLibraryDefinition, "edk2_dsc");
                            for (const libSymbol of libSymbols) {
                                if (libSymbol.value !== '' && !this.isFileInuse(libSymbol.value)) {
                                    // If file is not in files in use, it means that it was not used for compilation
                                    gDebugLog.warning(`Unused library: ${libSymbol.value}`);
                                    this.unusedLibrariesList.push(libSymbol);
                                    this.addInactiveLine(libSymbol.filePath, libSymbol.range.start.line + 1);
                                }
                            }
                        }

                        await gCscope.reload(true);
                    } else {
                        gDebugLog.info("Invalid Cscope.list");
                        //Parse INF files to get Source files
                        let infSymbols = await this.findByValueRegex(/.*\.inf$/gi, "edk2_dsc");
                        for (const infSymbol of infSymbols) {
                            let infPar = await this.getParser(infSymbol.value);
                            if (infPar) {
                                //todo: Need to implement this to get all sources
                                let sources = infPar.findByValueMatchChildrens(/\[\s*sources.*?\]/gi);
                                for (const source of sources) {
                                    progress.report({ message: source.value });
                                    this.usedFilesSet.set(source.value.toUpperCase(), source.value);
                                }
                            }
                        }

                        // Look for *.deps files
                        for (const folder of this.buildFolders) {
                            let depsList = glob.sync(toPosix(path.join(folder, "**", '*.deps')));
                            for (const dep of depsList) {
                                let depLines = readLines(dep);
                                for (let l of depLines) {
                                    l = l.replaceAll('"', "").replace(" \\", "");
                                    let depPath = normalizePath(l);
                                    this.usedFilesSet.set(depPath.toUpperCase(), depPath);
                                }
                            }
                        }


                        let tempFilesList: string[] = [];
                        for (const f of this.usedFilesSet.values()) {
                            tempFilesList.push(f);
                        }
                        await gCscopeAgent.writeCscopeFile(tempFilesList);
                        await gCscope.reload(true);
                    }

                    // Generate .ignore if setting is set and .ignore doesnt exists
                    if (gConfigAgent.getIsGenIgnoreFile() && !
                        this.isIgnoreFileExists()) {
                        await this.genIgnoreFile();
                    }
                }

                edkStatusBar.setText("Ready");
                edkStatusBar.clearWorking();
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showInformationMessage(`Loaded ${this.usedFilesSet.size} files.`);
                await gGrayOutController.doGrayOut();
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(String(error));
            }
            this.parseComplete = true;
        }
        );

       

    }


    private async _parseDscFile(dscPath: string) {

        if (!path.isAbsolute(dscPath)) {
            dscPath = path.join(gWorkspacePath, dscPath);
        }
        if (!fs.existsSync(dscPath)) {
            throw new Error(`DSC path not found: ${dscPath}`);
        }

        // Clean Inactive lines
        this.inactiveCode.set(dscPath.toLowerCase(), []);

        // Parse DSC files to get defines  
        let dscLines = readLines(dscPath);
        this.pushTargetFile(dscPath);
        await this.preProcess(dscLines);
        return dscPath;
    }

    /**
     * checks if .ignore file exists
     * @returns 
     */
    private isIgnoreFileExists() {
        return fs.existsSync(path.join(gWorkspacePath, ".ignore"));
    }

    private deleteIgnoreFile() {
        fs.rmSync(path.join(gWorkspacePath, ".ignore"), { force: true });
    }

    /**
     * Creates .ignore file. this will check for this.getFilesInUse() and will ignore all the 
     * files that are not used
     * @returns 
     */
    private async genIgnoreFile() {

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating .ignore file",
            cancellable: true
        }, async (progress, reject) => {

            return new Promise<void>((resolve, token) => {
                let progFiles = this.getFilesInUse();
                let filesMap = new Set();
                for (const progFile of progFiles) {
                    filesMap.add(toPosix(progFile.toUpperCase()));
                }

                let lookPath = toPosix(path.join(gWorkspacePath, "**"));
                let fileList = glob.sync(lookPath);
                let ignoreList = "";
                let posixWorkspacePath = toPosix(gWorkspacePath);
                for (const f of fileList) {
                    if (!filesMap.has(f.toUpperCase())) {
                        progress.report({ message: f });
                        ignoreList += `${f.replace(posixWorkspacePath, "")}\n`;
                    }
                }
                fs.writeFileSync(path.join(gWorkspacePath, ".ignore"), ignoreList);
                resolve();
            });


        });

    }

    /**
     * Returns a list of Edk2symbols that match the symbol type
     * @param type 
     * @param langId 
     * @returns 
     */
    findByType(type: Edk2SymbolType, langId: string | undefined = undefined, filePath: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        let parsers = this.getParsersLang(langId);
        for (const parser of parsers) {
            for (const symbol of parser.getSymbolsList()) {
                if (symbol.type === type) {
                    if (filePath !== undefined && !pathCompare(filePath, symbol.filePath)) {
                        continue;
                    }
                    retSymbols.push(symbol);
                }
            }

        }
        return retSymbols;

    }

    /**
     * Returns a list of Edk2symbols that match the symbol type
     * @param type 
     * @param langId 
     * @returns 
     */
    findByTypeAndValue(type: Edk2SymbolType, value: string, langId: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        let parsers = this.getParsersLang();
        for (const parser of parsers) {
            for (const symbol of parser.getSymbolsList()) {
                if (symbol.type === type &&
                    symbol.value === value) {
                    retSymbols.push(symbol);
                }
            }

        }
        return retSymbols;

    }


    /**
     * Returns the selected Edk2Symbol from document position
     * @param document 
     * @param position 
     * @returns 
     */
    async getSelectedSymbol(document: vscode.TextDocument, position: vscode.Position) {
        let parser = await this.getParser(document.uri.fsPath);
        if (!parser) { return undefined; }
        let selectedSymbol = undefined;
        for (const symbol of parser.symbolsData.symbolList) {
            if (symbol.range.contains(position)) {
                selectedSymbol = symbol;
            }
        }
        return selectedSymbol;
    }

    /**
     * Finds symbols that match name and filepath
     * @param name 
     * @param filePath 
     * @param langId 
     * @returns 
     */
    findByNameAndFilePath(name: string, filePath: string, langId: string | undefined = undefined) {
        name = name.toLocaleLowerCase().trim();
        filePath = filePath.toLowerCase();
        let retSymbols: Edk2Symbol[] = [];

        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.name.toLowerCase() === name &&
                    pathCompare(symb.filePath, filePath)) {
                    retSymbols.push(symb);
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbols that match name only
     * @param name 
     * @param langId 
     * @returns 
     */
    findByName(name: string, langId: string | undefined = undefined, filePath: string | undefined = undefined) {
        name = name.toLocaleLowerCase().trim();
        let retSymbols: Edk2Symbol[] = [];

        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.name.toLowerCase() === name) {
                    if (filePath !== undefined && !pathCompare(filePath, symb.filePath)) {
                        continue;
                    }
                    retSymbols.push(symb);
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbols that intersects location
     * @param name 
     * @param langId 
     * @returns 
     */
    findByLocation(location: vscode.Location, langId: string | undefined = undefined) {

        let retSymb = undefined;
        let pos = new vscode.Position(location.range.start.line, location.range.start.character);
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.location.range.contains(pos) &&
                    pathCompare(symb.filePath, location.uri.fsPath)) {
                    retSymb = symb;
                }
            }
        }

        return retSymb;
    }

    findByNameAndValue(name: string, value: string, langId: string | undefined = undefined) {
        name = name.toLowerCase().trim();
        value = value.toLowerCase().trim();
        let retSymbols: Edk2Symbol[] = [];

        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.name.toLowerCase() === name &&
                    symb.value.toLowerCase() === value) {
                    retSymbols.push(symb);
                }
            }
        }
        return retSymbols;
    }


    /**
     * Finds symbols that match value only
     * @param value 
     * @param langId 
     * @returns 
     */
    async findByValue(value: string, langId: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.value === value) {
                    retSymbols.push(symb);
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbol that match name and properties. `*` will match any property
     * @param section 
     * @param arch 
     * @param moduleType 
     * @param name 
     * @param langId 
     * @returns 
     */
    async findByNameAndProperties(section: string, arch: string, moduleType: string, name: string, langId: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                for (const symbProperty of symb.properties) {
                    if (symbProperty.sectionType === section && // section
                        (symbProperty.arch === "*" || symbProperty.arch === arch) && //arch
                        (symbProperty.moduleType === "*" || symbProperty.moduleType === moduleType) && // moduleType
                        (symb.name === name)) // Value                     
                    {
                        retSymbols.push(symb);
                        break;
                    }
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbols that match value and properties. `*` will match any property
     * @param section 
     * @param arch 
     * @param moduleType 
     * @param value 
     * @param langId 
     * @returns 
     */
    async findByValueAndProperties(section: string, arch: string, moduleType: string, value: string, langId: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                for (const symbProperty of symb.properties) {
                    if (symbProperty.sectionType === section && // section
                        (symbProperty.arch === "*" || symbProperty.arch === arch) && //arch
                        (symbProperty.moduleType === "*" || symbProperty.moduleType === moduleType) && // moduleType
                        (symb.value === value)) // Value                     
                    {
                        retSymbols.push(symb);
                        break;
                    }
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbols that match properties only. `*` will match any property
     * @param section 
     * @param arch 
     * @param moduleType 
     * @param langId 
     * @returns 
     */
    async findByProperties(section: string, arch: string, moduleType: string, langId: string | undefined = undefined, filePath: string | undefined = undefined) {
        let retSymbols: Edk2Symbol[] = [];
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                for (const symbProperty of symb.properties) {
                    if (symbProperty.sectionType === section && // section
                        (symbProperty.arch === "*" || symbProperty.arch === arch) && //arch
                        (symbProperty.moduleType === "*" || symbProperty.moduleType === moduleType) // moduleType
                    ) {
                        if (filePath !== undefined &&
                            !pathCompare(filePath, symb.filePath)) {
                            break;
                        }
                        retSymbols.push(symb);
                        break;
                    }
                }
            }
        }
        return retSymbols;
    }

    /**
     * Finds symbols were value match valueRegex
     * @param valueRegex 
     * @param langId 
     * @returns 
     */
    async findByValueRegex(valueRegex: RegExp, langId: string | undefined) {
        let retSymbols: Edk2Symbol[] = [];
        for (const parser of this.getParsersLang(langId)) {
            let symbols = parser.getSymbolsList();
            for (const symb of symbols) {
                if (symb.value.match(valueRegex)) {
                    retSymbols.push(symb);
                }
            }
        }
        return retSymbols;
    }



    //-----------------------------------------
    private findReplacementForToken(token: string, replaceIfNotFound: boolean): string | undefined {
        let v = this.buildDefines.get(token);
        if (!v) {
            v = this.inputVars.get(token);
        }
        if (!v && replaceIfNotFound) {
            v = UNDEFINED_VARIABLE;
        }
        if (!v) {
            return undefined;
        }

        if (v.toUpperCase() === 'TRUE' || v.toLowerCase() === "FALSE") {
            v = v.toUpperCase();
        }
        this.buildDefines.set(token, v);
        return v;
    }

    private async preProcess(dscLines: string[]) {
        if (dscLines.length === 0) {
            return;
        }

        let lineNo = 0;
        for (const rawLine of dscLines) {
            gDebugLog.debug(`Parsing line: ${rawLine}`);
            await this.parserDefineLine(rawLine, lineNo);
            lineNo += 1;

        }
    }

    replaceVariables(line: string | undefined) {
        if (line === undefined) { return ""; }

        let result = line;
        let tokens = result.trim().split(" ");

        let replace = false;
        if (tokens.length > 1 && ["!ifdef", "!ifndef", "!if", "!elseif"].includes(tokens[0].toLowerCase())) {
            replace = true;
        }

        if (tokens.length > 1 && ["!ifdef", "!ifndef"].includes(tokens[0].toLocaleLowerCase())) {
            if (!tokens[1].startsWith("$(")) {
                let v = this.findReplacementForToken(tokens[1], replace);
                if (v !== undefined) {
                    result = result.replace(tokens[1], v);
                }
            }
        }

        //use line to avoid change by handling above
        let rep = line.match(/\$/g)?.length;
        if (!rep) { rep = 0; }

        let index = 0;
        while (rep > 0) {
            let start = line.indexOf("$(", index);
            let end = line.indexOf(")", start);

            let token = line.substring(start + 2, end);
            let replacementToken = line.substring(start, end + 1);
            let v = this.findReplacementForToken(token, replace);
            if (v !== undefined) {
                if (v.includes(replacementToken)) {
                    result = result.replace(replacementToken, "");
                } else {
                    result = result.replace(replacementToken, v);
                }
            }
            index = end + 1;
            rep = rep - 1;
        }

        return result;
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


    private processConditional(text: string) {
        text = text.replaceAll(UNDEFINED_VARIABLE, '"???"');



        let tokens = [];
        if (text.includes('"')) {
            tokens = text.split('"');
            tokens = [...tokens[0].trim().split(" "), ...[tokens[1].trim()], ...tokens[2].trim().split(" ")];
        } else {
            tokens = text.trim().split(" ");
        }
        tokens = tokens.filter(x=>{return x.length > 0;});
        if(tokens.length === 0){
            return false;
        }
        if (tokens[0].toLowerCase() === "!if") {
            this.pushConditional(this.evaluateConditional(text));
            return true;
        } else if (tokens[0].toLowerCase() === "!elseif") {
            let v = this.popConditional();
            this.pushConditional(this.evaluateConditional(text));
            return true;
        }
        else if (tokens[0].toLowerCase() === "!ifdef") {
            if (tokens.length !== 2) {
                throw new Error("!ifdef conditionals need to be formatted correctly (spaces between each token)");
            }
            this.pushConditional((tokens[1] !== UNDEFINED_VARIABLE));
            return true;
        }
        else if (tokens[0].toLowerCase() === "!ifndef") {
            if (tokens.length !== 2) {
                throw new Error("!ifndef conditionals need to be formatted correctly (spaces between each token)");
            }
            this.pushConditional((tokens[1] !== UNDEFINED_VARIABLE));
            return true;
        }
        else if (tokens[0].toLowerCase() === "!else") {
            if (tokens.length !== 1) {
                throw new Error("!ifdef conditionals need to be formatted correctly (spaces between each token)");
            }
            let v = this.popConditional();
            this.pushConditional(!v);
            return true;
        }

        else if (tokens[0].toLowerCase() === "!endif") {
            if (tokens.length !== 1) {
                throw new Error("!ifdef conditionals need to be formatted correctly (spaces between each token)");
            }
            this.popConditional();
            return true;
        }
        return false;
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
        data = data.replaceAll(/"and"/gi,"&&");
        data = data.replaceAll(/"or"/gi,"||");
        data = data.replace(/"not"\s/gi, "!");

        let result = false;
        try {
            result = eval(data);
        } catch (error) {
            gDebugLog.error(`Evaluation problem ${text}`);
            return false;
        }
        
        return result;


    }

    private pushConditional(v: any) {
        this.conditionalStack.push(v);
    }

    private popConditional() {
        if (this.conditionalStack.length > 0) {
            return this.conditionalStack.pop();
        }
        throw new Error(`Tried to pop an empty conditional stack. ${this.currentLine} ${this.currentLine}`);

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

    async getInactiveLibraries(filePath: string) {
        // Check library usage on modules only
        let inactiveSymbols:Edk2Symbol[] = [];
        let libClass = this.findByName("library_class", "edk2_inf", filePath);
        if (libClass.length === 0) {
            let librariesSymb = this.findByType(Edk2SymbolType.infLibrary, "edk2_inf", filePath);
            let baseName = this.findByName("base_name", "edk2_inf", filePath);
            let mapFile: MapData[] = [];
            if (baseName) {
                mapFile = this.parseMapFile(path.basename(split(baseName[0].value, "|", 2)[0]));
            }

            for (const lib of librariesSymb) {

                let parser = await this.getParser(filePath);
                if (!parser) { continue; }
                let libDef = await this.getLibraryDefinition(lib);
                if(libDef.length === 0){
                    gDebugLog.error(`lib definition not found: ${lib.name}`);
                    continue;
                }
                if (libDef.length > 1) {
                    continue;
                }
                let name = path.basename(libDef[0].value).split(".")[0];

                let references: string[] = [];

                for (const mapSymb of mapFile) {
                    if (mapSymb.lib === name) {
                        references.push(mapSymb.publics);
                    }
                }
                if (references.length === 0) {
                    inactiveSymbols.push(lib);
                    
                } 
            }
        }
        return inactiveSymbols;
    }

    /**
     * Checks if location is part of inactive code
     * This checks at line level
     */
    isLocationActive(location: vscode.Location) {
        let inactiveLines = this.getInactiveLines(location.uri.fsPath);
        for (const r of inactiveLines) {
            if (r.start.line === location.range.start.line) {
                return false;
            }
        }
        return true;
    }


    

    private async parserDefineLine(line: string, lineNo: number): Promise<string | undefined> {
        // console.log(`${lineNo}: ${line}`);
        let lineStripped = line.split("#")[0].trim();
        if (!this.isInActiveCode()) {
            this.addInactiveLine(this.targetFilePath, lineNo + 1);
        }
        if (lineStripped.length === 0) { return; }

        let lineResolved = this.replaceVariables(lineStripped).trim();
        if(this.isInActiveCode()){
            // find PCDS variables
            if(lineResolved.match(pcdRegexLineMatch)){
                let [fullPcd, pcdValue] = split(lineResolved,"|",2);
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
                        position: new vscode.Location(
                        vscode.Uri.file(this.targetFilePath),
                        createRange(lineNo,lineNo))}
                    );
            }
        }
        


        lineResolved = this.replacePcds(lineResolved);



        this.processConditional(lineResolved);
        // if(this.processConditional(lineResolved)){
        //     return; //pending
        // }


        if (!this.isInActiveCode()) {
            this.addInactiveLine(this.targetFilePath, lineNo + 1);
            return; //pending
        }

        if (lineResolved.toLowerCase().startsWith("!include")) {
            let [_, includeFile] = split(lineResolved, " ", 2).map((x) => { return x.trim(); });
            gDebugLog.info(`Opening include file: ${includeFile}`);
            let sp = await this.findPath(includeFile, this.targetFilePath);
            if (sp === undefined) {
                gDebugLog.warning(`Parse define file not found ${includeFile}`);
                // throw new Error(`File not found ${includeFile}`);
                return;
            }

            // Adds current section to included dsc file
            this.includeSource.set(sp.toUpperCase(), new vscode.Location(vscode.Uri.file(this.targetFilePath), createRange(lineNo + 1, lineNo + 1, 0)));
            let thisFilePath = this.targetFilePath;
            this.pushTargetFile(sp);
            await this.preProcess(readLines(sp));
            this.targetFilePath = thisFilePath;

            return;

        }

        // check for new section
        if (lineResolved.includes("=")) {
            let [defName, defValue] = split(lineResolved, "=", 2).map((x) => { return x.trim(); });
            defName = defName.split(" ").pop().trim(); // In case it starts with "DEFINE <var_name>"

            this.buildDefines.set(defName, defValue);
            gDebugLog.verbose(`Key, values found: ${defName} = ${defValue}`);
            for (const lvar of this.buildDefines.keys()) {
                this.buildDefines.set(lvar, this.replaceVariables(this.buildDefines.get(lvar)));
            }
            return;
        }

        return;
    }



    async findPath(pathArg: string, realtivePath: string | undefined = undefined) {

        // Restrict path characters
        if (pathArg.match(/[\[\]\#\%\&\{\}\<\>\*\?\!\'\@\|\‘\`\“,'"'\+\^]/gi)) {
            return;
        }

        if (pathArg.length === 0) {
            return;
        }

        if (pathArg.includes("$")) {
            // Skip paths with variables
            let matches = pathArg.matchAll(/\$\((?<target>.*?)\)/gi);
            this.missingPaths.add(pathArg);
            for (const match of matches) {
                if (match !== null &&
                    match.groups !== undefined &&
                    "target" in match.groups) {

                    if (!this.missingPathVars.has(match.groups['target'])) {
                        this.missingPathVars.set(match.groups['target'], []);
                    }
                    this.missingPathVars.get(match.groups['target']).push(pathArg);
                }
            }
            return;
        }

        if (this.pathsNotFound.includes(pathArg)) {
            return;
        }

        if (path.isAbsolute(pathArg)) {
            return pathArg;
        }

        if (realtivePath) {
            let p = path.join(path.dirname(realtivePath), pathArg);
            if (fs.existsSync(p)) {
                return p;
            }
        }

        if (fs.existsSync(path.join(gWorkspacePath, pathArg))) {
            return path.join(gWorkspacePath, pathArg);
        }


        // Check every posible Package path
        for (let packagePath of this.packagesPaths) {
            if (!path.isAbsolute(packagePath)) {
                packagePath = path.join(gWorkspacePath, packagePath);
            }
            let p = path.join(packagePath, pathArg);
            if (fs.existsSync(p)) {
                return p;
            }
        }

        let p = this.findPathUsedFiles(pathArg);
        if (p) {
            return p;
        }

        // If project files were not loaded, then look in all tree
        // TODO: if cscope.files is loaded then dont do this
        gDebugLog.warning(`Searching file: ${pathArg}`);

        let found = await this.findPathGlob(pathArg);
        if (found.length > 0) {
            let retPath = found[0];
            // Add relative path
            let includePath = retPath.substring(0, retPath.length - pathArg.length);
            if (!this.packagesPaths.includes(includePath)) {
                this.packagesPaths.push(includePath);
            }
            return retPath;
        }
        // let foundPaths = this.findPathGlobSync(pathArg);
        // if(foundPaths.length > 0){
        //     let retPath = foundPaths[0];
        //     // Add relative path
        //     let includePath = retPath.substring(0, retPath.length-pathArg.length);
        //     this.packagesPaths.push(includePath);
        //     return retPath;
        // }
        gDebugLog.warning(`Not found: ${pathArg}`);
        this.pathsNotFound.push(pathArg);

    }

    async findPathGlob(filePath: string) {

        let globExpression = toPosix(path.join("**", filePath));
        let found = await vscode.workspace.findFiles(globExpression);
        let ret = [];
        for (const f of found) {
            ret.push(f.fsPath);
        }
        return ret;
    }


    private findPathUsedFiles(filePath: string) {
        return undefined;
        // gDebugLog.info(`findPathUsedFiles ${filePath}`);
        // let fileName = path.basename(filePath);
        // let filesUsed = gCompileInfo.getPathsByFileName(fileName);
        // if(!filesUsed){return undefined;}

        // let sFilePath = filePath.toLocaleLowerCase().replaceAll("/","\\\\");
        // sFilePath = sFilePath.replaceAll(".","\\.");

        // for (const file of filesUsed) {
        //   if (file.toLocaleLowerCase().match(sFilePath)) {
        //     return file;
        //   }
        // }
    }




    private pushTargetFile(targetFile: string) {
        gDebugLog.info(`TargetFile push: ${targetFile}`);
        this.targetFilePath = targetFile;
        this.dscFilePaths.add(normalizePath(targetFile));
    }




}

export interface MapData {
    address: string;
    publics: string;
    base: string;
    lib: string;
    obj: string;
    isFunction: boolean;
}