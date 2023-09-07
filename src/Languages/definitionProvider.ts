import * as vscode from 'vscode';
import { ParserFactory } from '../edkParser/parserFactory';
import { gDebugLog, gEdkWorkspaces } from '../extension';
import { REGEX_PCD, REGEX_VAR_USAGE } from '../edkParser/commonParser';
import { split } from '../utils';

export class EdkDefinitionProvider implements vscode.DefinitionProvider {

    constructor() {

    }
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {

        // Check if its a variable definition
        let word = document.getWordRangeAtPosition(position,REGEX_VAR_USAGE);
        if(word){
            let text = document.getText(word);
            let wps = await gEdkWorkspaces.getWorkspace(document.uri);
            if(wps.length){
                for (const wp of wps) {
                    let key = document.getText(document.getWordRangeAtPosition(position));
                    let definitionLocation = wp.getDefinitionLocation(key);
                    
                    if(document.languageId === "edk2_fdf"){
                        definitionLocation = wp.definesFdf.getDefinitionLocation(key);
                    }
                    
                    if(definitionLocation){
                            return definitionLocation; 
                    }else{
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        vscode.window.showInformationMessage(`${key} is defined in build arguments`);
                        return;
                    }
                }
            }
        }

        // Check if word its a PCD
        word = document.getWordRangeAtPosition(position,REGEX_PCD);
        if(word){
            let text = document.getText(word);
            let wps = await gEdkWorkspaces.getWorkspace(document.uri);
            if(wps.length){
                for (const wp of wps) {
                    let [namespace, key] = split(text,".",2);
                    let pcdsList = wp.getPcds(namespace);
                    if(pcdsList === undefined){continue;}
                    let resultPcd = pcdsList.get(key);
                    if(resultPcd){
                      return resultPcd.position;
                    } 
                }
            }
        }




        let factory = new ParserFactory();
        let parser = factory.getParser(document);
        if(parser){
            await parser.parseFile();
            let selectedSymbol = parser.getSelectedSymbol(position);
            if (!selectedSymbol) { return []; }
            gDebugLog.verbose(`Definition for: ${selectedSymbol.toString()}`);
            if (selectedSymbol.onDefinition !== undefined) {
                let temp = await selectedSymbol.onDefinition(parser);
                return temp;
            }
        }
    }


}