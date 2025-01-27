import * as vscode from 'vscode';

import { getCurrentDocument } from './utils';
import { gDebugLog } from './extension';

export class GrayoutController {
    decoration:vscode.TextEditorDecorationType|undefined;
    
    document:vscode.TextDocument;
    range:vscode.Range[];
    changeEvent:vscode.Disposable;

    public constructor(document:vscode.TextDocument, range:vscode.Range[]) {
        
        this.document = document;

        this.range = range;
        // let subscriptions: vscode.Disposable[] = [];
        this.changeEvent = vscode.window.onDidChangeActiveTextEditor(()=>{
            if(vscode.window.activeTextEditor?.document.uri.fsPath === this.document.uri.fsPath){
                this.doGrayOut();
            }
        }, this);
        
    }

    
    grayoutRange(unusdedRanges:vscode.Range[]) {
            gDebugLog.trace("grayoutRange()");
            let activeEditor = vscode.window.activeTextEditor;
            
            if(!activeEditor){return;}
            if(activeEditor.document !== this.document){return;}

            gDebugLog.trace(`Unused Ranges: ${JSON.stringify(unusdedRanges)}`);
            
            this.disposeDecoration();

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



    dispose(){
        this.disposeDecoration();
        this.changeEvent?.dispose();
    }

    disposeDecoration(){
        if(this.decoration){
            this.decoration.dispose();
        }
    }

    doGrayOut(){
        if (vscode.window.visibleTextEditors.some(editor => editor.document.uri.fsPath === this.document.uri.fsPath)) {
            gDebugLog.info(`doGrayOut(): ${this.document.uri.fsPath}`);
            this.grayoutRange(this.range);
        }
    }

}