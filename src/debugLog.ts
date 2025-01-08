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
    outConsole: vscode.OutputChannel;

    public constructor() {

        this.outConsole = vscode.window.createOutputChannel("EDK2Code");
    }

    public show(){
        this.outConsole.show();
    }

    public clear(){
        this.outConsole.clear();
    }

    public error(text:string){
        this.out(`[Edk2Code Error] ${text}`, LogLevel.error);
        let callStack = (new Error()).stack || '';
        this.out(`[Edk2Code Stack]\n${callStack}`, LogLevel.error);
    }

    public info(text:string){
        this.out(`[Edk2Code Info] ${text}`, LogLevel.info);
    }

    public verbose(text:string){
        this.out(`[Edk2Code Verb] ${text}`, LogLevel.verbose);
    }

    public warning(text:string){
        this.out(`[Edk2Code Warn] ${text}`, LogLevel.warning);
    }

    public debug(text:string){
        this.out(`[Edk2Code Debug] ${text}`, LogLevel.debug);
    }



    public out(text:string, level:LogLevel|undefined = undefined){
        if(level === undefined){
            this.outConsole.appendLine(text);
            return;
        }

        if(gConfigAgent === undefined){
            this.outConsole.appendLine(text);
            console.log(text);
            return;
        }

        if (level <= gConfigAgent.getLogLevel()){
            this.outConsole.appendLine(text);
            if(level === LogLevel.error){
                console.error(text);
            }else if(level===LogLevel.warning){
                console.warn(text);
            }else{
                console.info(text);
            }
        }
    }

}