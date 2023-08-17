import path = require("path");
import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { cwd } from "process";
import { gDebugLog, gEdkDatabase, gExtensionContext, gWorkspacePath } from "./extension";
import { TreeDetailsDataProvider, TreeItem } from "./TreeDataProvider";
import { rejects } from "assert";


var normalizeCache = new Map();

export function toPosix(textPath:string){
    return textPath.split(path.sep).join(path.posix.sep);
}

export async function execWindow(cmd:string, cwdIn:string, winText:string){
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: winText,
        cancellable: true
    }, async (progress, reject) => {
        return new Promise<string>((resolve,token)=>{
            var result =  cp.execSync(cmd, { cwd: cwdIn });
            resolve(result.toString());
        });
    });
}

export async function exec(cmd:string, cwdIn:string){
    return new Promise<string>((resolve,token)=>{
        cp.exec(cmd,{ cwd: cwdIn }, (err,out)=>{
            if(err){
                return resolve("");
            }
                return resolve(out);
        });
        // var result =  cp.execSync(cmd, { cwd: cwdIn });
        // resolve(result.toString());
    });

}

export function getCurrentWord():{word: string, range: vscode.Range, uri:vscode.Uri|undefined} {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return {word: '', range: new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)),
        uri: undefined};
    }
    const document = editor.document;
    const selection = editor.selection;
    if (!selection.isEmpty) {
        return {word: document.getText(selection), range: selection, uri:document.uri};
    }
    const range = document.getWordRangeAtPosition(selection.active);
    if (!range) {
        return {word: '', range: new vscode.Range(new vscode.Position(0,0), new vscode.Position(0,0)), uri: document.uri};
    }
    return {word: document.getText(range), range: range, uri:document.uri};
}

export function getCurrentDocument(){
    const editor = vscode.window.activeTextEditor;
    if (editor===undefined) {
        return undefined;
    }
    return editor.document;
    
}

export async function gotoFile(uri: vscode.Uri, range?: vscode.Range): Promise<void> {
    // open a document
    if(!fs.existsSync(uri.fsPath)){
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showErrorMessage(`${uri.fsPath} not found`);
        return;
    }

    let f = await vscode.workspace.openTextDocument(uri);
    let option: vscode.TextDocumentShowOptions = {
        preserveFocus: true,
        preview: true,
        selection: range,
        viewColumn: vscode.ViewColumn.Active
    };
        // open an editor
    let e = await vscode.window.showTextDocument(f, option);
}

export async function openFileSide(uri: vscode.Uri, range?: vscode.Range): Promise<void> {
    // open a document
    if(!fs.existsSync(uri.fsPath)){
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showErrorMessage(`${uri.fsPath} not found`);
        return;
    }

    let f = await vscode.workspace.openTextDocument(uri);
    let option: vscode.TextDocumentShowOptions = {
        preserveFocus: false,
        preview: true,
        selection: range,
        viewColumn: vscode.ViewColumn.Two
    };
        // open an editor
    let e = await vscode.window.showTextDocument(f, option);
}

var currentFile = "";
export function openedFilePath(){
    // Get opened file
    var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (openedFilePath === undefined) { return undefined; }
    
    if (currentFile === openedFilePath) {
        return undefined;
    }

    currentFile = openedFilePath;
    return currentFile;
}

export function getOpenFilePath(){
    // Get opened file
    var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (openedFilePath === undefined) { return undefined; }
    return openedFilePath;
}

export function getStaticPath(file: string){

    return path.join(gExtensionContext.asAbsolutePath("static"),file);
}


/*
This returns the real absolute path of inputPath with Upper and lower case.
Use this before showing some path in GUI
*/
export function getRealPath(inputPath:string){
    let fullPath = inputPath;
    if(!path.isAbsolute(fullPath)){
        fullPath = path.resolve(gWorkspacePath,fullPath);
    }
    let fullRealPath = fs.realpathSync.native(fullPath);

    // In case user is using subst. Replace workspace path
    fullRealPath = path.join(gWorkspacePath, fullRealPath.slice(fullRealPath.length-path.relative(gWorkspacePath, fullPath).length));
    return fullRealPath;
}



/*
This solves the problem where some inconsitencies in the make file are found:
signs like /, \, .. or upper/lower case paths.
Use this before doing something with a path
*/
export function normalizePath(inputPath: string):string {
    try {
        var returnPath = "";

        // As this function is expensive. Lets check if inputPath has already been resolved
        if(normalizeCache.has(inputPath)){
            return normalizeCache.get(inputPath);
        }

        let fullPath = inputPath;
        if(!path.isAbsolute(fullPath)){
            fullPath = path.resolve(gWorkspacePath,fullPath);
        }
        let nativePath = fs.realpathSync.native(fullPath);
        let substRealPath;
        // In case user is using subst. Replace workspace path
        substRealPath = path.join(gWorkspacePath, nativePath.slice(nativePath.length-path.relative(gWorkspacePath, fullPath).length));
        
        //If file doesnt exist return the native path as is
        if(!fs.existsSync(substRealPath)){
            returnPath = nativePath;
        }else{
            // subst path exist, then return subst path
            returnPath = substRealPath;
        }
    } catch (error) {
        gDebugLog.warning(`NormalizePath: ${error}`);
        returnPath = "";
    }
    normalizeCache.set(inputPath,returnPath);
    return returnPath;

}

