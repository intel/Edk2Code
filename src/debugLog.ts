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
        this.out(`Error: ${text}`, LogLevel.error);
    }

    public info(text:string){
        this.out(`Info: ${text}`, LogLevel.info);
    }

    public verbose(text:string){
        this.out(`Verb: ${text}`, LogLevel.verbose);
    }

    public warning(text:string){
        this.out(`Warn: ${text}`, LogLevel.warning);
    }

    public debug(text:string){
        this.out(`Debug: ${text}`, LogLevel.debug);
    }



    public out(text:string, level:LogLevel|undefined = undefined){
        if(level === undefined){
            this.outConsole.appendLine(text);
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