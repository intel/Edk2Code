import {  EdkSymbol } from "./edkSymbol";
import { Edk2SymbolType } from '../symbols/symbolsType';
import * as vscode from 'vscode';
import { split } from "../utils";
import path = require("path");



export class EdkSymbolDecSection extends EdkSymbol {
    type = Edk2SymbolType.decSection;
    kind = vscode.SymbolKind.Class;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolDecDefine extends EdkSymbol {
    type = Edk2SymbolType.decDefine;
    kind = vscode.SymbolKind.Constant;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolDecLibrary extends EdkSymbol {
    type = Edk2SymbolType.decLibrary;
    kind = vscode.SymbolKind.Module;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolDecPackage extends EdkSymbol {
    type = Edk2SymbolType.decPackage;
    kind = vscode.SymbolKind.Package;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolDecPpi extends EdkSymbol {
    type = Edk2SymbolType.decPpi;
    kind = vscode.SymbolKind.Event;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;

    async getKey(){
        let key = split(this.textLine, "=",2)[0].trim();
        return key;
    }
}
export class EdkSymbolDecProtocol extends EdkSymbol {
    type = Edk2SymbolType.decProtocol;
    kind = vscode.SymbolKind.Event;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;

    async getKey(){
        let key = split(this.textLine, "=",2)[0].trim();
        return key;
    }
}
export class EdkSymbolDecPcd extends EdkSymbol {
    type = Edk2SymbolType.decPcd;
    kind = vscode.SymbolKind.String;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
    async getKey(){
        let key = split(this.textLine, "|",2)[0].trim();
        return key;
    }
}
export class EdkSymbolDecGuid extends EdkSymbol {
    type = Edk2SymbolType.decGuid;
    kind = vscode.SymbolKind.Number;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;

    async getKey(){
        let key = split(this.textLine, "=",2)[0].trim();
        return key;
    }
}
export class EdkSymbolDecIncludes extends EdkSymbol {
    type = Edk2SymbolType.decInclude;
    kind = vscode.SymbolKind.File;
    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;

    async getKey(){
        let key = this.textLine.trim();
        return path.join(path.dirname(this.location.uri.fsPath),key);
    }
}