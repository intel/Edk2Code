import * as vscode from 'vscode';

import { getCurrentDocument } from './utils';

export class GrayoutController {

    decorationsMap:Map<string,vscode.TextEditorDecorationType>;
    document:vscode.TextDocument;
    range:vscode.Range[];
    public constructor(document:vscode.TextDocument, range:vscode.Range[]) {
        
        this.document = document;
        this.decorationsMap = new Map();
        this.range = range;
        // let subscriptions: vscode.Disposable[] = [];
        // vscode.window.onDidChangeActiveTextEditor(this.doGrayOut, this, subscriptions);
        // vscode.workspace.onDidSaveTextDocument(this.doGrayOut, this, subscriptions);
        
    }
    
    private grayoutRange(unusdedRanges:vscode.Range[]) {

            let activeEditor = vscode.window.activeTextEditor;
            
            if(!activeEditor){return;}
            if(activeEditor.document !== this.document){return;}

            let decoration = this.decorationsMap.get(this.document.fileName);
            if(!decoration){
                decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    light: {
                        opacity: "0.3",
                    },
                    dark: {
                        opacity: "0.3",
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


    doGrayOut(){
        this.grayoutRange([]);
        this.grayoutRange(this.range);
    }

}