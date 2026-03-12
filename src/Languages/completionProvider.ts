import * as vscode from 'vscode';
import { getParserForDocument } from '../edkParser/parserFactory';
import { gDebugLog } from '../extension';


export class EdkCompletionProvider implements vscode.CompletionItemProvider {

    constructor() {

    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
        let parser = await getParserForDocument(document);
        if(parser){
            let selectedSymbol = parser.getSelectedSymbol(position);
            if (!selectedSymbol) { return []; }
            gDebugLog.trace(`Completion for: ${selectedSymbol.toString()}`);

            if (selectedSymbol.onCompletion !== undefined) {
                let temp = await selectedSymbol.onCompletion(document, position, token, context);
                return temp;
            }
        }
    }
}