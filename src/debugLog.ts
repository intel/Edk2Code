import * as vscode from 'vscode';
import { gConfigAgent } from './extension';

export enum LogLevel {
    none = 0,
    error,
    warning,
    info,
    verbose,
    debug
  }

export class DebugLog {
    outConsole: vscode.LogOutputChannel;

    public constructor() {

        this.outConsole = vscode.window.createOutputChannel("EDK2Code", {log:true});
    }

    public show(){
        this.outConsole.show();
    }

    public clear(){
        this.outConsole.clear();
    }

    public error(text:string){
        this.outConsole.error(text);
        let callStack = (new Error()).stack || '';
        this.outConsole.error(`[Stack]\n${callStack}`);
    }

    public info(text:string){
        this.outConsole.info(text);
    }

    public trace(text:string){
        this.outConsole.trace(text);
    }

    public warning(text:string){
        this.outConsole.warn(text);
    }

    public debug(text:string){
        this.outConsole.debug(text);
    }




}