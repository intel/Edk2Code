import path = require("path");
import * as cp from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { gDebugLog, gWorkspacePath } from "./extension";

export function existsEdkCodeFolderFile(filename: string) {
    return fs.existsSync(path.join(gWorkspacePath, ".edkCode", filename));
}

export function createEdkCodeFolder() {
    if (!fs.existsSync(path.join(gWorkspacePath, ".edkCode"))) {
        fs.mkdirSync(path.join(gWorkspacePath, ".edkCode"));
    }
}

export function writeEdkCodeFolderFile(filename: string, text: string) {
    createEdkCodeFolder();
    if(!existsEdkCodeFolderFile(filename)){

    }
    fs.writeFileSync(path.join(gWorkspacePath, ".edkCode", filename), text);
}

/*
 * Returns the path of a filename in .edkCode folder.
*/
export function getEdkCodeFolderFilePath(filename: string) {
    //Returns the path to filename inside EdkCode folder
    return path.join(gWorkspacePath, ".edkCode", filename);
}

export function getEdkCodeFolderPath() {
    return path.join(gWorkspacePath, ".edkCode");
}

export function readEdkCodeFolderFile(filename: string) {
    let p = path.join(gWorkspacePath, ".edkCode", filename);
    if (!fs.existsSync(p)) { 
        return undefined; 
    }
    return fs.readFileSync(p).toString();
}


export function deleteEdkCodeFolderFile(filename: string) {
    let p = path.join(gWorkspacePath, ".edkCode", filename);
    fs.rmSync(p, { force: true });
}

export function deleteEdkCodeFolder() {
    let p = path.join(gWorkspacePath, ".edkCode");
    try {
        fs.rmSync(p, { recursive: true, force: true });
    } catch (error: any) {
        gDebugLog.error(`deleteEdkCodeFolder: ${error}`);
    }
    createEdkCodeFolder();
}
