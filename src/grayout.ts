import * as vscode from 'vscode';

import { getCurrentDocument } from './utils';

export class GrayoutController {
    decoration:vscode.TextEditorDecorationType|undefined;
    
    document:vscode.TextDocument;
    range:vscode.Range[];
    public constructor(document:vscode.TextDocument, range:vscode.Range[]) {
        
        this.document = document;

        this.range = range;
        // let subscriptions: vscode.Disposable[] = [];
        // vscode.window.onDidChangeActiveTextEditor(this.doGrayOut, this, subscriptions);
        // vscode.workspace.onDidSaveTextDocument(this.doGrayOut, this, subscriptions);
        
    }

    clearDecorator(){

    }
    
    grayoutRange(unusdedRanges:vscode.Range[]) {

            let activeEditor = vscode.window.activeTextEditor;
            
            if(!activeEditor){return;}
            if(activeEditor.document !== this.document){return;}

            if(this.decoration){
                this.decoration.dispose();
            }

            
            let decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    light: {
                        opacity: "0.3",
                    },
                    dark: {
                        opacity: "0.3",
                    }
            });

            this.decoration = decoration;


    
            // Block content
            const blockDecorationOptions: vscode.DecorationOptions[] = [];
            for (const targetRange of unusdedRanges) {
                const decoration = { range: targetRange};
                blockDecorationOptions.push(decoration);
            }
            activeEditor?.setDecorations(decoration, blockDecorationOptions);

    }


    doGrayOut(){
        this.grayoutRange(this.range);
    }

}