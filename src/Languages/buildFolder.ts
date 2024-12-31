import path = require("path");
import * as vscode from 'vscode';
import * as fs from 'fs';
import { gCscope, gDebugLog, gWorkspacePath } from "../extension";
import { getRealPath, getRealPathRelative, normalizePath, readLines, writeEdkCodeFolderFile, split, toPosix, readEdkCodeFolderFile } from "../utils";
import glob = require("fast-glob");

export class BuildFolder {
    buildFolderPaths: string[]=[];
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
                        let edk2BuildWorkspace = this.getEdk2BuildWorkspace(path.join(buildOptionsPath, "AutoGen"));
                        // buildActivePlatform cannot access or start with current gWorkspacePath(vscode)
                        // may cause wrong relative buildActivePlatform, fix it to start with gWorkspacePath
                        if (!fs.existsSync(buildActivePlatform) || !buildActivePlatform.startsWith(gWorkspacePath)) {
                            if (edk2BuildWorkspace !== "" && buildActivePlatform.startsWith(edk2BuildWorkspace)) {
                                let fixBuildActivePlatform = buildActivePlatform.replace(edk2BuildWorkspace, gWorkspacePath);
                                if (fs.existsSync(fixBuildActivePlatform)) {
                                    gDebugLog.info(`Correct ${buildActivePlatform} to ${fixBuildActivePlatform}`);
                                    buildActivePlatform = fixBuildActivePlatform;
                                }
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

    async loadMapFiles(){
        let maplist = "";
        for (const buildPaths of this.buildFolderPaths) {
            let mapPaths = await glob.sync(toPosix(path.join(buildPaths, "**","*.map")));
            for (const m of mapPaths) {
                maplist += `${m}\n`;    
            }
        }
        writeEdkCodeFolderFile("mapFiles.txt",maplist);
    }

    copyFilesToRoot() {
        let cscopeMap = new Map();
        let moduleReport = [];
        let compileCommands:string[] = [];

        for (const folder of this.buildFolderPaths) {

            if (!fs.existsSync(path.join(folder, "CompileInfo"))) {
                continue;
            }

            let needFixCompilerInfoPath: boolean = false;
            let edk2BuildWorkspace = this.getEdk2BuildWorkspace(path.join(folder, "AutoGen"));
            if (edk2BuildWorkspace.toLowerCase() !== gWorkspacePath.toLowerCase()) {
                // if edk2BuildWorkspace still exist, means file path in CompilerInfo can access, do not replace it.
                if (edk2BuildWorkspace !== "" && !fs.existsSync(edk2BuildWorkspace)) {
                    needFixCompilerInfoPath = true;
                }
            }

            // Cscope
            let cscopeLines = readLines(path.join(folder, "CompileInfo", "cscope.files"));

            let replacePath = edk2BuildWorkspace;
            if (needFixCompilerInfoPath) {
                replacePath = gWorkspacePath;
            }
            for (const l of cscopeLines) {
                cscopeMap.set(l.toUpperCase(), l.replaceAll(edk2BuildWorkspace, replacePath));
            }

            if (needFixCompilerInfoPath) {
                replacePath = gWorkspacePath.includes('\\') ? gWorkspacePath.replace(/\\/g, '\\\\') : gWorkspacePath;;
            }
            let commands = JSON.parse(fs.readFileSync(path.join(folder, "CompileInfo", "compile_commands.json")).toString());
            // Merge compile commands
            for (const cmd of commands) {
                compileCommands.push(JSON.parse(JSON.stringify(cmd).replaceAll(edk2BuildWorkspace, replacePath)));
            }

            let modules = JSON.parse(fs.readFileSync(path.join(folder, "CompileInfo", "module_report.json")).toString());
            // Merge build report
            for (const mod of modules) {
                moduleReport.push(JSON.parse(JSON.stringify(mod).replaceAll(edk2BuildWorkspace, replacePath)));
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

    getEdk2BuildWorkspace(pathOfCurrentAutoGen: string) {
        if (fs.existsSync(pathOfCurrentAutoGen)) {
            let lines = readLines(pathOfCurrentAutoGen);
            for (let l of lines) {
                if (l.endsWith ("BuildOptions")) {
                    let match = l.match(/^(.*?)[\\/]Build[\\/]/);
                    if (match) {
                        return match[1].toString();
                    }
                }
            }
        }
        return "";
    }
}