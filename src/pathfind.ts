import path = require("path");
import * as fs from 'fs';
import * as vscode from 'vscode';
import glob = require("fast-glob");
import { existsEdkCodeFolderFile, getRealPathRelative, readEdkCodeFolderFile, toPosix, writeEdkCodeFolderFile } from "./utils";
import { gConfigAgent, gDebugLog, gWorkspacePath } from "./extension";

import { distance, closest } from 'fastest-levenshtein';
import { REGEX_VAR_USAGE } from "./edkParser/commonParser";

export class PathFind{

    static inProgress = false;

    extensions = [   
        ".c",
        ".h",       
    ".asl",
    ".asi",
    ".aslc",
    ".i",
    ".ii",
    ".iii",
    ".iiii",
    ".dsc",
    ".dsc.inc",
    ".dec",
    ".dec.inc",
    ".dec.template",
    ".vfr",
    ".Vfr",
    ".hfr",
    ".fdf",
    ".fdf.inc",
    ".inf",
    ".uni",
    ".nasm",
    ".asm"
];


    private missingFiles: string[] = [];

    async findPath(pathArg: string, relativePath: string|undefined = "") {
        pathArg = pathArg.replaceAll(/(\\+|\/+)/gi, path.sep);
        let ws = gWorkspacePath;
        gDebugLog.verbose(`Looking for: ${pathArg}`);
        
        // Restrict path characters
        if (pathArg.match(/[\[\]\#\%\&\{\}\<\>\*\?\!\'\@\|\‘\`\“,'"'\^]/gi)) {
            return [];
        }

        //Check that pathArg doesnt ends with a variable
        if(pathArg.match(/\$\(\s*.*?\s*\)\s*$/gi)){
            return [];
        }

        if (pathArg.length === 0) {
            return [];
        }

        if(this.missingFiles.includes(pathArg)){
            //Todo: Add job to look for the file
            return [];
        }

        if (path.isAbsolute(pathArg)) {
            if (fs.existsSync(pathArg)) {
                return this.produceLocation(pathArg);
            }
            return [];
        }

        if (relativePath) {
            if (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile()) {
                relativePath = path.dirname(relativePath);
            }
            let p = path.join(relativePath, pathArg);
            if (fs.existsSync(p)) {
                return this.produceLocation(p);
            }
        }

        if (fs.existsSync(path.join(gWorkspacePath, pathArg))) {
            return this.produceLocation(path.join(gWorkspacePath, pathArg));
        }

        // Check on workspace relative paths
        let packagePaths = gConfigAgent.getBuildPackagePaths();
        for (const relPath of packagePaths) {
            let p = path.join(relPath, pathArg);
            if (fs.existsSync(p)) {
                return this.produceLocation(p);
            }
        }





        gDebugLog.warning(`Global find: ${pathArg}`);


        let globPath = pathArg.replaceAll('/', '\\').replaceAll(REGEX_VAR_USAGE, '**');
        let paths = await vscode.workspace.findFiles(`**\\${globPath}`);
        let retPath = [];
        for (const p of paths) {
            retPath.push(new vscode.Location(vscode.Uri.file(p.fsPath), new vscode.Position(0, 0)));
            // Add dinamyc include paths
            let newPath = p.fsPath.slice(0,p.fsPath.length - pathArg.length - 1);
            gConfigAgent.pushBuildPackagePaths(getRealPathRelative(newPath));
        }

        if(retPath.length === 0){
            gDebugLog.warning(`Missing file: ${pathArg}`);
            this.missingFiles.push(path.join(relativePath, pathArg));
        }

        return retPath;

    }

    produceLocation(path:string){
        return [new vscode.Location(vscode.Uri.file(path), new vscode.Position(0, 0))];
    }


}