import * as vscode from 'vscode';
import { gEdkDatabase} from './extension';
import { getCurrentDocument } from './utils';

export class GrayoutController {

    decorationsMap:Map<string,vscode.TextEditorDecorationType>;

    public constructor() {
        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(this.doGrayOut, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this.doGrayOut, this, subscriptions);
        this.decorationsMap = new Map();
    }

    dispose() {

    }

    

    private _grayoutRange(unusdedRanges:vscode.Range[]) {

            let activeEditor = vscode.window.activeTextEditor;
            if(!activeEditor){return;}

            let decoration = this.decorationsMap.get(activeEditor.document.fileName);
            if(!decoration){
                decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    light: {
                        opacity: "0.5",
                    },
                    dark: {
                        opacity: "0.5"
                    }
                });
                this.decorationsMap.set(activeEditor.document.fileName,decoration);
            }

    
            // Block content
            const blockDecorationOptions: vscode.DecorationOptions[] = [];
            for (const targetRange of unusdedRanges) {
                const decoration = { range: targetRange};
                blockDecorationOptions.push(decoration);
            }
            activeEditor?.setDecorations(decoration, blockDecorationOptions);

    }

    private async _getUnusedRanges(){
        let targetDocument = getCurrentDocument();
        if(targetDocument===undefined){return [];}

        let inactiveCode = gEdkDatabase.getInactiveLines(targetDocument.fileName);
        if(!inactiveCode){return [];}
        
        return inactiveCode;
    }

    async doGrayOut(){
        let unusedSymbols = await this._getUnusedRanges();
        await this._grayoutRange([]);
        await this._grayoutRange(unusedSymbols);
    }

}