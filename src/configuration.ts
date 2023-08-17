import path = require('path');
import * as vscode from 'vscode';
import { gEdkDatabase, gWorkspacePath } from './extension';
import * as fs from 'fs';
import { LogLevel } from './debugLog';

export class ConfigAgent {

    public loadedConfiguration:vscode.WorkspaceConfiguration;

    public constructor() {
        this.loadedConfiguration = vscode.workspace.getConfiguration('edk2code');        
        vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this);

    }

    updateConfiguration() {
        this.loadedConfiguration = vscode.workspace.getConfiguration('edk2code');
    }

    get(option:string){
        return this.loadedConfiguration.get(option);
    }

    async set(option:string, value:any){
        await this.loadedConfiguration.update(option,value);
    }

    getLogLevel():LogLevel{
        let logLevel:string = <string>this.get("logLevel");
        switch (logLevel) {
            case "None":
                return LogLevel.none;
            case "Error":
                return LogLevel.error;
            case "Warning":
                return LogLevel.warning;
            case "Info":
                return LogLevel.info;
            case "Verbose":
                return LogLevel.verbose;
            default:
                return LogLevel.none;
                break;
        }
    }

    async setBuildDefines(name:string, value:string){
        let buildDefines:string[] = <string[]>this.get("buildDefines");
        let toSave:string[]=[];
        for (const def of buildDefines) {
            if(!def.startsWith(`${name}=`)){
                toSave.push(def);
            }
        }
        toSave.push(`${name}=${value.trim()}`);
        await this.set("buildDefines",toSave);

    }

    getBuildDefines(){
        let buildDefines:string[] = <string[]>this.get("buildDefines");

        let buildDefinesObj:Map<string,string> = new Map();
        for (const def of buildDefines) {
            if(def.includes("=")){
                let values = def.split("=");
                if(values.length !==2){continue;}
                buildDefinesObj.set(values[0].trim(),values[1].trim());
            }else{
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(`Malformed define in seeting: "${def}"`);
            }
        }
        return buildDefinesObj;
    }

    getBuildPackagePaths(){
        return <string[]>this.get("buildPackagePaths");
    }

    getBuildDscPaths(){
        return <string[]>this.get("mainDscFile");
    }

    getIsGenIgnoreFile(){
        return <boolean>this.get("generateIgnoreFile");
    }

    getIsShowLanguageWarnings(){
        return <boolean>this.get("showEdk2LanguageWarnings");
    }

    getIsDimmUnusedLibraries(){
        return <boolean>this.get("dimUnusedLibraries");
    }

    async setDimmUnusedLibraries(value:boolean){
        await this.set("dimUnusedLibraries",value);
    }

    async saveBuildConfig(){
        let savePath = await vscode.window.showSaveDialog({defaultUri:vscode.Uri.file(gWorkspacePath),
            filters:{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Json': ['json'],
            },});
        if(savePath){
            let packages = this.getBuildPackagePaths();
            let dscs = this.getBuildDscPaths();
            let defines = this.getBuildDefines();
            
            let definesList = [];
            for (const [key,value] of defines) {
             definesList.push(`${key}=${value}`);   
            }
             

            let object = {
                "includePaths":packages,
                "dscs": dscs,
                "defines":definesList
            };
            fs.writeFileSync(savePath.fsPath,JSON.stringify(object,null,2));
        }
    }

    async loadBuildConfig(){
        let openPath = await vscode.window.showOpenDialog({defaultUri:vscode.Uri.file(gWorkspacePath),
            filters:{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Json': ['json'],
            },});
        if(openPath){
            try {
                let object = JSON.parse(fs.readFileSync(openPath[0].fsPath).toString());
                if(object.defines === undefined ||
                    object.dscs === undefined ||
                    object.includePaths === undefined){
                        throw new Error("Invalid configuration file");
                    }
                await this.set("buildDefines",object.defines);
                await this.set("mainDscFile",object.dscs);
                await this.set("buildPackagePaths",object.includePaths);
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                vscode.window.showErrorMessage(String(error));
                return;
            }
            
        }
        let settings = gEdkDatabase.getSettings();
        gEdkDatabase.setInputBuildDefines(settings.defines);
		gEdkDatabase.setPackagesPaths(settings.includes);
		await gEdkDatabase.load(settings.dscFiles);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showInformationMessage("Configuration loaded");
    }

}