import { Uri } from "vscode";
import * as vscode from 'vscode';
import { rgSearch } from "../rg";
import { checkCompileCommandsConfig, delay, deleteEdkCodeFolder, existsEdkCodeFolderFile, getCurrentDocumentFilePath, getCurrentWord, getEdkCodeFolderFilePath, gotoFile, isWorkspacePath, listFilesRecursive, openTextDocument, profileEnd, profileStart, readLines, toPosix, writeEdkCodeFolderFile } from "../utils";
import path = require("path");
import * as fs from 'fs';
import { edkLensTreeDetailProvider, edkLensTreeDetailView, gConfigAgent, gCscope, gDebugLog, gEdkWorkspaces, gExtensionContext, gPathFind, gWorkspacePath } from "../extension";
import { distance, closest } from 'fastest-levenshtein';
import { glob } from "fast-glob";
import { BuildFolder } from "../Languages/buildFolder";
import { EdkWorkspace, InfDsc } from "../index/edkWorkspace";
import { FileTreeItem, FileTreeItemLibraryTree, TreeItem } from "../TreeDataProvider";
import { ParserFactory, getParser } from "../edkParser/parserFactory";
import { Edk2SymbolType } from "../symbols/symbolsType";
import * as edkStatusBar from '../statusBar';
import { infoMissingCompileInfo } from "../ui/messages";
import { SettingsPanel } from "../settings/settingsPanel";
import { InfParser } from "../edkParser/infParser";
import { EdkSymbolInfLibrary } from "../symbols/infSymbols";
import { debuglog } from "util";

    export async function rebuildIndexDatabase() {

        gDebugLog.verbose("rebuildIndexDatabase()");

        // Pick build folder
        let buildPath = await vscode.window.showOpenDialog({
            defaultUri: vscode.Uri.file(gWorkspacePath), canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
            filters: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'BuildFolder': ['Build'],
            },
            title: "Select EDK build folder"
        });

        // If build folder picked
        if (buildPath) {
            // Check if its part of workspace
            if (isWorkspacePath(buildPath[0].fsPath)) {
                let buildInfoFolders: any[] = [];
                let configPath = buildPath[0].fsPath;

                // Look for BuildOptions file in selected buildPath
                if (configPath !== undefined) {
                    let lookPath = toPosix(path.join(configPath, "**", "BuildOptions"));
                    buildInfoFolders = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Looking for compile info",
                        cancellable: true
                    }, async (progress, reject) => {
                        return glob(lookPath);
                    });
                }

                // Build Options not found this is not a build folder
                if (buildInfoFolders.length === 0) {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    vscode.window.showErrorMessage(`Build data was not found in selected folder`);
                    return;
                }

                buildInfoFolders = buildInfoFolders.map((x) => {
                    return path.parse(String(x)).dir;
                });
                
                // Show options for builds
                var options: vscode.QuickPickItem[] = [];
                for (const foundPath of buildInfoFolders) {
                    let splitPath = foundPath.split(path.posix.sep);

                    options.push({
                        label: splitPath[splitPath.length - 2],
                        description: "",
                        detail: foundPath,
                    });
                }


                let selectedOptions = await vscode.window.showQuickPick(options, { title: "Select build", matchOnDescription: true, matchOnDetail: true , canPickMany:true});
                if (selectedOptions === undefined) { return; }

                let selectedFolders:string[] = [];

                for (const op of selectedOptions) {
                    if(op.detail){
                        selectedFolders.push(op.detail);
                    }
                }


                gDebugLog.verbose("Loading from build");

                let buildFolder = new BuildFolder(selectedFolders);
                let buildData = await buildFolder.getBuildOptions();
                if (buildData) {
                    gDebugLog.verbose("Delete workspace files");
                    // await gEdkDatabase.clearWorkspace();
                    deleteEdkCodeFolder();
                    gConfigAgent.clearWpConfiguration();
                    await gConfigAgent.setBuildDefines(buildData.buildDefines);
                    await gConfigAgent.setBuildDscPaths(buildData.dscFiles);
                    buildFolder.copyFilesToRoot();

                
                    // If cscope.file is not generated, then calculate files based on dsc parsing
                    if(existsEdkCodeFolderFile(".missing")){
                        infoMissingCompileInfo();
                        await reloadSymbols();


                    }else{
                        
                        await checkCompileCommandsConfig();
                        await gCscope.reload();
                    }

                    // Generate .ignore if setting is set and .ignore doesnt exists
                    if (gConfigAgent.getIsGenIgnoreFile()) {
                        await genIgnoreFile();
                    }

                    void vscode.window.showInformationMessage("Build data loaded");

                    await gEdkWorkspaces.loadConfig();

                    
                }

            } else {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(`${buildPath[0].fsPath} its outside workspace`);
            }
        }
    }
    
    export async function rescanIndex() {
        gConfigAgent.reloadConfigFile();
        await reloadSymbols();
        // Generate .ignore if setting is set and .ignore doesnt exists
        if (gConfigAgent.getIsGenIgnoreFile()) {
            await genIgnoreFile();
        }
    }

    export async function openFile() {
        let wps = gEdkWorkspaces.workspaces;
        var itemsOption: vscode.QuickPickItem[] = [];
        if(wps.length){
            for (const wp of wps) {
                for(const s of wp.getFilesList()){
                    itemsOption.push({
                        label: `$(file) ${path.basename(s)}`,
                        description: s
                    }); 
                }
            }
        }
        await vscode.window.showQuickPick(itemsOption, { title: "Files on workspaces", matchOnDescription: true, matchOnDetail: true }).then(async option => {
            if (option !== undefined) {
                let path = await gPathFind.findPath(option.description!);
                // await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, path , "gotoAndPeek", "Not found");
                if(path.length){
                    await vscode.commands.executeCommand("edk2code.gotoFile", path[0].uri);
                }
                
            }
        });
    }
    export async function openLib() {
        let wps = gEdkWorkspaces.workspaces;
        var itemsOption: vscode.QuickPickItem[] = [];
        if(wps.length){
            for (const wp of wps) {
                for(const s of wp.filesLibraries){
                    let filePath = await gPathFind.findPath(s.path);
                    if(filePath.length){
                        itemsOption.push({
                            label: `$(file) ${path.basename(s.path)}`,
                            description: filePath[0].uri.fsPath
                        }); 
                    }
                }
            }
        }
        await vscode.window.showQuickPick(itemsOption, { title: "Libraries on workspaces", matchOnDescription: true, matchOnDetail: true }).then(async option => {
            if (option !== undefined) {
                await vscode.commands.executeCommand("edk2code.gotoFile", vscode.Uri.file(option.description!)).then(() => {
    
                }
                );
            }
        });
    }
    export async function openModule() {
        let wps = gEdkWorkspaces.workspaces;
        var itemsOption: vscode.QuickPickItem[] = [];
        if(wps.length){
            for (const wp of wps) {
                for(const s of  wp.filesModules){
                    let filePath = await gPathFind.findPath(s.path);
                    if(filePath.length){
                        itemsOption.push({
                            label: `$(file) ${path.basename(s.path)}`,
                            description: filePath[0].uri.fsPath
                        }); 
                    }

                }
            }
        }
        await vscode.window.showQuickPick(itemsOption, { title: "Modules on workspaces", matchOnDescription: true, matchOnDetail: true }).then(async option => {
            if (option !== undefined) {
                await vscode.commands.executeCommand("edk2code.gotoFile", vscode.Uri.file(option.description!)).then(() => {
    
                }
                );
            }
        });
    }
    export async function gotoDefinitionCscope(fileUri:vscode.Uri) {
        let currentWord = getCurrentWord();
        if(currentWord !== undefined){
        
            // Filter results to only show files used in compilation
            let filteredLocations:vscode.Location[] = [];
    
            // First look using Cscope
            filteredLocations = await gCscope.getDefinitionPositions(currentWord.word);
    
            if(filteredLocations.length === 0){
                let allLocations:vscode.Location[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', currentWord.uri, currentWord.range.end);
                for (const loc of allLocations) {
                    
                    let isFileUsed = await gEdkWorkspaces.isFileInUse(loc.uri);
                    if(isFileUsed){
                        filteredLocations.push(loc);
                    }
                }
            }
    
            await vscode.commands.executeCommand('editor.action.goToLocations', currentWord.uri, currentWord.range.end, filteredLocations, "gotoAndPeek", "Not found");

        }
    }
    export function gotoDefinitionInput(): void {
        throw new Error("Method not implemented.");
    }

    export async function gotoInf(fileUri: Uri) {
        let locations: vscode.Location[] = [];

        let wps = await gEdkWorkspaces.getWorkspace(fileUri);
        if(wps.length){
            for (const wp of wps) {
                locations = await wp.getInfReference(fileUri);
                if(locations.length){
                    await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
                }
            }
        }else{
            // Skip if source hasn't been indexed. Just make a search query
            let fileName = path.basename(fileUri.fsPath);
            let folderPath = path.dirname(fileUri.fsPath);
            
            let tempLocations = await rgSearch(`\\b${fileName}\\b`, ["*.inf"],[],true);
            for (const l of tempLocations) {
                // Check the INF file is relative to the source file
                if (!path.relative(path.dirname(l.uri.fsPath), folderPath).includes("..")) {
                    locations.push(l);
                }
            }
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");

        }

    }

    export async function gotoDscDeclaration(fileUri: Uri) {

        let fileName = path.basename(fileUri.fsPath);

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Looking for references...",
            cancellable: true
        }, async (progress, reject) => {

            let wps = await gEdkWorkspaces.getWorkspace(fileUri);
            let locations;
            if(wps.length){
                let dscDeclarations: InfDsc[] = [];
                for (const wp of wps) {
                    dscDeclarations = dscDeclarations.concat(await wp.getDscDeclaration(fileUri));
                }
                locations = dscDeclarations.map((x) => {return x.location;});
                

            }else{
                locations = await rgSearch(`-i --regexp ".*?\\b${fileName}\\b"`, ["*.dsc","*.dsc.inc"]);

            }
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations , "gotoAndPeek", "Not found");


        });
    }



    export async function gotoDscInclusion(fileUri: Uri) {

        let fileName = path.basename(fileUri.fsPath);

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Looking for references...",
            cancellable: true
        }, async (progress, reject) => {

            let locations:vscode.Location[] = [];
            let wps = await gEdkWorkspaces.getWorkspace(fileUri);
            if(wps.length){
                for (const wp of wps) {
                    locations = locations.concat(await wp.getIncludeReference(fileUri));
                }
                if(locations.length){
                    await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations , "gotoAndPeek", "Not found");
                    return;
                }
            }

            locations = await rgSearch(`-i --regexp "\!include\\s+.*?\\b${fileName}\\b"`, ["*.dsc"," *.dsc.inc","*.fdf","*.fdf.inc"]);
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations , "gotoAndPeek", "Not found");




        });



    }
    export function showLibUsage(): void {
        throw new Error("Method not implemented.");
    }
    export function showReferences(): void {
        throw new Error("Method not implemented.");
    }



    export async function showLibraryTree(fileUri:vscode.Uri) {


        let parser = await getParser(fileUri);
        if(parser && (parser instanceof InfParser) ){
            // Check if INF file is a library
            if(parser.isLibrary()){
                // list all modules and ask for context
                void vscode.window.showWarningMessage("This INF is a library. This command only works with EDK Modules for now");
                return;
            }
            edkLensTreeDetailProvider.clear();
            edkLensTreeDetailProvider.refresh();
            edkLensTreeDetailView.title = "EDK2 Library Tree";
            edkLensTreeDetailView.description = path.basename(fileUri.fsPath);
            

            let wps = await gEdkWorkspaces.getWorkspace(fileUri);
            let libraries = parser.getSymbolsType(Edk2SymbolType.infLibrary) as EdkSymbolInfLibrary[];
            for (const wp of wps) {
                // let dscDeclarations = await wp.getDscDeclaration(fileUri);
                const sectionRange = libraries[0].parent?.range.start;
                if(sectionRange===undefined){continue;}
                let moduleNode = new FileTreeItemLibraryTree(fileUri, sectionRange,null);
                moduleNode.description = wp.platformName;
                edkLensTreeDetailProvider.addChildren(moduleNode);
                for (const library of libraries) {
                    let libDefinitions = await wp.getLibDeclarationModule(fileUri, library.name);
                    for (const libDefinition of libDefinitions) {
                        let filePaths = await gPathFind.findPath(libDefinition.path);
                        for (const path of filePaths) {
                            let libNode = new FileTreeItemLibraryTree(path.uri, libDefinition.location.range.start,moduleNode);
                            moduleNode.addChildren(libNode);
                        }
                    }
                }
                
            }
        }

        await edkLensTreeDetailView.reveal(edkLensTreeDetailProvider.data[0]);
            
    }


    export async function showReferenceStack(fileUri: Uri){
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Looking for references...",
            cancellable: false
        }, async (progress, reject) => {
            let document = await openTextDocument(fileUri);
            return await updateInclussionTree(document);
        });
        
    }





    let _maxDscRec = 10;
    export async function updateInclussionTree(document: vscode.TextDocument){
        edkLensTreeDetailProvider.clear();
        let wps = await gEdkWorkspaces.getWorkspace(document.uri);
        if(wps.length){
            for (const wp of wps) {
                let currentDocument = document;
                let infReferences:vscode.Location[] = [];
                var dscReferences:vscode.Location[] = [];
                let rootNode = new TreeItem(`[${wp.platformName}]` || "Undefined Platform");
                let cNode = new TreeItem("");
                edkLensTreeDetailProvider.addChildren(rootNode);

                switch (currentDocument.languageId) {
                    case "c":
                        cNode = new FileTreeItem(document.uri, new vscode.Position(0,0));
                        rootNode.addChildren(cNode);
                        infReferences = await wp.getInfReference(document.uri);
                        // intentional with no break
                    case "edk2_inf":
                        let targetNode = cNode;
                        if(infReferences.length===0){
                            infReferences = [new vscode.Location(document.uri, document.positionAt(0))];
                            targetNode = rootNode;
                        }
                        
                        for (const infRef  of infReferences) {
                            let infNode = new FileTreeItem(infRef.uri, infRef.range.start);
                            targetNode.addChildren(infNode);
                            dscReferences = (await wp.getDscDeclaration(infRef.uri)).map(x=>{return x.location;});
                            for (const dscRef of dscReferences) {
                                _maxDscRec = 10;
                                let targetNode = new FileTreeItem(dscRef.uri, dscRef.range.start);
                                await _dscIncRefs(targetNode,wp, infNode);
                            }
                        }
                        break;
                    case "edk2_fdf":
                    case "edk2_dsc" :

                        dscReferences = [new vscode.Location(document.uri, document.positionAt(0))];

    
                        for (const dscRef of dscReferences) {
                            let refNode = new FileTreeItem(dscRef.uri, dscRef.range.start);
                            _maxDscRec = 10;
                            await _dscIncRefs(refNode,wp,rootNode);
                        }
                        break;
                    default:
                        edkLensTreeDetailProvider.clear();

                }
            }
        }
        
        edkLensTreeDetailProvider.refresh();
        edkLensTreeDetailView.title = "EDK2 References";
        edkLensTreeDetailView.description = path.basename(document.uri.fsPath);
        await edkLensTreeDetailView.reveal(edkLensTreeDetailProvider.data[0]);
    }

    
    export async function  _dscIncRefs(referenceNode:FileTreeItem, wp:EdkWorkspace, targetNode:TreeItem){
        if(_maxDscRec === 0){return;}
        _maxDscRec --;

        
        let dscInclude = await wp.getIncludeReference(referenceNode.uri);
        if(dscInclude.length === 0){
            referenceNode.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        targetNode.addChildren(referenceNode);
        for (const i of dscInclude) {
            let newNode = new FileTreeItem(i.uri, i.range.start);
            await _dscIncRefs(newNode, wp, referenceNode);
        }
    }


    let proccesedInfFiles:Set<string> = new Set();

    export async function reloadSymbols(){
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Indexing C files in workspace",
            cancellable: true
        }, async (progress, reject) => {
            await gEdkWorkspaces.loadConfig();
            let filesList:string[] = [];
            let decList:string[] = [];
            let hFiles:string[] = [];
            
            edkStatusBar.pushText("Index source files...");
            edkStatusBar.setWorking();
            proccesedInfFiles = new Set();

            let factory = new ParserFactory();

            let wpInfFiles:InfDsc[] = [];
            // Grab all inf files in all workspaces
            for (const wp of gEdkWorkspaces.workspaces) {
                if(reject.isCancellationRequested){break;}
                for (const dsc of wp.dscList()) {
                    if(reject.isCancellationRequested){break;}
                    filesList.push(dsc);
                }
                wpInfFiles = wpInfFiles.concat(wp.filesLibraries.concat(wp.filesModules));
            }

            const increment = 100/wpInfFiles.length;
            for (const lib of wpInfFiles) {
                progress.report({message:"Parsing INF files",increment:increment});
                if(reject.isCancellationRequested){break;}
                // get all sources 
                try {
                    let p = await gPathFind.findPath(lib.path);
                    if(p.length){
                        // Skip inf files that have been proccesed
                        if(proccesedInfFiles.has(p[0].uri.fsPath)){
                            continue;
                        }else{
                            proccesedInfFiles.add(p[0].uri.fsPath);
                        }
                        let document = await openTextDocument(p[0].uri);
                        let parser = factory.getParser(document);
                        if(parser){
                            await parser.parseFile();
                            let sources = parser.getSymbolsType(Edk2SymbolType.infSource);
                            filesList.push(parser.document.fileName);
                            for (const source of sources) {
                                if(reject.isCancellationRequested){break;}
                                filesList.push(await source.getValue());
                            }
                            let decs = parser.getSymbolsType(Edk2SymbolType.infPackage);
                            for (const dec of decs) {
                                if(reject.isCancellationRequested){break;}
                                let decValue = await dec.getValue();
                                if(decList.includes(decValue) || decValue === ""){continue;}
                                decList.push(decValue);
                                let decPath = await gPathFind.findPath(decValue);
                                if(decPath.length){
                                    let decDoc = await openTextDocument(decPath[0].uri);
                                    let decParser = factory.getParser(decDoc);
                                    if(decParser){
                                        await decParser.parseFile();
                                        let decIncludes = decParser.getSymbolsType(Edk2SymbolType.decInclude);
                                        for (const decInclude of decIncludes) {
                                            if(reject.isCancellationRequested){break;}
                                            let decIncludedPath = await decInclude.getKey();
                                            let sourcesIncluded = await listFilesRecursive(decIncludedPath);
                                            for (const sourceIncluded of sourcesIncluded) {
                                                if(reject.isCancellationRequested){break;}
                                                if(sourceIncluded.toLowerCase().endsWith(".h")){
                                                    let sourceFullPath = path.join(decIncludedPath, sourceIncluded);
                                                    if(!hFiles.includes(sourceFullPath)){
                                                        hFiles.push(sourceFullPath);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // For each new DEC file, check its "Include" section and add h files
                                
                            }
                        }
                    }
                } catch (error) {
                    gDebugLog.error(String(error));
                }
            }
            

            progress.report({message:"Running Cscope"});
            await delay(200); // Delay to update GUI
            filesList = filesList.concat(decList).concat(hFiles);
            gCscope.writeCscopeFile(filesList);
            await gCscope.reload();
            edkStatusBar.clearWorking();
            edkStatusBar.popText();



            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showInformationMessage(`Index complete: ${gCscope.readCscopeFile().length} files found`);
        });
    }

    /**
     * Creates .ignore file. this will check for this.getFilesInUse() and will ignore all the 
     * files that are not used
     * @returns 
     */
    async function genIgnoreFile() {

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating .ignore file",
            cancellable: true
        }, async (progress, reject) => {

            return new Promise<void>((resolve, token) => {
                gDebugLog.info("Generationg .ignore file");
                let cscopeFilesList = gCscope.readCscopeFile();
                let filesSet = new Set();
                let filesExtensions = new Set();
                for (const cscopeFile of cscopeFilesList) {
                    let progFileUpper = cscopeFile.toUpperCase();
                    filesSet.add(progFileUpper);
                    filesExtensions.add(path.extname(progFileUpper));
                }

                // Glob library needs posix path
                let lookPath = toPosix(path.join(gWorkspacePath, "**"));
                let globFilesList = glob.sync(lookPath);
                let ignoreList = [];

                // Add extra ignore patterns
                let extraIgnores = gConfigAgent.getExtraIgnorePatterns();
                for (const extraIgnore of extraIgnores) {
                    ignoreList.push(extraIgnore.trim());
                }
                
                let posixWorkspacePath = toPosix(gWorkspacePath);
                gDebugLog.debug(Array.from(filesSet).toString());
                gDebugLog.debug("####################");
                gDebugLog.debug(Array.from(globFilesList).toString());
                

                for (const globFile of globFilesList) {
                    // Just ignore EDK files
                    let globFileUpperCase = path.resolve(globFile.toUpperCase());
                    let extension = path.extname(globFileUpperCase);
                    if (filesExtensions.has(extension) && !filesSet.has(globFileUpperCase)) {
                        progress.report({ message: globFile });
                        
                        ignoreList.push(toPosix(path.relative(posixWorkspacePath, globFile)));
                    }
                }
                fs.writeFileSync(path.join(gWorkspacePath, ".ignore"), ignoreList.join("\n"));
                resolve();
            });


        });

    }

export async function openWpConfigGui() {
	SettingsPanel.render(gExtensionContext.extensionUri, gConfigAgent);
}
export async function openWpConfigJson() {
    await gotoFile(gConfigAgent.getConfigFileUri());
}

