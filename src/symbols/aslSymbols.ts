import { SymbolKind, Location, SymbolTag, Range, DocumentSymbol } from "vscode";
import { Edk2SymbolType } from './symbolsType';
import * as vscode from 'vscode';
import { gEdkWorkspaces, gPathFind } from "../extension";
import { split, trimSpaces } from "../utils";
import { WorkspaceDefinitions } from "../index/definitions";
import { DocumentParser } from "../edkParser/languageParser";
import { EdkSymbol } from "./edkSymbol";

export class EdkSymbolAslDefinitionBlock extends EdkSymbol {

    type = Edk2SymbolType.aslDefinitionBlock;
    kind = vscode.SymbolKind.Package;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslExternal extends EdkSymbol {

    type = Edk2SymbolType.aslExternal;
    kind = vscode.SymbolKind.Interface;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslScope extends EdkSymbol {

    type = Edk2SymbolType.aslScope;
    kind = vscode.SymbolKind.Module;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslDevice extends EdkSymbol {

    type = Edk2SymbolType.aslDevice;
    kind = vscode.SymbolKind.Constant;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslName extends EdkSymbol {

    type = Edk2SymbolType.aslName;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslMethod extends EdkSymbol {

    type = Edk2SymbolType.aslMethod;
    kind = vscode.SymbolKind.Method;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslField extends EdkSymbol {

    type = Edk2SymbolType.aslField;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolAslOperationRegion extends EdkSymbol {

    type = Edk2SymbolType.aslOpRegion;
    kind = vscode.SymbolKind.Enum;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}