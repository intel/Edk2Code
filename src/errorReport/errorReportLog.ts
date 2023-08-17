import * as vscode from 'vscode';
import { gConfigAgent } from '../extension';



export class ErrorReportLog {
    outConsole: vscode.OutputChannel;

    public constructor() {

        this.outConsole = vscode.window.createOutputChannel("EDK2CodeErrors");
    }

    public show(){
        this.outConsole.show();
    }

    public clear(){
        this.outConsole.clear();
    }

    public error(text:string){
        this.out(`Error: ${text}`);
    }

    public warning(text:string){
        this.out(`Warn: ${text}`);
    }

    public out(text:string){
            this.outConsole.appendLine(text);
    }

}