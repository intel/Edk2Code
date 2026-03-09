import path = require("path");
import * as fs from 'fs';
import * as vscode from 'vscode';
import glob = require("fast-glob");
import { gConfigAgent, gDebugLog, gWorkspacePath } from "./extension";
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
        gDebugLog.trace(`Looking for: ${pathArg}`);
        
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
            const location = await this.findRelativePath(pathArg, relativePath);
            if(location){
                return [location];
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

        let normalizedArg = pathArg.replaceAll('\\', '/').replaceAll(REGEX_VAR_USAGE, '**');
        // Search by filename only (like Ctrl+P), then filter by path suffix
        let fileName = path.basename(pathArg);
        let paths = await vscode.workspace.findFiles(`**/${fileName}`, null);
        
        // Filter results that match the full path pattern
        let filteredPaths = paths.filter(p => {
            let normalizedFsPath = p.fsPath.replaceAll('\\', '/');
            // Build a regex from the normalized path arg, replacing ** with .*
            let patternStr = normalizedArg.replaceAll('**', '.*').replace(/[.*+?^${}()|[\]\\]/g, (m) => m === '.*' ? '.*' : '\\' + m);
            // Re-apply .* for the glob wildcards after escaping
            patternStr = normalizedArg.split('**').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
            return new RegExp(patternStr + '$', 'i').test(normalizedFsPath);
        });

        // If no filtered results but we had unfiltered results, use filename matches as fallback
        if(filteredPaths.length === 0 && paths.length > 0){
            filteredPaths = paths;
        }

        let retPath = [];
        for (const p of filteredPaths) {
            retPath.push(new vscode.Location(vscode.Uri.file(p.fsPath), new vscode.Position(0, 0)));
        }

        if(retPath.length === 0){
            gDebugLog.warning(`Missing file: ${pathArg}`);
            this.missingFiles.push(path.join(relativePath, pathArg));
        }

        return retPath;

    }

    async findRelativePath(pathArg: string, relativePath: string){
        if (relativePath) {
            if (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile()) {
                relativePath = path.dirname(relativePath);
            }
            let p = path.join(relativePath, pathArg);
            if (fs.existsSync(p)) {
                return new vscode.Location(vscode.Uri.file(p), new vscode.Position(0, 0));
            }
        }
    }

    produceLocation(path:string){
        return [new vscode.Location(vscode.Uri.file(path), new vscode.Position(0, 0))];
    }


}