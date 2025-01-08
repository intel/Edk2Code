import path = require("path");
import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { cwd } from "process";
import { gCompileCommands, gDebugLog, gEdkWorkspaces, gExtensionContext, gWorkspacePath } from "./extension";
import { TreeDetailsDataProvider } from "./TreeDataProvider";
import { rejects } from "assert";
import { REGEX_PCD } from "./edkParser/commonParser";
import { TreeItem } from "./treeElements/TreeItem";


var normalizeCache = new Map();

export function toPosix(textPath: string) {
    return textPath.split(path.sep).join(path.posix.sep);
}

export async function execWindow(cmd: string, cwdIn: string, winText: string) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: winText,
        cancellable: true
    }, async (progress, reject) => {
        return new Promise<string>((resolve, token) => {
            var result = cp.execSync(cmd, { cwd: cwdIn });
            resolve(result.toString());
        });
    });
}

export async function exec(cmd: string, cwdIn: string) {
    return new Promise<string>((resolve, token) => {
        cp.exec(cmd, { cwd: cwdIn, maxBuffer: undefined }, (err, out) => {
            if (err) {
                gDebugLog.error(err.stack!);
                return resolve("");
            }
            return resolve(out);
        });
        // var result =  cp.execSync(cmd, { cwd: cwdIn });
        // resolve(result.toString());
    });

}

export async function documentGetText(uri:vscode.Uri,range:vscode.Range){
    let document = await openTextDocument(uri);
    return document.getText(range);
}

export function documentGetTextSync(uri: vscode.Uri, range: vscode.Range): string {
    const documentPath = uri.fsPath;
    const documentContent = fs.readFileSync(documentPath, 'utf-8');

    const start = documentContent.split('\n').slice(0, range.start.line).join('\n').length + range.start.character;
    const end = documentContent.split('\n').slice(0, range.end.line).join('\n').length + range.end.character;

    return documentContent.substring(start, end);
}

export function getCurrentWord(): { word: string, range: vscode.Range, uri: vscode.Uri | undefined } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return {
            word: '', range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            uri: undefined
        };
    }
    const document = editor.document;
    const selection = editor.selection;
    if (!selection.isEmpty) {
        return { word: document.getText(selection), range: selection, uri: document.uri };
    }
    const range = document.getWordRangeAtPosition(selection.active);
    if (!range) {
        return { word: '', range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), uri: document.uri };
    }
    return { word: document.getText(range), range: range, uri: document.uri };
}

export function getCurrentDocument() {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return undefined;
    }
    return editor.document;
}

export function getCurrentDocumentFilePath() {
    let document = getCurrentDocument();
    if (document) {
        if (document.uri.fsPath) {
            if (fs.existsSync(document.uri.fsPath)) {
                return document.uri.fsPath;
            }
        }
    }
    return undefined;
}

export async function gotoFile(uri: vscode.Uri, range?: vscode.Range): Promise<void> {
    // open a document
    if (!fs.existsSync(uri.fsPath)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showErrorMessage(`${uri.fsPath} not found`);
        return;
    }

    let f = await openTextDocument(uri);
    let option: vscode.TextDocumentShowOptions = {
        preserveFocus: true,
        preview: true,
        selection: range,
        viewColumn: vscode.ViewColumn.Active
    };
    // open an editor
    let e = await vscode.window.showTextDocument(f, option);
}

export async function openTextDocumentInRange(uri: vscode.Uri, range: vscode.Range) {
    let f = await openTextDocument(uri);
    let option: vscode.TextDocumentShowOptions = {
        preserveFocus: false,
        preview: true,
        selection: range,
        viewColumn: vscode.ViewColumn.Active
    };
    // open an editor
    let e = await vscode.window.showTextDocument(f, option);

}

