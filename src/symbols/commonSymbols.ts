import {  EdkSymbol } from "./edkSymbol";
import { Edk2SymbolType } from '../symbols/symbolsType';
import * as vscode from 'vscode';


export class EdkSymbolCondition extends EdkSymbol{
    type = Edk2SymbolType.condition;
    kind = vscode.SymbolKind.Event;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolUnknown extends EdkSymbol {
    type = Edk2SymbolType.unknown;
    kind = vscode.SymbolKind.String;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}