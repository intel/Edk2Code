import path = require("path");
import { TreeItem } from "./TreeDataProvider";
import { gCscope, edkLensTreeDetailProvider, edkLensTreeDetailView, gEdkDatabase, gDebugLog } from "./extension";
import { getCurrentWord, getOpenFilePath, getRealPath, normalizePath, pathCompare, split } from "./utils";
import * as vscode from 'vscode';
import { rgSearch } from "./rg";
import { Edk2SymbolType } from "./edkParser/edkSymbols";
import * as edkStatusBar from './statusBar';

export enum CallType{
    caller= "call-incoming",
    callee = "call-outgoing"
}

var lastCallWord: { word: string; range: vscode.Range; uri: vscode.Uri | undefined; } | undefined = undefined;
export async function showCallType(funcCallType:CallType) {
    
    // if(!validateState()){return;}

    var wordInfo;
    wordInfo = getCurrentWord();
    // Check if this is called from the call button
    if(wordInfo.word===""){
        // Get word from function in view
        if(lastCallWord!== undefined){
            wordInfo = lastCallWord;
        }else{
            return;
        }
    }else{
        // Get word from editor
        lastCallWord = wordInfo;
    }

    edkLensTreeDetailProvider.clear();

    // Create function first node
    var tempItem = new TreeItem(wordInfo.word);
    tempItem.iconPath = new vscode.ThemeIcon(funcCallType);
    if (wordInfo.uri !== undefined){
        tempItem.description = `${wordInfo.uri.fsPath}: ${wordInfo.range.start.line +1}`;
    }
    tempItem.resourceUri = wordInfo.uri;
    
    registerCallCommand(tempItem,wordInfo.word, wordInfo.range.start, funcCallType);
    await populateNodeCall(tempItem, wordInfo.word, new vscode.ThemeIcon(funcCallType), funcCallType);
    
    edkLensTreeDetailProvider.addChildren(tempItem);
    await edkLensTreeDetailView.reveal(tempItem, { focus: true });
    edkLensTreeDetailView.title = `${funcCallType}: ${wordInfo.word}`;
    edkLensTreeDetailProvider.refresh();
}

export async function getFunctionLocation(functionName:string){
    var locations:vscode.Location[] = [];
    
    var funclist = await gCscope.getDefinitionPositions(functionName);

    if (funclist.length === 0){
        return locations;
    }

    for (const func of funclist) {
        let newLocation = new vscode.Location(func.uri, func.range);
        locations.push(newLocation);
    }

    return locations;

}


export async function gotoDefinitionText(text:string){
    let position = await gCscope.getDefinitionPositions(text);
    if(position.length > 0){
        await vscode.commands.executeCommand("edk2code.gotoFile", position[0].uri, position[0].range);
    }
    
}


export async function getDefinitionLocationsSelected(){
    let currentWord = getCurrentWord();
	if(currentWord !== undefined){
        
        // Filter results to only show files used in compilation
        let filteredLocations:vscode.Location[] = [];

        // First look using Cscope
        filteredLocations = await gCscope.getDefinitionPositions(currentWord.word);

        if(filteredLocations.length === 0){
            let allLocations:vscode.Location[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', currentWord.uri, currentWord.range.end);
            for (const loc of allLocations) {
                let isFileUsed = gEdkDatabase.isFileInuse(loc.uri.fsPath);
                if(isFileUsed){
                    filteredLocations.push(loc);
                }
            }
        }

        return filteredLocations;
    }
    return [];
}

export async function gotoDefinitionInput() {
    let currentWord = await vscode.window.showInputBox({title:"Enter symbol name"});
	if(currentWord !== undefined){
        let filteredLocations = await gCscope.getDefinitionPositions(currentWord);
        
        return await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, filteredLocations, "gotoAndPeek", "Not found");


	}
}

export async function searchCcode() {
    let currentWord = await vscode.window.showInputBox({title:"Enter regex expression"});
	if(currentWord !== undefined){
        let filteredLocations = await gCscope.search(currentWord);
        
        return await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, filteredLocations, "gotoAndPeek", "Not found");


	}
}

export async function gotoDefinition() {
    let currentWord = getCurrentWord();
	if(currentWord !== undefined){
        let filteredLocations = await  getDefinitionLocationsSelected();
        
        return await vscode.commands.executeCommand('editor.action.goToLocations', currentWord.uri, currentWord.range.end, filteredLocations, "gotoAndPeek", "Not found");
        


	}
}



