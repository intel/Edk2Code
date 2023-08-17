
import { Edk2SymbolType } from "../edkParser/edkSymbols";
import { split } from "../utils";
import { LanguageParser } from "./languageParser";



export class DecParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#", "!"];

    
    blocks: any[] = [
        {name:"Defines", tag: /\[\s*(defines|buildoptions).*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserBinary, binarySymbol:"=", childType:Edk2SymbolType.decDefine},
        {name:"Packages", tag: /\[\s*pacakges.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.decPackage},
        {name:"LibraryClasses", tag: /\[\s*libraryclasses.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.parseLibrary, childType:Edk2SymbolType.decLibrary},
        {name:"Protocols", tag: /\[\s*protocols.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserBinary, childType:Edk2SymbolType.decProtocol, binarySymbol:"="},
        {name:"Ppis", tag: /\[\s*ppis.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserBinary, childType:Edk2SymbolType.decPpi, binarySymbol:"="},
        {name:"Guids", tag: /\[\s*guids.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserBinary, childType:Edk2SymbolType.decGuid, binarySymbol:"="},
        {name:"Pcd", tag: /\[\s*pcd.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserBinary, childType:Edk2SymbolType.decPcd, binarySymbol:"|"},
        {name:"Includes", tag: /\[\s*Includes.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.decSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.decIncludes},

    ];
    

    async parseLibrary(line:string, thisParser:LanguageParser, block:any){
        let [name,detail] = split(line,"|",2);
        let value = detail;
        let filePath = await thisParser.parseInfPath(detail);
        if(filePath){
            value = filePath;
        }
        thisParser.pushSimpleSymbol(line,name,detail,value,Edk2SymbolType.decLibrary,true);
    }



}