import path = require("path");
import * as vscode from 'vscode';
import * as fs from 'fs';
import { gDebugLog, gWorkspacePath } from "../extension";
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

            // Cscope
            let cscopeLines = readLines(path.join(folder, "CompileInfo", "cscope.files"));

            for (const l of cscopeLines) {
                cscopeMap.set(l.toUpperCase(), l);
            }

            let commands = JSON.parse(fs.readFileSync(path.join(folder, "CompileInfo", "compile_commands.json")).toString());
            // Merge compile commands
            for (const cmd of commands) {
                compileCommands.push(cmd);
            }

            let modules = JSON.parse(fs.readFileSync(path.join(folder, "CompileInfo", "module_report.json")).toString());
            // Merge build report
            for (const mod of modules) {
                moduleReport.push(mod);
            }
        }
        let filteredCscope = "";
        for (const value of cscopeMap.values()) {
            filteredCscope += `${path.resolve(value.replaceAll("\/","\\").replace(/\n$/, ""))}\n`;
        }
        writeEdkCodeFolderFile("cscope.files", filteredCscope);
        writeEdkCodeFolderFile("module_report.json", JSON.stringify(moduleReport, null, 2));
        writeEdkCodeFolderFile("compile_commands.json", JSON.stringify(compileCommands, null, 2));
        if(compileCommands.length === 0){
            writeEdkCodeFolderFile(".missing", "");
        }
    }
}