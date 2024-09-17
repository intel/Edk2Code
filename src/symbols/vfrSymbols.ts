import { SymbolKind, Location, SymbolTag, Range, DocumentSymbol } from "vscode";
import { Edk2SymbolType } from '../symbols/symbolsType';
import * as vscode from 'vscode';
import { gEdkWorkspaces, gPathFind } from "../extension";
import { split, trimSpaces } from "../utils";
import { WorkspaceDefinitions } from "../index/definitions";
import { DocumentParser } from "../edkParser/languageParser";
import { EdkSymbol } from "./edkSymbols";

export class EdkSymbolVfrDefault extends EdkSymbol {

    type = Edk2SymbolType.vfrDefault;
    kind = vscode.SymbolKind.Null;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrFormset extends EdkSymbol {

    type = Edk2SymbolType.vfrFormset;
    kind = vscode.SymbolKind.Class;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrForm extends EdkSymbol {

    type = Edk2SymbolType.vfrForm;
    kind = vscode.SymbolKind.Package;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrOneof extends EdkSymbol {

    type = Edk2SymbolType.vfrOneof;
    kind = vscode.SymbolKind.Enum;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrCheckbox extends EdkSymbol {

    type = Edk2SymbolType.vfrCheckbox;
    kind = vscode.SymbolKind.Boolean;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrString extends EdkSymbol {

    type = Edk2SymbolType.vfrString;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrPassword extends EdkSymbol {

    type = Edk2SymbolType.vfrPassword;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrNumeric extends EdkSymbol {

    type = Edk2SymbolType.vfrNumeric;
    kind = vscode.SymbolKind.Number;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolVfrGoto extends EdkSymbol {

    type = Edk2SymbolType.vfrGoto;
    kind = vscode.SymbolKind.Event;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}