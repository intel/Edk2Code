import * as vscode from 'vscode';
import { getParserForDocument } from '../edkParser/parserFactory';
import { gDebugLog } from '../extension';


export class EdkDeclarationProvider implements vscode.DeclarationProvider {

    constructor() {

    }
    async provideDeclaration(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {

        let parser = await getParserForDocument(document);
        if(parser){
            let selectedSymbol = parser.getSelectedSymbol(position);
            if (!selectedSymbol) { return []; }
            gDebugLog.trace(`Definition for: ${selectedSymbol.toString()}`);
            if (selectedSymbol.onDeclaration !== undefined) {
                let temp = await selectedSymbol.onDeclaration();
                return temp;
            }
        }
  
    }
}