export async function openFileSide(uri: vscode.Uri, range?: vscode.Range): Promise<void> {
    // open a document
    if (!fs.existsSync(uri.fsPath)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showErrorMessage(`${uri.fsPath} not found`);
        return;
    }

    let f = await openTextDocument(uri);
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
export function openedFilePath() {
    // Get opened file
    var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (openedFilePath === undefined) { return undefined; }

    if (currentFile === openedFilePath) {
        return undefined;
    }

    currentFile = openedFilePath;
    return currentFile;
}

export function getOpenFilePath() {
    // Get opened file
    var openedFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (openedFilePath === undefined) { return undefined; }
    return openedFilePath;
}

export function getStaticPath(file: string) {

    return path.join(gExtensionContext.asAbsolutePath("static"), file);
}


/*
This returns the real absolute path of inputPath with Upper and lower case.
Use this before showing some path in GUI
*/
export function getRealPath(inputPath: string) {
    let fullPath = inputPath;
    if (!path.isAbsolute(fullPath)) {
        fullPath = path.resolve(gWorkspacePath, fullPath);
    }
    if (!fs.existsSync(fullPath)) {
        return "";
    }
    let fullRealPath = fs.realpathSync.native(fullPath);

    // In case user is using subst. Replace workspace path
    fullRealPath = path.join(gWorkspacePath, fullRealPath.slice(fullRealPath.length - path.relative(gWorkspacePath, fullPath).length));
    return fullRealPath;
}



/*
This solves the problem where some inconsistencies in the make file are found:
signs like /, \, .. or upper/lower case paths.
Use this before doing something with a path
*/
export function normalizePath(inputPath: string): string {
    try {
        var returnPath = "";

        // As this function is expensive. Lets check if inputPath has already been resolved
        if (normalizeCache.has(inputPath)) {
            return normalizeCache.get(inputPath);
        }

        let fullPath = inputPath;
        if (!path.isAbsolute(fullPath)) {
            fullPath = path.resolve(gWorkspacePath, fullPath);
        }
        let nativePath = fs.realpathSync.native(fullPath);
        let substRealPath;
        // In case user is using subst. Replace workspace path
        substRealPath = path.join(gWorkspacePath, nativePath.slice(nativePath.length - path.relative(gWorkspacePath, fullPath).length));

        //If file doesnt exist return the native path as is
        if (!fs.existsSync(substRealPath)) {
            returnPath = nativePath;
        } else {
            // subst path exist, then return subst path
            returnPath = substRealPath;
        }
    } catch (error) {
        gDebugLog.warning(`NormalizePath: ${error}`);
        returnPath = "";
    }
    normalizeCache.set(inputPath, returnPath);
    return returnPath;

}

export function pathCompare(path1: string, path2: string) {
    if (normalizePath(path1) === normalizePath(path2)) {
        return true;
    }
    return false;
}


export async function createVirtualFile(title: string, content: string, languageId = "") {
    let scheme = "untitle";
    const myProvider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
            return content;
        }
    })();
    vscode.workspace.registerTextDocumentContentProvider(scheme, myProvider);
    let uri = vscode.Uri.parse(`${scheme}:${title}`);
    let doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
    return doc;
}

export async function showVirtualFile(title: string, content: string, languageId = "") {

    let doc = await createVirtualFile(title, content, languageId);
    await vscode.window.showTextDocument(doc, { preview: false });
    if (languageId !== "") {
        await vscode.languages.setTextDocumentLanguage(doc, languageId);
    }
}

export async function openTextDocument(uri: vscode.Uri) {
    try {
        let f = await vscode.workspace.openTextDocument(uri);
        return f;
    } catch (error) {

        gDebugLog.error(String(error));
        return await createVirtualFile("error", "");
    }


}



function _copyTreeProviderToClipboardRecursive(item: TreeItem, deep: number, result: any) {
    result["content"] += `${" ".repeat(deep)}${item.toString()}\n`;
    for (const nextItem of item.children) {
        _copyTreeProviderToClipboardRecursive(nextItem, deep + 1, result);
    }

}

export async function copyTreeProviderToClipboard(treeProvider: TreeDetailsDataProvider) {
    let result = { "content": "" };
    for (const items of <TreeItem[]>treeProvider.getChildren()) {
        _copyTreeProviderToClipboardRecursive(items, 0, result);
    }
    await copyToClipboard(result["content"]);
    
}

export async function copyToClipboard(data:string, message:string="Data copied to clipboard"){
    await vscode.env.clipboard.writeText(data);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage("📋" + " " + message);
}




export function isWorkspacePath(p: string) {
    let x = gWorkspacePath;
    console.log(path.relative(gWorkspacePath, p));
    const relativePath = path.relative(gWorkspacePath, p);
    return !relativePath.includes("..") && relativePath !== p;
}

export function trimSpaces(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

export function split(text: string, sepparator: string, limit: number, defaultValue: string = "") {
    let temp = text.split(sepparator).map((x) => { return x.trim(); });
    let sText: string[] = [];
    for (const x of temp) {
        if (x.length === 0) { continue; }
        sText.push(x);
    }



    // If length its correct
    if (sText.length === limit) { return sText; }

    if (sText.length > limit) {
        // limit length
        let a = sText.slice(limit - 1).join(sepparator);
        let x = [...sText.slice(0, limit - 1), ...[a]];
        return x;
    }

    // Extend length
    let pending = limit - sText.length;
    let arr = new Array(pending).fill(defaultValue);
    return [...sText, ...arr];

}

/**
 * Fetches all symbols from a given file.
 *
 * @param fileUri - The URI of the file from which to retrieve symbols.
 * @returns A promise that resolves to an array of DocumentSymbol objects representing the symbols in the file.
 * @throws An error if the document cannot be opened or symbols cannot be fetched.
 */
export async function getAllSymbols(fileUri: vscode.Uri) {
    const document = await vscode.workspace.openTextDocument(fileUri);
    if (document) {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            fileUri
        );
        return symbols || [];
    }
    return [];
}


