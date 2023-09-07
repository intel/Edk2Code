import { SymbolKind, Location, SymbolTag, Range, DocumentSymbol } from "vscode";
import { Edk2SymbolType } from '../symbols/symbolsType';
import * as vscode from 'vscode';
import { gEdkWorkspaces, gPathFind } from "../extension";
import { split, trimSpaces } from "../utils";
import { WorkspaceDefinitions } from "../index/definitions";
import { DocumentParser } from "../edkParser/languageParser";
import { EdkSymbol } from "./edkSymbol";

export class EdkSymbolDscSection extends EdkSymbol {
    type = Edk2SymbolType.dscSection;
    kind = vscode.SymbolKind.Class;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}


export class EdkSymbolDscDefine extends EdkSymbol{
    type = Edk2SymbolType.dscDefine;
    kind = vscode.SymbolKind.Constant;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;

    async getKey() {
        let key = this.textLine.replace(/define/gi, "").trim();
        key = split(key, "=", 2)[0].trim();        
        key = await gEdkWorkspaces.replaceDefines(this.location.uri, key);;
        return key;
    }

    async getValue(){
        let value = split(this.textLine, "=", 2)[1].trim();
        value = await gEdkWorkspaces.replaceDefines(this.location.uri, value);
        return value;
    }
}


export class EdkSymbolDscLibraryDefinition extends EdkSymbol{
    type = Edk2SymbolType.dscLibraryDefinition;
    kind = vscode.SymbolKind.Module;

    onCompletion: undefined;
    onDefinition = async (parser:DocumentParser)=>{
        let path = this.textLine.replace(/.*?\|\s*/gi, "");
        path = await gEdkWorkspaces.replaceDefines(this.location.uri, path);
        return await gPathFind.findPath(path);
    };
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolDscPcdDefinition extends EdkSymbol{
    type = Edk2SymbolType.dscPcdDefinition;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolDscInclude extends EdkSymbol{
    type = Edk2SymbolType.dscInclude;
    kind = vscode.SymbolKind.File;

    onCompletion: undefined;
    onDefinition = async (parser:DocumentParser)=>{
        let path = await this.getValue();
        return await gPathFind.findPath(path);
    };
    onHover: undefined;
    onDeclaration: undefined;

    async getValue(){
        let value = this.textLine.replace(/!include/gi, "").trim();        
        value = await gEdkWorkspaces.replaceDefines(this.location.uri, value);
        return value;
    }
}


export class EdkSymbolDscLine extends EdkSymbol{
    type = Edk2SymbolType.dscLine;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolDscModuleDefinition extends EdkSymbol{
    type = Edk2SymbolType.dscModuleDefinition;
    kind = vscode.SymbolKind.Event;

    onCompletion: undefined;
    onDefinition  = async ()=>{
        let path = this.textLine.replace(/\s*\{.*/, "");
        path = await gEdkWorkspaces.replaceDefines(this.location.uri, path);
        return await gPathFind.findPath(path);
    };
    
    onHover: undefined;
    onDeclaration: undefined;
}

