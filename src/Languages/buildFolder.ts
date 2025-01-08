import path = require("path");
import * as vscode from 'vscode';
import * as fs from 'fs';
import { gCscope, gDebugLog, gWorkspacePath } from "../extension";
import { getRealPath, getRealPathRelative, isWorkspacePath, normalizePath, readLines, split, toPosix } from "../utils";
import glob = require("fast-glob");
import { writeEdkCodeFolderFile } from "../edk2CodeFolder";

export class BuildFolder {
    buildFolderPaths: string[]=[];
    replaceWorkspacePath: string|undefined;

    constructor(folderPath: string[]) {
        this.buildFolderPaths = folderPath;
    }

    

    async getBuildInfo() {
        if (fs.existsSync(path.join(this.buildFolderPaths[0], "BuildOptions"))) {
            return await this.getBuildOptions();
        }
    }

    /**
    * looks for EDK2 `BuildOptions` file and parses it.
    * It sets `buildDefines` and `activeDscFiles`
    * @param buildOptionsPath Build path were EDK2 compilation was generated
    */
    async getBuildOptions() {
        try {
            gDebugLog.verbose("getBuildOptions()");
            // todo: change for multiple build folders
            let buildDefines: Map<string, string> = new Map();
            let dscFiles:Set<string> = new Set();
            
            for (const buildOptionsPath of this.buildFolderPaths) {
                let lines = readLines(path.join(buildOptionsPath, "BuildOptions"));
                for (let l of lines) {
                    if (l.startsWith("gCommandLineDefines")) {
                        l = l.replace("gCommandLineDefines: ", "").replace("{", "").replace("}", "").replaceAll("'", "");

                        for (const buildOption of l.split(",")) {
                            let [val, data] = split(buildOption, ":", 2);
                            gDebugLog.verbose(`Define: ${val}: ${data}`);
                            buildDefines.set(val.trim(), data.trim());
                        }
                    }

                    if (l.startsWith("Active Platform: ")) {
                        let buildActivePlatform: string = split(l, ":", 2)[1].trim();
                        
                        if(!fs.existsSync(buildActivePlatform) && !isWorkspacePath(buildActivePlatform)){
                            gDebugLog.warning(`Active platform Build "${buildActivePlatform}" is not in current Vscode workspace folder "${gWorkspacePath}"`);
                            const oldWorkspacePath = this.findBuildWorkspacePath(buildActivePlatform);
                            if (oldWorkspacePath) {
                                const newBuildActivePlatform = path.normalize(buildActivePlatform).replace(oldWorkspacePath, gWorkspacePath);
                                if (fs.existsSync(newBuildActivePlatform)) {
                                    buildActivePlatform = newBuildActivePlatform;
                                    gDebugLog.verbose(`Corrected Active platform: ${buildActivePlatform}`);
                                    if(this.replaceWorkspacePath !== undefined && this.replaceWorkspacePath !== oldWorkspacePath){
                                        gDebugLog.error(`Multiple original workspace paths found: ${this.replaceWorkspacePath} and ${oldWorkspacePath}`);
                                    }
                                    this.replaceWorkspacePath = oldWorkspacePath;
                                } else {
                                    gDebugLog.error(`Active build platform not found: ${newBuildActivePlatform}`);
                                }

                            } else{
                                gDebugLog.warning(`Old workspace path not found for: ${buildActivePlatform}`);
                            }
                        }

                        buildActivePlatform = getRealPathRelative(buildActivePlatform);
                        gDebugLog.verbose(`Active platform: ${buildActivePlatform}`);
                        dscFiles.add(buildActivePlatform);
                    }
                }
            }
            return { buildDefines: buildDefines, dscFiles: Array.from(dscFiles) };
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            vscode.window.showErrorMessage(String(error));
            throw new Error(String(error));
        }
    }

    findBuildWorkspacePath(wrongPath:string){
        const wrongPathParts = wrongPath.split(/[\\/]/);
        let oldPathWorkspace = [];
        while(wrongPathParts.length > 0){
            const testPath = path.join(gWorkspacePath, ...wrongPathParts);
            if(fs.existsSync(testPath)){
                return oldPathWorkspace.join(path.sep);
            }
            const part = wrongPathParts.shift();
            oldPathWorkspace.push(part);
            gDebugLog.verbose(`Removed part: ${part}`);
        }
        return undefined;
    }

    async copyMapFilesList(){
        let maplist = [];
        for (const buildPaths of this.buildFolderPaths) {
            let mapPaths = glob.sync(toPosix(path.join(buildPaths,"**","OUTPUT","*.map")));
            for (const m of mapPaths) {
                maplist.push(m);    
            }
        }
        writeEdkCodeFolderFile("mapFiles.json",JSON.stringify(maplist, null, 2));
    }

    replaceOldWorkspacePath(p:string){
        if(this.replaceWorkspacePath !== undefined){
            return path.normalize(p).replace(this.replaceWorkspacePath, gWorkspacePath);
        }
        return p;
    }

    copyCompileInfoToRoot() {
        let cscopeMap = new Map();
        let moduleReport = [];
        let compileCommands:string[] = [];

        for (const folder of this.buildFolderPaths) {

            if (!fs.existsSync(path.join(folder, "CompileInfo"))) {
                continue;
            }

            // Cscope
            let cscopeLines = readLines(path.join(folder, "CompileInfo", "cscope.files"));

            for (const l of cscopeLines) {
                cscopeMap.set(l.toUpperCase(), this.replaceOldWorkspacePath(l));
            }


            let compileInfoText = fs.readFileSync(path.join(folder, "CompileInfo", "compile_commands.json")).toString();
            let modulesText = fs.readFileSync(path.join(folder, "CompileInfo", "module_report.json")).toString();

            if(this.replaceWorkspacePath!==undefined){
                // make path json compatible
                const jsonReplacePath = this.replaceWorkspacePath.replaceAll(/\\/g, "\\\\").replaceAll("/", "\\/");
                const jsonWorkspacePath = gWorkspacePath.replaceAll(/\\/g, "\\\\").replaceAll("/", "\\/");
                compileInfoText = compileInfoText.replaceAll(jsonReplacePath, jsonWorkspacePath);
                modulesText = modulesText.replaceAll(jsonReplacePath, jsonWorkspacePath);
            }

            let commands = JSON.parse(compileInfoText);
            // Merge compile commands
            for (const cmd of commands) {
                compileCommands.push(cmd); 
            }

            // Merge build report
            let modules = JSON.parse(modulesText);
            for (const mod of modules) {
                    moduleReport.push(mod);
            }
        }
        let filteredCscope = [];
        for (const value of cscopeMap.values()) {
            try {
                filteredCscope.push(value.replace(/\n$/, ""));     
            } catch (error) {
                
            }

        }
        
        gCscope.writeCscopeFile(filteredCscope);
        writeEdkCodeFolderFile("module_report.json", JSON.stringify(moduleReport, null, 2));
        writeEdkCodeFolderFile("compile_commands.json", JSON.stringify(compileCommands, null, 2));
        if(compileCommands.length === 0){
            writeEdkCodeFolderFile(".missing", "");
        }
    }
}