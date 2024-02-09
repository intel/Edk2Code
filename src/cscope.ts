import * as fs from 'fs';
import path = require('path');
import * as vscode from 'vscode';
import { gConfigAgent, gCscope, gDebugLog, gEdkWorkspaces } from './extension';
import { exec, execWindow, getEdkCodeFolderFilePath, getEdkCodeFolderPath, getStaticPath, normalizePath, readLines, toPosix } from './utils';
import { execSync } from 'child_process';
import * as edkStatusBar from './statusBar';

/*
cscope -R -L -2 ".*" | awk -F ' ' '{print $2 "#" $1}' | sort | uniq
The command cscope -R -L -2 ".*" will output functions called by any function (see explanation of the options below). For each reference found, cscope outputs a line consisting of the file name, function name, line number, and line text, separated by spaces.
Use awk to extract the function name $2 and file name $1 separated by #. Change $2, $1 and the separator # if you need other output fields or separator.
Sort the output with sort.
Get unique items with uniq.
cscope options (see http://cscope.sourceforge.net/cscope_man_page.html):

-R Recurse subdirectories for source files.

-L Do a single search with line-oriented output when used with the -num pattern option.

-2 ".*" Go to input field num (here 0-based field 2) and find pattern (here .* for all). You can see the input fields in cscope's screen mode. This may vary depending on the version you are using. The fields for version 15.8a under debian are:

0: Find this C symbol:
1: Find this global definition:
2: Find functions called by this function:
3: Find functions calling this function:
4: Find this text string:
5: Change this text string:
6: Find this egrep pattern:
7: Find this file:
8: Find files #including this file:
*/
export enum CscopeCmd{
    findSymbol= "0",
    findGlobalDef = "1",
    findCallee = "2",
    findCallers = "3",
    findText = "4",
    findEgrep = "6"

}


export class FuncInfo
{
    public name:string;
    // public type:string;
    public line:number;
    public file:string;
    public snipped:string;
    public searchTerm: string;
    public end:number;

    constructor(name:string, line:number, file:string, snipped:string, searchTerm:string){
        this.searchTerm = searchTerm;
        this.name =   name;
        this.line =   line;
        this.file =   file;
        this.snipped = snipped;
        this.end = 0;
    }

}


export class Cscope {
    cscopePath:string = "";
    cscopeInstalled = false;

    public constructor() {
        let cscopeOverwritePath = gConfigAgent.getCscopeOverwritePath();

        if(cscopeOverwritePath === ""){
            if (process.platform === 'win32'){
                this.cscopePath = getStaticPath("cscope.exe");
            }else{
                this.cscopePath = "cscope";
            }
        }else{
            this.cscopePath = cscopeOverwritePath;
        }


        var command = `${this.cscopePath} -V`;

        try {
            let result = execSync(command);
            gDebugLog.info(result.toString());
            this.cscopeInstalled = true;
        } catch (error) {
            gDebugLog.error("Cscope not available in the system");
            this.cscopeInstalled = false;
        }
         
    }

/**
     * Check if a file is included in the cscope.files list.
     * 
     * This function checks if the given file path is included in the cscope.files list,
     * which contains a list of files used by the Cscope tool for symbol lookup.
     * 
     * @param filePath filePath The file path to check.
     *
     * @return True if the file is included in the cscope.files list, false otherwise.
     */
    includesFile(filePath:vscode.Uri){
        let lines = this.readCscopeFile();
        for (const line of lines) {
            if(filePath.fsPath.toLowerCase() === line.toLowerCase()){
                return true;
            }
        }
        return false;
    }

    showCscopeErrorMessage(){
         void vscode.window.showErrorMessage("Cscope not available in the system. Check help for install", "Help").then(async selection => {
            if (selection === "Help"){
                await vscode.env.openExternal(vscode.Uri.parse(
                    'https://github.com/intel/Edk2Code/wiki#cscope'));
            }
        });
    }

    existCscopeFile(){
        
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        return fs.existsSync(cscopeFilesPath);
    }

    async writeCscopeFile(fileList:string[]){
        if(fileList.length === 0){
            return;
        }
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        
        let cscopeFiles = fileList.map((x)=>{return x.replaceAll("/",path.sep);}).join("\n");
        fs.writeFileSync(cscopeFilesPath,cscopeFiles);
    }


    removeFiles() {
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        fs.rmSync(cscopeFilesPath, {force:true});

        let cscopeOutPath = getEdkCodeFolderFilePath("cscope.out");
        fs.rmSync(cscopeOutPath, {force:true});
        
    }
    
    readCscopeFile():string[]{
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        return readLines(cscopeFilesPath);
    }


    async reload(progressWindow=false){
        gDebugLog.info("CSCOPE reload database");
        if(!this.cscopeInstalled){
            this.showCscopeErrorMessage();
            return;
        }
        edkStatusBar.pushText("Loading Cscope...");
        edkStatusBar.setWorking();
        if(this.existCscopeFile()){
            if(progressWindow){
                await execWindow(`"${this.cscopePath}" -Rb`, getEdkCodeFolderPath(), "Reload cscope database");
            }else{
                await exec(`"${this.cscopePath}" -Rb`, getEdkCodeFolderPath());
            }
        }
        edkStatusBar.popText();
        edkStatusBar.clearWorking();
    }

