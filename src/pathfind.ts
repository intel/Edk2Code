import path = require("path");
import * as fs from 'fs';
import * as vscode from 'vscode';
import glob = require("fast-glob");
import { gConfigAgent, gDebugLog, gWorkspacePath } from "./extension";
import { REGEX_VAR_USAGE } from "./edkParser/commonParser";
import { toPosix } from "./utils";

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


    private missingPaths: string[] = [];

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

        if(this.isKnownMissing(pathArg)){
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
            this.addMissingPath(pathArg);
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

    /**
     * Check if pathArg (or any of its parent segments) is already known to be missing.
     */
    private isKnownMissing(pathArg: string): boolean {
        const normalized = toPosix(pathArg);
        return this.missingPaths.some(missing => {
            return normalized === missing || normalized.startsWith(missing + '/');
        });
    }

    /**
     * Walk up parent directories of pathArg and find the highest-level
     * directory that doesn't exist in the workspace or package paths.
     * Cache that root so all future lookups under it are skipped.
     */
    private addMissingPath(pathArg: string): void {
        // Don't add if already covered by an existing missing path
        if (this.isKnownMissing(pathArg)) {
            return;
        }

        const posixPath = toPosix(pathArg);
        const parts = posixPath.split('/');
        let missingRoot = posixPath;

        // Walk from the top-level segment downward; find the first parent that
        // does NOT exist anywhere, and cache that instead of the full path.
        for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join(path.sep);
            if (!this.parentExistsInWorkspace(parentPath)) {
                missingRoot = parentPath;
                break;
            }
        }

        gDebugLog.trace(`Caching missing path: ${missingRoot}`);
        this.missingPaths.push(toPosix(missingRoot));
    }

    /**
     * Check whether a relative directory exists under the workspace root
     * or any of the configured package paths.
     */
    private parentExistsInWorkspace(parentPath: string): boolean {
        if (fs.existsSync(path.join(gWorkspacePath, parentPath))) {
            return true;
        }
        const packagePaths = gConfigAgent.getBuildPackagePaths();
        for (const relPath of packagePaths) {
            if (fs.existsSync(path.join(relPath, parentPath))) {
                return true;
            }
        }
        return false;
    }

    produceLocation(path:string){
        return [new vscode.Location(vscode.Uri.file(path), new vscode.Position(0, 0))];
    }


}