import { Edk2SymbolType } from "../edkParser/edkSymbols";
import { gEdkDatabase, gSymbolProducer } from "../extension";
import { createRange, pathCompare, split } from "../utils";
import * as vscode from 'vscode';
import { LanguageParser } from "./languageParser";


export class DscParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];

    
    blocks: any[] = [
        {name:"Components", tag: /\[\s*components.*?\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.dscSection, inBlockFunction:undefined},
        {name:"ComponentInf", tag: /^[\s\.\w\$\(\)_\-\\\/]*\.inf/gi, start: /^\{/, end: /(^\})|(^\[)|(^[\s\.\w\$\(\)_\-\\\/]*\.inf)|(^\!include)/gi, type:Edk2SymbolType.dscModuleDefinition, inBlockFunction:undefined, produce:this.produceInf},
        {name:"libraryDef", tag: /^\w*\s*\|\s*[\s\.\w\$\(\)_\-\\\/]*\.inf/gi, start: undefined, end: undefined, type:Edk2SymbolType.dscLibraryDefinition, inBlockFunction:undefined, produce:this.produceLib},
        {name:"Defines", tag: /\[\s*(defines|buildoptions)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.dscSection, inBlockFunction:this.blockParserBinary, binarySymbol:"=", childType:Edk2SymbolType.dscDefine},
        {name:"Pcds", tag: /\[\s*pcds.*?\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.dscSection, inBlockFunction:this.blockParserBinary, childType:Edk2SymbolType.dscPcdDefinition, binarySymbol:"|"},
        {name:"LibraryClasses", tag: /\[\s*libraryclasses.*?\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.dscSection},
        {name:"Include", tag: /\s*\!include/gi, start: undefined, end: undefined, type:Edk2SymbolType.dscInclude, inBlockFunction:undefined, produce:this.produceInclude},
    ];

    async produceInf(line:string, thisParser:LanguageParser, block:any){
        let symRange;
        if (!line.endsWith("{")) {
            symRange = new vscode.Range(
                new vscode.Position(thisParser.lineNo - 1, 0),
                new vscode.Position(thisParser.lineNo - 1, line.length)
            );
        } else {
            line = line.replace("{","").trim();
            symRange = new vscode.Range(
                new vscode.Position(thisParser.lineNo - 1, 0),
                new vscode.Position(thisParser.linesLength, line.length)
            );
        }
        let value = line;
        let infPath = await thisParser.parseInfPath(line);
        if(infPath){
            value = infPath;
        }
        
        return gSymbolProducer.produce(Edk2SymbolType.dscModuleDefinition, line, "", value, symRange, thisParser.filePath);
        
    }

    
    async produceLib(line:string, thisParser:LanguageParser, block:any){
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        
        let [name,detail] = split(line,"|",2);
        let value = detail;
        let infPath = await thisParser.parseInfPath(detail);
        if(infPath){
            value = infPath;
        }
        return gSymbolProducer.produce(Edk2SymbolType.dscLibraryDefinition, name, detail, value, symRange, thisParser.filePath);
        
    }

    async parseLibrary(line:string, thisParser:LanguageParser, block:any){
        let [name,detail] = split(line,"|",2);
        let value = detail;
        let infPath = await thisParser.parseInfPath(detail);
        if(infPath){
            value = infPath;
        }
        thisParser.pushSimpleSymbol(line,name,detail,value,Edk2SymbolType.dscLibraryDefinition,true);
    }

    async produceInclude(line:string, thisParser:LanguageParser, block:any){
        line = split(line," ",2)[1].trim();
        let value = line;
        let includedPath = await thisParser.edkDatabase.findPath(line);
        if(includedPath){
            value = includedPath;
        }
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        return gSymbolProducer.produce(Edk2SymbolType.dscInclude, "INCLUDE",line,value,symRange, thisParser.filePath);
        
    }
    
}