export async function gotoDscDeclaration() {
    gDebugLog.verbose("gotoDscDeclaration()");

    let filePath = getOpenFilePath();


    
    let locations:vscode.Location[] = [];
    if(filePath){

        if(gEdkDatabase.isOfflineFile(filePath)){
            // Skip if source hasn't been indexed. Just make a search query
            let fileName = path.basename(filePath);
            // TODO: a more complex query can be created
            locations = await rgSearch(`--regexp ".*?${fileName}"`,[`-g *.dsc -g *.dsc.inc`]);
            
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");

            return;
        }

        let infPaths = await gEdkDatabase.findByValue(filePath, "edk2_dsc");
        for (const inf of infPaths) {
            gDebugLog.verbose(`${inf.filePath}:${inf.range.start.line}`);
            locations.push(new vscode.Location(vscode.Uri.file(inf.filePath),inf.range.start));
        }
        if(locations.length){
            
            await vscode.commands.executeCommand('editor.action.goToLocations',vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
            
            
        }else{
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showWarningMessage("Inf file not used in DSC file");
        }
    }
}

export async function gotoContexOcurrences() {
    let selectedWord = getCurrentWord();
    let selectedFile = getOpenFilePath();
    if(!selectedFile){return;}
    if(!selectedWord){return;}

    let parser = await gEdkDatabase.getParser(selectedFile);
    if(!parser){return;}
    let sources = parser.findByValueMatchChildrens(/sources/gi);
    let includeFiles = [];
    for (const source of sources) {
        includeFiles.push(source.value);
    }



    // Initiate search
    //https://github.com/microsoft/vscode/blob/9a987a1cd0d3413ffda4ed41268d9f9ee8b7565f/src/vs/workbench/contrib/search/browser/searchActions.ts#L163-L172
    let locations = await rgSearch(selectedWord.word, includeFiles);

    if(locations.length === 0){
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showWarningMessage("0 References found");
        return;
    }

    await vscode.commands.executeCommand('editor.action.goToLocations',vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
            

}

export async function gotoDscInclusion() {
    gDebugLog.verbose("gotoDscInclusion()");
    let filePath = getOpenFilePath();
    let locations:vscode.Location[] = [];
    if(filePath){

        if(gEdkDatabase.isOfflineFile(filePath)){
            // Skip if source hasn't been indexed. Just make a search query
            let fileName = path.basename(filePath);
            // TODO: a more complex query can be created
  
            locations = await rgSearch(`--regexp "!include\\s.*?${fileName}"`,[`-g *.dsc -g *.dsc.inc`]);
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");

            return;
        }

        let infPaths = await gEdkDatabase.findByValue(filePath, "edk2_dsc");
        for (const inf of infPaths) {
            gDebugLog.verbose(`${inf.filePath}:${inf.range.start.line}`);
            locations.push(new vscode.Location(vscode.Uri.file(inf.filePath),inf.range.start));
        }
        if(locations.length){
            
            await vscode.commands.executeCommand('editor.action.goToLocations',vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
            
            
        }else{
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showWarningMessage("DSC not included in other DSC file");
        }
    }
}

export async function libUsage() {
    gDebugLog.verbose("libUsage()");
    let filePath = getOpenFilePath();
    let locations:vscode.Location[] = [];
    if(filePath){
        let parser = await gEdkDatabase.getParser(filePath);
        if(!parser){return;}
        
        // Check if its library class
        let libraryClassList = parser.findByName("LIBRARY_CLASS");
        if(libraryClassList.length === 0){return;}
        let libraryClass = split(libraryClassList[0].value,"|",2)[0];

        let infPaths = await gEdkDatabase.findByValueAndProperties("libraryclasses","*","*",libraryClass, "edk2_inf");
        for (const inf of infPaths) {
            gDebugLog.verbose(`${inf.filePath}:${inf.range.start.line}`);
            locations.push(new vscode.Location(vscode.Uri.file(inf.filePath),inf.range.start));
        }
        if(locations.length){
            await vscode.commands.executeCommand('editor.action.goToLocations',vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
        }else{
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showWarningMessage("Library not found in modules inf files");
        }
    }
}

export async function gotoInf() {
    gDebugLog.verbose("gotoInf()");
    let filePath = getOpenFilePath();



    let locations:vscode.Location[] = [];
    if(filePath){

        if(gEdkDatabase.isOfflineFile(filePath)){
            // Skip if source hasn't been indexed. Just make a search query
            let fileName = path.basename(filePath);
            let folderPath = path.dirname(filePath);
            let tempLocations = await rgSearch(`\\b${fileName}\\b`,["-g *.inf", "./"]);
            for (const l of tempLocations) {
                // Check the INF file is relative to the source file
                if(!path.relative(path.dirname(l.uri.fsPath), folderPath).includes("..")){
                    locations.push(l);
                }
            }

            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");

            return;
        }

        let infPaths = await gEdkDatabase.findByValue(filePath, "edk2_inf");
        for (const inf of infPaths) {
            gDebugLog.verbose(`${inf.filePath}:${inf.range.start.line}`);
            locations.push(new vscode.Location(vscode.Uri.file(inf.filePath),inf.range.start));
        }
        if(locations.length){
            await vscode.commands.executeCommand('editor.action.goToLocations', vscode.window.activeTextEditor?.document.uri, vscode.window.activeTextEditor?.selection.active, locations, "gotoAndPeek", "Not found");
            
        }else{
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showWarningMessage("C file not found in source Inf files");
        }
    }
}

export function registerCallCommand(node:TreeItem, word:string, pos: vscode.Position, funcCallType:CallType){
    const registerdCommandString = `edk2code.functionReference${funcCallType}`;
        try {
            vscode.commands.registerCommand(registerdCommandString, async (node, word, pos, funCallTypeInner) => {
                var iconBackup = node.iconPath;
                node.iconPath = new vscode.ThemeIcon('sync~spin');
                edkLensTreeDetailProvider.refresh();
                setTimeout(async ()=>{
                    await populateNodeCall(node, word, iconBackup, funCallTypeInner);
                }, 200);
                
                await vscode.commands.executeCommand("edk2code.gotoFile", node.resourceUri, new vscode.Range(pos, pos));

            });
        } catch { }

        
        node.command = {
            title: "Open",
            command: registerdCommandString,
            arguments: [node, word, pos, funcCallType]
        };


}


export async function openFile(type:undefined|Edk2SymbolType=undefined) {

    var itemsOption: vscode.QuickPickItem[] = [];
    
    if(type=== undefined){
        var scopeFiles = gEdkDatabase.getFilesInUse();
        scopeFiles.forEach(file => {
            itemsOption.push({
                label: `$(file) ${path.basename(file)}`,
                description: file
            });
        });
    }else{
        let symbols = gEdkDatabase.findByType(type);
        let setSymbols:Set<string> = new Set();
        for (const s of symbols) {
            setSymbols.add(s.value);
        }
        for (const s of setSymbols.keys()) {
            itemsOption.push({
                label: `$(file) ${path.basename(s)}`,
                description: s
            }); 
        }
    }


    await vscode.window.showQuickPick(itemsOption, { title: "Files compiled", matchOnDescription: true, matchOnDetail: true }).then(async option => {

        if (option?.description !== undefined) {
            let openPath = getRealPath(option.description);
            await vscode.commands.executeCommand("edk2code.gotoFile", vscode.Uri.file(openPath)).then(() => {

            }
            );
        }
    });
}




export async function populateNodeCall(node: any, word: any, iconBackup: any, funcCallType:CallType) {
    if (node.children.length === 0) {
        if (funcCallType===CallType.caller){
            var callers = await gCscope.getCaller(word);
        }else{
            var callers = await gCscope.getCallee(word);
            
        }

        if (callers===undefined){
            throw new Error('No result from cscope command');
        }

        const registerdCommandString = `edk2code.functionReference${funcCallType}`;
        if (callers.length > 0) {
            for (const funcCall of callers) {
                var pos = new vscode.Position(funcCall.line, 0);
                var tempItem = new TreeItem(funcCall.name);
                tempItem.iconPath = new vscode.ThemeIcon("symbol-function");
                tempItem.command = {
                    title: "Open",
                    command: registerdCommandString,
                    arguments: [tempItem, funcCall.name, pos, funcCallType]
                };
                tempItem.description = `${funcCall.file}: ${pos.line + 1}`;
                tempItem.resourceUri = vscode.Uri.file(funcCall.file);
                tempItem.contextValue = "function";
                node.addChildren(tempItem);
            }

        }
        node.iconPath = iconBackup;
        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node.id = new Date().toString();
        edkLensTreeDetailProvider.refresh();
    } else {
        node.iconPath = iconBackup;
        edkLensTreeDetailProvider.refresh();
    }
}