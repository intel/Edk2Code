import * as vscode from 'vscode';
import { gDebugLog } from "../extension";
import { DscParser } from "./dscParser";
import { FdfParser } from "./fdfParser";
import { InfParser } from "./infParser";
import { DecParser } from './decParser';
import { VfrParser } from './vfrParser';
import { AslParser } from './aslParser';
import { openTextDocument } from '../utils';
import { DiagnosticManager } from '../diagnostics';
import { Debouncer } from '../debouncer';

export async function getParser(uri:vscode.Uri){
    let infDocument = await openTextDocument(uri);
    let factory = new ParserFactory();
    let parser = factory.getParser(infDocument);
    if (parser) {
        await parser.parseFile();
    }
    return parser;
}

export class ParserFactory {

    getParser(document: vscode.TextDocument) {
        let languageId = document.languageId;
        
        switch (languageId) {
            case "asl":
                return new AslParser(document);
                break;
            case "edk2_dsc":
                return new DscParser(document);
                break;
            case "edk2_dec":
                return new DecParser(document);
                break;
            case "edk2_vfr":
                return new VfrParser(document);
                break;
            case "edk2_fdf":
                return new FdfParser(document);
                break;
            case "edk2_inf":
                return new InfParser(document);
                break;
            case "edk2_uni":
                break;
            default:
                gDebugLog.error(`Document parser not supported: ${document.fileName}`);
                return undefined;
        }
    }
}