export async function getSymbolAtLocation(uri: vscode.Uri, location: vscode.Location): Promise<vscode.DocumentSymbol | undefined> {
    const symbols = await getAllSymbols(uri);
    let returnSymbol = undefined;
    for (const symbol of symbols) {
        if (symbol.range.intersection(location.range)) {
            returnSymbol = symbol;
        }
    }

    return returnSymbol;
}

export async function readLinesAsync(filePath: string) {
    return new Promise<string[]>((resolve, token) => {
        gDebugLog.debug(`readLines: ${filePath}`);
        filePath = getRealPath(filePath);
        if (!fs.existsSync(filePath)) {
            gDebugLog.warning(`readlines: File doesnt exist: ${filePath}`);
            resolve([]);
        }

        let data = fs.readFileSync(filePath).toString().split(/\r?\n/);
        resolve(data);
    }
    );

}


export function readLines(filePath: string) {
    gDebugLog.debug(`readLines: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        gDebugLog.warning(`readlines: File doesnt exist: ${filePath}`);
        return [];
    }

    return fs.readFileSync(filePath).toString().split(/\r?\n/);
}

export function readFile(filePath: string) {
    return fs.readFileSync(filePath).toString();
}


/*
This returns the real absolute path of inputPath with Upper and lower case.
Use this before showing some path in GUI
*/
export function getRealPathRelative(inputPath: string) {
    inputPath = getRealPath(inputPath);
    return path.relative(gWorkspacePath, inputPath);
}

export function makeRelativeToWs(filePath: string) {
    if (!path.isAbsolute(filePath)) {
        return filePath;
    }
    return getRealPathRelative(filePath);
}

export async function runWithProgress(title: string, func: Function) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: title,
        cancellable: true
    }, async (progress, reject) => {
        let data = await func();
        return data;
    });
}

export function createRange(lineStart: number = 0, lineEnd: number = 0, endLength: number = 0) {
    return new vscode.Range(
        new vscode.Position(lineStart, 0),
        new vscode.Position(lineEnd, endLength)
    );

}

export async function itsPcdSelected(document: vscode.TextDocument, position: vscode.Position) {
    let pcdRange = document.getWordRangeAtPosition(position, REGEX_PCD);
    if (pcdRange) {
        let pcd = document.getText(pcdRange).trim();
        let [namespace, name] = split(pcd, ".", 2);
        let wps = await gEdkWorkspaces.getWorkspace(document.uri);
        if (wps.length) {
            for (const wp of wps) {
                let pcdsList = wp.getPcds(namespace);
                if (pcdsList === undefined) { continue; }
                let resultPcd = pcdsList.get(name);
                if (resultPcd) {
                    return resultPcd;
                }
            }
        }
    }
}




var profileStartTime: number;
var profileEndTime: number;
export function profileStart() {
    profileStartTime = new Date().getTime();
    console.log("PROFILE START");
}

export function profileEnd() {
    profileEndTime = new Date().getTime();
    let diff = profileEndTime - profileStartTime;
    console.log(`PROFILE END: ${diff}`);
}


export async function closeFileIfOpened(filePath: string) {
    const openEditors = vscode.window.visibleTextEditors;
    for (const editor of openEditors) {
        if (editor.document.uri.fsPath === filePath) {
            await vscode.window.showTextDocument(editor.document);
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            break;
        }
    }
}


export function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}




export async function isFileEdkLibrary(uri: vscode.Uri) {
    let thisDocument = await openTextDocument(uri);
    if (thisDocument.languageId !== "edk2_inf") {
        gDebugLog.error(`isAlibrary: ${uri.fsPath} is not a INF file`);
        return false;
    }

    if (thisDocument.getText().match(/^\s*library_class\s*=/gmi)) {
        return true;
    }
    return false;
}


/**
 * Retrieves a list of files in the specified directory.
 * @param {string} dir - The directory to search for files.
 * @returns {Promise<string[]>} The list of file paths.
 */
export async function listFiles(dir: string): Promise<string[]> {
    const files = fs.readdirSync(dir);
    let filelist: string[] = [];
    for (const file of files) {
        const filepath = path.join(dir, file);
        filelist.push(filepath);
    }
    return filelist;
}

/**
 * Recursively list all files in a directory.
 *
 * @param {string} dir - The directory to start listing files from.
 * @returns {Promise<string[]>} - An array of file paths.
 */
export async function listFilesRecursive(dir: string): Promise<string[]> {
    const files = fs.readdirSync(dir);
    let filelist: string[] = [];
    let baseDir = "";

    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);

        if (stat.isDirectory()) {
            filelist = await _walk(filepath, path.basename(filepath), filelist);
        } else {
            filelist.push(path.join(baseDir, file));
        }
    }

    return filelist;
}

async function _walk(dir: string, baseDir: string, filelist: string[] = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);

        if (stat.isDirectory()) {
            filelist = await _walk(filepath, path.basename(filepath), filelist);
        } else {
            filelist.push(path.join(baseDir, file));
        }
    }
    return filelist;
}