export function pathCompare(path1:string, path2:string){
    if(normalizePath(path1) === normalizePath(path2)){
        return true;
    }
    return false;
}


export async function showVirtualFile(title:string, content:string, languageId=""){
    // Create virtual file with results
    let scheme = "untitle";
    const myProvider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
          return content;
        }
      })();
    vscode.workspace.registerTextDocumentContentProvider(scheme, myProvider);
    let uri = vscode.Uri.parse(`${scheme}:${title}`);
    let doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
    await vscode.window.showTextDocument(doc, { preview: false });
    if (languageId !== ""){
        await vscode.languages.setTextDocumentLanguage(doc, languageId);
    }
    
}



function _copyTreeProviderToClipboardRecursive(item: TreeItem, deep:number, result:any){
    result["content"]+=`${" ".repeat(deep)}${item.label}: ${item.description}\n`;
    for (const nextItem of item.children) {
        _copyTreeProviderToClipboardRecursive(nextItem, deep + 1, result);
    }

}

export async function copyTreeProviderToClipboard(treeProvider:TreeDetailsDataProvider){
    let result = {"content":""};
    for (const items of <TreeItem[]>treeProvider.getChildren()) {
        _copyTreeProviderToClipboardRecursive(items, 0, result);
    }
    await vscode.env.clipboard.writeText(result["content"]);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage("Data copied to clipboard"); 
}




export function isWorkspacePath(p:string){
    return !path.relative(gWorkspacePath, p).includes("..");
}

export function split(text:string, sepparator:string, limit:number, defaultValue:string=""){
    let temp = text.split(sepparator).map((x)=>{return x.trim();});
    let sText:string[] = [];
    for (const x of temp) {
        if(x.length === 0){continue;}
        sText.push(x);
    }

     
    
    // If length its correct
    if(sText.length === limit){return sText;}
    
    if(sText.length > limit){
        // limit length    
        let a = sText.slice(limit-1).join(sepparator);
        let x = [...sText.slice(0,limit-1),...[a]];
        return x;
    }

    // Extend length 
    let pending = limit - sText.length;
    let arr = new Array(pending).fill(defaultValue);
    return [...sText,...arr];

}


export function readLines(filePath:string){
    if(!fs.existsSync(filePath)){
        gDebugLog.warning(`readlines: File doesnt exist: ${filePath}`);
        return [];
    }
    return fs.readFileSync(filePath).toString().split(/\r?\n/);
}

export function readFile(filePath:string){
    return fs.readFileSync(filePath).toString();
}


/*
This returns the real absolute path of inputPath with Upper and lower case.
Use this before showing some path in GUI
*/
export function getRealPathRelative(inputPath:string){
    inputPath = getRealPath(inputPath);
    return path.relative(gWorkspacePath,inputPath);
}

export function makeRelativeToWs(filePath:string){
    if(!path.isAbsolute(filePath)){
        return filePath;
    }
    return getRealPathRelative(filePath);
}

export async function runWithProgress(title:string, func:Function){
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: true
            }, async (progress, reject) => {
                let data = await func();
                return data;
            });
}

export function createRange(lineStart:number=0, lineEnd:number=0, endLength:number=0){
    return new vscode.Range(
        new vscode.Position(lineStart,0), 
        new vscode.Position(lineEnd,endLength)
    );
    
}

export var pcdRegexMatch = /(?:\w[\w\d\[\]]+\.)+[\w\d\[\]]+/gi;
export var pcdRegexLineMatch = /(?:^\w[\w\d\[\]]+\.)+[\w\d\[\]]+/gi;
export function itsPcdSelected(document:vscode.TextDocument, position: vscode.Position){
    let pcdRange = document.getWordRangeAtPosition(position,pcdRegexMatch);
    if(pcdRange){
      let pcd = document.getText(pcdRange).trim();
      let [namespace, name] = split(pcd,".",2);

      let pcdsList = gEdkDatabase.pcdDefinitions.get(namespace);
      if(pcdsList){
        let resultPcd = pcdsList.get(name);
        if(resultPcd){
          return resultPcd;
        }
      }
    }
    return undefined;
}

export function writeEdkCodeFolder(filename:string, text:string){
    if(!fs.existsSync(path.join(gWorkspacePath, ".edkCode"))){
        fs.mkdirSync(path.join(gWorkspacePath,".edkCode"));
    }
    console.log(path.join(gWorkspacePath, ".edkCode", filename));
    fs.writeFileSync(path.join(gWorkspacePath, ".edkCode", filename),text);
}

export function readEdkCodeFolder(filename:string){
    let p = path.join(gWorkspacePath, ".edkCode",filename);
    if(!fs.existsSync(p)){return undefined;}
    return fs.readFileSync(p).toString();
}

export function deleteEdkCodeFolder(){
    let p = path.join(gWorkspacePath, ".edkCode");
    fs.rmSync(p,{recursive:true, force:true});
}