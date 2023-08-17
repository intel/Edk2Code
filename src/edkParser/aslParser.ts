
import { Edk2SymbolType } from "./edkSymbols";
import * as vscode from 'vscode';
import { LanguageParser } from "./languageParser";


export class AslParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["//"];


    blocks: any[] = [
        { name: "DefinitionBlock", tag: /\bDefinitionBlock\b/gi, start: /\{/gi, end: /\}/gi, type: Edk2SymbolType.aslDefinitionBlock },
        { name: "External", tag: /\bExternal\b/gi, start: /\(/gi, end: /\)/gi, type: Edk2SymbolType.aslExternal },
        { name: "Scope", tag: /\bScope\b/gi, start: /\{/gi, end: /\}/gi, type: Edk2SymbolType.aslScope },
        { name: "Device", tag: /\bDevice\b/gi, start: /\{/gi, end: /\}/gi, type: Edk2SymbolType.aslDevice },
        { name: "Name", tag: /\bName\b/gi, start: /\(/gi, end: /\)/gi, type: Edk2SymbolType.aslName },
        { name: "Method", tag: /\bMethod\b/gi, start: /\{/gi, end: /\}/gi, type: Edk2SymbolType.aslMethod },
        { name: "Field", tag: /\bField\b/gi, start: /\{/gi, end: /\}/gi, type: Edk2SymbolType.aslField },
        { name: "OperationRegion", tag: /\bOperationRegion\b/gi, start: /\(/gi, end: /\)/gi, type: Edk2SymbolType.aslOpRegion },
    ];

}