    async getCaller(text:string){
        let result = await this.cscopeCommandWindow(text, CscopeCmd.findCallers, "Looking callers");
        let temp = this.parseResult(result, text);
        return temp;
    }

    async getCallee(text:string){
        let result = await this.cscopeCommandWindow(text, CscopeCmd.findCallee, "Looking callees");
        return this.parseResult(result, text);
    }

    async search(text:string){
        let result = await this.cscopeCommandWindow(text, CscopeCmd.findEgrep, "Searching");
        let searchResult = this.parseResult(result, text);

        let returnValues:vscode.Location[] = [];

        for (const res of searchResult) {
            let pos = new vscode.Position(res.line, 0);
            returnValues.push(
                new vscode.Location(vscode.Uri.file(res.file), new vscode.Range(pos, pos))
            );
        }
        return returnValues;
        
    }

    async getDefinitionPositions(text:string, showWindows:boolean=true){
    
        let windDescription = "Looking for definition";
        if(!showWindows){
            // Remove description so window is not shown
            windDescription = "";
        }

        let result = await this.cscopeCommandWindow(text, CscopeCmd.findGlobalDef, "Looking for definition");
        let searchResult = this.parseResult(result, text);

        let returnValues:vscode.Location[] = [];

        for (const res of searchResult) {
            let pos = new vscode.Position(res.line, 0);
            returnValues.push(
                new vscode.Location(vscode.Uri.file(res.file), new vscode.Range(pos, pos))
            );
        }
        return returnValues;
        
    }

    async cscopeCommand(text:string, cmdType:CscopeCmd){
        if(!this.cscopeInstalled){
            this.showCscopeErrorMessage();
            return "";
        }
        var command = `${this.cscopePath} -d -L${cmdType}${text}`;
        let result = await exec(command, getEdkCodeFolderPath());
        return result;
    }

    async cscopeCommandWindow(text:string, cmdType:CscopeCmd, textWindow:string=""){
        let cscopeOutPath = getEdkCodeFolderFilePath("cscope.out");

        if(!this.cscopeInstalled){
            void this.showCscopeErrorMessage();
            return "";
        }

        if(!fs.existsSync(cscopeOutPath)){
            gDebugLog.error("Cscope.out file doesnt exist");
        }
        var command = `${this.cscopePath} -d -C -L${cmdType}${text} `;
        let result;
        if(textWindow===""){
            result = await exec(command, getEdkCodeFolderPath());
        }else{
            result = await execWindow(command, getEdkCodeFolderPath(), textWindow);
        }
        return result;
    }

    private parseResult(result:string, text:string){
        const cscopeResults = result.toString().split(/\r?\n/);
        var searchResult = [];
        for (const line of cscopeResults) {
            if (line === ''){continue;}
            var data = line.replace(/\s+/g,' ').split(" ");
            if(data.length >= 3){
                var refLine = Number(data[2])-1;
                if(fs.existsSync(data[0]) && (typeof refLine === 'number')){
                    searchResult.push(new FuncInfo(data[1], refLine, normalizePath(data[0]), data.slice(3).join(" "), text));
                }
            }
        }

        return searchResult;
    }
}


export class CscopeAgent {


    taskUpdateId: NodeJS.Timeout | undefined;
    updateFrequency:number = 6000;

    public constructor() {
        let subscriptions: vscode.Disposable[] = [];
        
        //Trigger cscope updates on saved documents
        vscode.workspace.onDidSaveTextDocument(this._updateCscopeDb, this, subscriptions);
    }

    async writeCscopeFile(fileList:string[]){
        if(fileList.length === 0){
            return;
        }
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        let cscopeFiles = fileList.map((x)=>{return x.replaceAll("/",path.sep);}).join("\n");
        fs.writeFileSync(cscopeFilesPath,cscopeFiles);
        await gCscope.reload();
    }


    removeFiles() {
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        fs.rmSync(cscopeFilesPath, {force:true});

        let cscopeOutPath = getEdkCodeFolderFilePath("cscope.out");
        fs.rmSync(cscopeOutPath, {force:true});
        
    }




    readCscopeFile():string[]{
        let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
        let lines = readLines(cscopeFilesPath);
        if(lines.length===1 && lines[0]===''){return [];}
        return lines;
    }

    private async _updateCscopeDb(savedFile: vscode.TextDocument) {
    /**
     * Updates Cscope database based on cscope.files elements
     */
        if(this.taskUpdateId !== undefined){
            clearTimeout(this.taskUpdateId);
        }

        this.taskUpdateId = setTimeout(async () => {
            let cscopeFilesPath = getEdkCodeFolderFilePath("cscope.files");
            if(fs.existsSync(cscopeFilesPath)){
                
                let isFileUsed = await gEdkWorkspaces.isFileInUse(savedFile.uri);
                if(isFileUsed){
                    await gCscope.reload(false);
                }
            }
        }, this.updateFrequency);
    }
}