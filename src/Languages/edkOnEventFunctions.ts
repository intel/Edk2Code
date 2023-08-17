
import * as vscode from 'vscode';
import { gCscope, gDebugLog, gEdkDatabase } from '../extension';
import { getDefinitionLocationsSelected } from '../navigation';
import { Edk2Symbol, Edk2DocumentSymbols, Edk2SymbolType, Edk2SymbolProperties } from '../edkParser/edkSymbols';
import { EdkDatabase, UNDEFINED_VARIABLE } from '../edkParser/edkDatabase';
import { LanguageParser } from '../edkParser/languageParser';
import { createRange, getCurrentWord } from '../utils';
import path = require('path');


export function gotoDecName(symbol: Edk2Symbol, edkDatabase: EdkDatabase, parser: LanguageParser) {
    let retLocations: vscode.Location[] = [];
    let found = edkDatabase.findByName(symbol.name,"edk2_dec");
    for (const symbol of found) {
        let pushLocation = new vscode.Location(vscode.Uri.file(symbol.filePath), symbol.range.start);
        retLocations.push(pushLocation);
    }
    return retLocations;
}

export async function gotoFolder(symbol: Edk2Symbol, edkDatabase: EdkDatabase, parser: LanguageParser) {
    let p = await edkDatabase.findPath(symbol.value, symbol.filePath);
    if (p) {
        await vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(p));
    }
    return [];
}

export async function gotoValueFile(symbol: Edk2Symbol, edkDatabase: EdkDatabase, parser: LanguageParser) {
    let p = await edkDatabase.findPath(symbol.value, symbol.filePath);
    if (p) {
        return [new vscode.Location(vscode.Uri.file(p), new vscode.Position(0, 0))];
    }
    return [];
}


export async function completionInfCommon(symbol: Edk2Symbol, edkDatabase: EdkDatabase, infParser: LanguageParser) {
    // new vscode.CompletionItem(completionItem.name, CompletionItemKind.Event  )
    let data:Edk2Symbol[] = [];
    for (const prop of symbol.properties) {
        data = [...data, ...await edkDatabase.findByProperties(prop.sectionType, prop.arch, prop.moduleType, "edk2_dec")];
    }

    let packages = infParser.findByValueMatch(/\[\s*packages.*\]/gi);
    let cleanData:Map<string, Edk2Symbol> = new Map();
    // clean up duplicated
    for (const d of data) {
        if(!d.name.includes("[")){
            for (const packlist of packages) {
                for (const pack of packlist.children) {
                    if(pack.value.toLowerCase() === d.filePath.toLowerCase()){
                        cleanData.set(d.name, d);
                    }
                }
            }
        }
    }
    let retData = [];
    
    for (const d of cleanData.values()) {
        
        retData.push(new vscode.CompletionItem({label:d.name, detail:` ${path.basename(d.filePath)}`, description:""}, vscode.CompletionItemKind.Enum));
    }

    return retData;
}

export async function completionInfLibraries(symbol: Edk2Symbol, edkDatabase: EdkDatabase, infParser: LanguageParser) {
    // new vscode.CompletionItem(completionItem.name, CompletionItemKind.Event  )
    let data:Edk2Symbol[] = [];
    for (const prop of symbol.properties) {
        data = [...data, ...await edkDatabase.findByProperties("libraryclasses", prop.arch, prop.moduleType, "edk2_dsc")];
    }

    let cleanData:Map<string,Edk2Symbol> = new Map();
    // clean up duplicated
    for (const d of data) {
        if(!d.name.includes("[")){
            cleanData.set(d.name,d);
        }
    }
    let retData = [];
    for (const d of cleanData.values()) {
        retData.push(new vscode.CompletionItem({label:d.name, detail:` ${path.basename(d.filePath)}`, description:""}, vscode.CompletionItemKind.Enum));
    }

    return retData;
}


export async function gotoFunction (symbol: Edk2Symbol, documentSymbols: Edk2DocumentSymbols, parser: EdkDatabase){
    let locations = await  getDefinitionLocationsSelected();
    let filteredLocations = [];
    if(locations){
        for (const loc of locations) {
            if(loc.uri.fsPath.toLowerCase().endsWith("c")){
                filteredLocations.push(loc);
            }
        }
    }

    return filteredLocations;
  }

export async function gotoInfDefine(symbol: Edk2Symbol, edkDatabase: EdkDatabase, infParser: LanguageParser) {
    gDebugLog.verbose("gotoInfDefine()");
    let selectedText = getCurrentWord();
    switch (symbol.name.toUpperCase()) {
        case "CONSTRUCTOR":
            gDebugLog.verbose("Constructor");
            
            let locations = await gCscope.getDefinitionPositions(selectedText.word, false);
            let filteredLocations = [];
            if(locations){
                for (const loc of locations) {
                    if(loc.uri.fsPath.toLowerCase().endsWith("c")){
                        filteredLocations.push(loc);
                    }
                }
            }
        
            return filteredLocations;
        
        case ("LIBRARY_CLASS"):
        case ("MODULE_TYPE"):
            gDebugLog.verbose("Library_class|Module_type");
            let symbolsList = edkDatabase.findByName(symbol.name, "edk2_inf");
            let libClassLocations:vscode.Location[] = [];
            for (const s of symbolsList) {
                let values = s.value.split(" ");
                for (const val of values) {
                    if(val.toLowerCase()===selectedText.word.toLowerCase()){
                        libClassLocations.push(s.location);
                        break;
                    }
                }
            }
            return libClassLocations;
        default:
            break;
    }
}


export async function infGotoLibraryDeclaration(symbol: Edk2Symbol, edkDatabase: EdkDatabase, infParser: LanguageParser) {
    
    let symbols = await gEdkDatabase.getLibraryDefinition(symbol);
    let locations:vscode.Location[]= [];
    for (const s of symbols) {
        locations.push(s.location);
    }
    return locations;

}




export async function infGotoLibraryDefinition(symbol: Edk2Symbol, edkDatabase: EdkDatabase, infParser: LanguageParser) {
    let symbols = await gEdkDatabase.getLibraryDefinition(symbol);
    let locations:vscode.Location[]= [];

    for (const s of symbols) {
        let libraryClass = await gEdkDatabase.findByName("library_class", "edk2_inf", s.value);
        if(libraryClass.length){
            for (const result of libraryClass) {
                locations.push(result.location);
            }
        }else{
            locations.push(new vscode.Location(vscode.Uri.file(s.value), createRange()));
        }
    }
    
    return locations;
    
}
