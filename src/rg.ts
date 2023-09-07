import { CancellationToken, Location, Range, Uri } from "vscode";
import { gDebugLog, gWorkspacePath } from "./extension";
const { rgPath } = require('vscode-ripgrep');
import { createRange, exec, makeRelativeToWs } from "./utils";
import * as edkStatusBar from './statusBar';
import path = require("path");



export async function rgSearch(text:string, includeExt:string[]=[], filesPath:string[]=[], relative=false){
    return new Promise<Location[]>(async (resolve, reject) => {
        
        let command = `${rgPath} ${text}  `;
        


        for (const f of filesPath) {
            command += makeRelativeToWs(f) + " ";
        }

        for (const f of includeExt) {
            command += " -g " + f;
        }

        if(relative){
            command += " ./ ";
        }

        command += " --hidden --follow --crlf --no-config --json";

        if(filesPath.length===0 && !relative){
            command +=  " -- ./";
        }

        gDebugLog.verbose(command);
        let textResult="";
        try {
            edkStatusBar.setWorking();
            textResult = await exec(command, gWorkspacePath);    
            edkStatusBar.clearWorking();
        } catch (error) {
            gDebugLog.verbose(`rgSearch: ${error}`);
            resolve([]);
        }
        
        gDebugLog.verbose(textResult);
        let locations:Location[] = [];
        for (const jsonData of textResult.split('\n')) {
            if(jsonData===""){continue;}
            let data = JSON.parse(jsonData);
            if("type" in data && data["type"]==="match"){
                let uri = Uri.file(path.join(gWorkspacePath, data["data"]["path"]["text"]));
                locations.push(new Location(uri,createRange(data["data"]["line_number"],data["data"]["line_number"]-1)));
            }
        }
        resolve(locations);
    });
    

}

export async function rgSearchText(text:string, includeExt:string[]=[], filesPath:string[]=[], relative=false){
    return new Promise<string[]>(async (resolve, reject) => {
        
        let command = `${rgPath} ${text}  `;
        
        for (const f of filesPath) {
            command += makeRelativeToWs(f) + " ";
        }

        for (const f of includeExt) {
            command += " -g " + f;
        }

        if(relative){
            command += " ./ ";
        }

        command += " --hidden --follow --crlf --no-config --json";

        if(filesPath.length===0 && !relative){
            command +=  " -- ./";
        }

        gDebugLog.verbose(command);
        let textResult="";
        try {
            edkStatusBar.setWorking();
            textResult = await exec(command, gWorkspacePath);    
            edkStatusBar.clearWorking();
        } catch (error) {
            gDebugLog.verbose(`rgSearch: ${error}`);
            resolve([]);
        }
        
        gDebugLog.verbose(textResult);
        let textMatches:string[] = [];
        for (const jsonData of textResult.split('\n')) {
            if(jsonData===""){continue;}
            let data = JSON.parse(jsonData);
            if("type" in data && data["type"]==="match"){
                textMatches.push(data["data"]["lines"].text);

            }
        }
        resolve(textMatches);
    });
    

}