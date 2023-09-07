
import * as vscode from 'vscode';
import { getEdkCodeFolderFilePath, readLines, split, toPosix, writeEdkCodeFolderFile } from '../utils';
import { DictHoverProvider } from './symbolProvider';
import * as fs from 'fs';
import { gWorkspacePath } from '../extension';
import path = require('path');
import { glob } from 'fast-glob';

export class GuidProvider{
    guidProvider: vscode.Disposable|undefined = undefined;
    
    constructor (){
        
    }
    

    private async createGuidXrefFile(){
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating Guid xref file",
            cancellable: true
        }, async (progress, reject) => {

            return new Promise<void>(async (resolve, token) => {
                let guidXref:string[] = [];

                // First check for xref files on all workspace
                let lookPath = toPosix(path.join(gWorkspacePath, "**/Guid.xref"));
                let fileList = glob.sync(lookPath);
                for (const file of fileList) {
                    let lines = readLines(file);
                    for (const line of lines) {
                        // Avoid empty lines
                        if(line.trim().length > 0){
                            guidXref.push(line.replace(" ",","));
                        }
                    }
                }

                // Parse fdf files for FV guids
                // let fvNameGuidData = await gEdkDatabase.findByName("FvNameGuid","edk2_fdf");
                // for (const symbol of fvNameGuidData) {
                //     let symbolParent = await symbol.getParent();
                //     if(symbolParent){
                //         let fvName = symbolParent.name;
                //         guidXref.push(`${symbol.detail.toUpperCase()},${fvName}`);
                //     }
                    
                // }

                writeEdkCodeFolderFile("Guid.csv",guidXref.join("\n"));
                resolve();
            });
        });
    }

    public async registerProvider(){
        await this.createGuidXrefFile();

        let guidXrefPath = getEdkCodeFolderFilePath("Guid.csv");
        //Check if guidXref.xref exists
        if(fs.existsSync(guidXrefPath)){
            //unregister previous provider
            if(this.guidProvider){
                this.guidProvider.dispose();
            }
         

            // read guidXref.xref file and create a map
            let guidXrefMap = new Map<string, string>();
            let guidXrefLines = readLines(guidXrefPath);
            for (const line of guidXrefLines) {
                let data = split(line, ",", 2);
                guidXrefMap.set(data[0], data[1]);
            }
            vscode.languages.registerHoverProvider({ scheme: 'file', language: '*' }, new DictHoverProvider(guidXrefMap,
            /[a-fA-F\d]{8}-[a-fA-F\d]{4}-[a-fA-F\d]{4}-[a-fA-F\d]{4}-[a-fA-F\d]{12}/)                                      
            );  
        }
    }


  }