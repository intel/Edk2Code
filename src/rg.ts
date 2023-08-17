import { CancellationToken, Location, Range, Uri } from "vscode";
import { gDebugLog, gWorkspacePath } from "./extension";
const { rgPath } = require('vscode-ripgrep');
import { createRange, exec, makeRelativeToWs } from "./utils";
import path = require("path");



export async function rgSearch(text:string, filesPath:string[]){
    return new Promise<Location[]>(async (resolve, reject) => {
        
        let command = `${rgPath} ${text} `;
        for (const f of filesPath) {
            command += makeRelativeToWs(f) + " ";
        }
        command += "--hidden --follow --crlf --fixed-strings --no-config --json";
        gDebugLog.verbose(command);
        let textResult="";
        try {
            textResult = await exec(command, gWorkspacePath);    
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