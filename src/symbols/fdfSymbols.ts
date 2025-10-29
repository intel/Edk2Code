import { gEdkWorkspaces, gPathFind } from "../extension";
import {  EdkSymbol } from "./edkSymbols";
import * as vscode from 'vscode';
import { Edk2SymbolType } from "./symbolsType";
import { WorkspaceDefinitions } from "../index/definitions";
import { DocumentParser } from "../edkParser/languageParser";
import * as path from 'path';

export class EdkSymbolDscSection extends EdkSymbol {
    type = Edk2SymbolType.dscSection;
    kind = vscode.SymbolKind.Class;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolFdfSection extends EdkSymbol {

    type = Edk2SymbolType.fdfSection;
    kind = vscode.SymbolKind.Class;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolFdfInf extends EdkSymbol {

    type = Edk2SymbolType.fdfInf;
    kind = vscode.SymbolKind.Event;

    onCompletion: undefined;

    onDefinition = async (parser:DocumentParser)=>{
        let pathValue = await this.getValue();
        let relPath = path.dirname(parser.document.uri.fsPath);
        return await gPathFind.findPath(pathValue, relPath);
    };

    async getValue(){
        let value  = this.textLine.replace(/\INF\s+/, "").trim();
        
        value = await gEdkWorkspaces.replaceDefines(this.location.uri, value);
        return value;
    }

    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolFdfDefinition extends EdkSymbol {

    type = Edk2SymbolType.fdfDefinition;
    kind = vscode.SymbolKind.Constant;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolFdfFile extends EdkSymbol {

    type = Edk2SymbolType.fdfFile;
    kind = vscode.SymbolKind.File;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolFdfInclude extends EdkSymbol {

    type = Edk2SymbolType.fdfInclude;
    kind = vscode.SymbolKind.File;

    onCompletion: undefined;

    onDefinition = async (parser:DocumentParser)=>{
        let pathValue = await this.getValue();
        let relPath = path.dirname(parser.document.uri.fsPath);
        return await gPathFind.findPath(pathValue, relPath);
    };

    async getValue(){
        let value = this.textLine.replace(/!include/gi, "").trim();
        value = await gEdkWorkspaces.replaceDefines(this.location.uri, value);
        return value;
    }

    onHover: undefined;
    onDeclaration: undefined;
}