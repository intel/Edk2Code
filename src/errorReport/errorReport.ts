import { TextDocument } from "vscode";
import * as vscode from 'vscode';
import { gConfigAgent } from '../extension';
import { getStaticPath } from "../utils";


export interface ErrorElement{
    errorType:string;
    message:string;
    location:vscode.Location;
}

export class ErrorReport{
    
    gutter: GutterIconController;
    constructor(console:vscode.OutputChannel) {
        this.gutter = new GutterIconController();
        
    }

    
}



export class GutterIconController {

    decoration:vscode.TextEditorDecorationType;
    warningSymbols: vscode.Range[];

    public constructor() {
        new vscode.ThemeIcon("symbol-constant");
                this.decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    overviewRulerColor:"yellow",
                });
        this.warningSymbols = [];
    }

    dispose() {

    }

    

    private _warningRange(warningRanges:vscode.Range[]) {

            let activeEditor = vscode.window.activeTextEditor;
            if(!activeEditor){return;}

            

    
            // Block content
            const blockDecorationOptions: vscode.DecorationOptions[] = [];
            for (const targetRange of warningRanges) {
                const decoration = { range: targetRange};
                blockDecorationOptions.push(decoration);
            }
            activeEditor?.setDecorations(this.decoration, blockDecorationOptions);

    }



    async render(){
        
        await this._warningRange([]);
        await this._warningRange(this.warningSymbols);
    }

}

