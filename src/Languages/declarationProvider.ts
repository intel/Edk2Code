import * as vscode from 'vscode';
import { ParserFactory } from '../edkParser/parserFactory';
import { gDebugLog } from '../extension';


export class EdkDeclarationProvider implements vscode.DeclarationProvider {

    constructor() {

    }
    async provideDeclaration(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {

        let factory = new ParserFactory();
        let parser = factory.getParser(document);
        if(parser){
            await parser.parseFile();
            let selectedSymbol = parser.getSelectedSymbol(position);
            if (!selectedSymbol) { return []; }
            gDebugLog.verbose(`Definition for: ${selectedSymbol.toString()}`);
            if (selectedSymbol.onDeclaration !== undefined) {
                let temp = await selectedSymbol.onDeclaration();
                return temp;
            }
        }
  
    }
}