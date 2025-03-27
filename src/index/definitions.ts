import { REGEX_VAR_USAGE } from "../edkParser/commonParser";
import { gConfigAgent, gDebugLog } from "../extension";
import * as vscode from 'vscode';
import { split } from "../utils";

export const UNDEFINED_VARIABLE = "???";


export interface EdkDefinition {
    name:string;
    value:string
    location:vscode.Location|undefined;
}

export class WorkspaceDefinitions {
    defines:Map<string,EdkDefinition>;
    

    private static instance: WorkspaceDefinitions;

    public static getInstance(): WorkspaceDefinitions {
        if (!WorkspaceDefinitions.instance) {
            WorkspaceDefinitions.instance = new WorkspaceDefinitions();
        }
        return WorkspaceDefinitions.instance;
    }

    resetDefines(){
        let buildDefines = new Map(gConfigAgent.getBuildDefines());
        this.defines = new Map();
        // Clean empty definitions
        for (const [key,value] of buildDefines.entries()) {
            if(value.length > 0){
                this.defines.set(key, {name: key, value:value, location:undefined});
            }
        }
        
    }

    getDefinitions(){
        return this.defines;
    }

    getDefinition(key:string){
        let val = this.defines.get(key);
        if(val){
            return val.value;
        }
        return undefined;
    }

    getDefinitionLocation(key:string){
        let val = this.defines.get(key);
        if(val){
            return val.location;
        }
        return undefined;
    }

    setDefinition(key:string, value:string, location:vscode.Location|undefined){
        gDebugLog.trace(`setDefinition: ${key} = ${value}`);
        this.defines.set(key, {name: key, value:value, location:location});
    }

    constructor() {
        this.defines = new Map();
    }

    isDefined(text:string){
        return this.defines.has(text);
    }

    replaceDefines(text: string) {
        let replaced = false;
        let maxIterations = 10;
        do {
            
            maxIterations --;
            
            if(maxIterations <= 0){
                gDebugLog.error(`Max iterations reached: ${text}`);
                return text;
            }

            replaced = false;
            for (const [key,value] of this.defines.entries()) {
                if(text.includes(`$(${key})`)){
                    replaced = true;
                    let replacement;
                    if(value.value.toLowerCase() === "true"){
                        replacement = "TRUE";
                    }else if(value.value.toLowerCase() === "false"){
                        replacement = "FALSE";
                    }else if(isNaN(parseInt(value.value))){
                        replacement = `"${value.value}"`;
                    }else{
                        replacement = value.value;
                    }
                    

                    text = text.replaceAll(`$(${key})`, replacement);
                }
            }

        }while(replaced === true);
        // remove undefined variable
        // text = text.replaceAll(REGEX_VAR_USAGE, UNDEFINED_VARIABLE);
        return text;
    }
}