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
    private buildOverrides = new Map<string, string>();

    private static instance: WorkspaceDefinitions;

    public static getInstance(): WorkspaceDefinitions {
        if (!WorkspaceDefinitions.instance) {
            WorkspaceDefinitions.instance = new WorkspaceDefinitions();
        }
        return WorkspaceDefinitions.instance;
    }

    resetDefines(){
        // Build overrides have precedence over definitions in source files
        this.buildOverrides = new Map(
            [...gConfigAgent.getBuildDefines()]
                .filter(([, value]) => value.length > 0)
        );
        this.defines = new Map();
    }

    getDefinitions(): Map<string, EdkDefinition> {
        const definitions = new Map(this.defines);
        for (const [name, value] of this.buildOverrides) {
            definitions.set(name, {name, value, location: undefined});
        }
        return definitions;
    }

    getDefinition(key:string){
        return this.buildOverrides.get(key) ?? this.defines.get(key)?.value;
    }

    getDefinitionLocation(key:string){
        if (this.buildOverrides.has(key)) {
            return undefined;
        }
        return this.defines.get(key)?.location;
    }

    getSourceDefinition(key:string){
        return this.defines.get(key);
    }

    isBoolean(value:string){
        value = value.toLowerCase();
        return value === "true" || value === "false";
    }

    setDefinition(key:string, value:string, location:vscode.Location|undefined) {
        // Expand any existing definitions referenced in the value
        value = this.replaceDefines(value);

        gDebugLog.trace(`setDefinition: ${key} = ${value}`);
        this.defines.set(key, {name: key, value:value, location:location});
    }

    constructor() {
        this.defines = new Map();
    }

    isDefined(text:string){
        return this.buildOverrides.has(text) || this.defines.has(text);
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
            for (const [key,value] of this.getDefinitions()) {
                if(text.includes(`$(${key})`)){
                    replaced = true;
                    let replacement;
                    if(value.value.toLowerCase() === "true"){
                        replacement = "TRUE";
                    }else if(value.value.toLowerCase() === "false"){
                        replacement = "FALSE";
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