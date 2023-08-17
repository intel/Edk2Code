import { Edk2SymbolType } from "../edkParser/edkSymbols";
import { gSymbolProducer } from "../extension";
import { createRange, split } from "../utils";
import { LanguageParser } from "./languageParser";


export class FdfParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];

    
    blocks: any[] = [
        {name:"Defines", tag: /\[\s*(.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.fdfSection},
        {name:"Inf", tag: /INF .+?\.inf/gi, start: undefined, end: undefined, type:Edk2SymbolType.fdfInf, produce:this.produceInf},
        {name:"Definition", tag: /^(?!file|\!).*?\=.*/gi, start: undefined, end: undefined, type:Edk2SymbolType.fdfDefinition, produce:this.produceDefinition},
        {name:"file", tag: /file .+?\{/gi, start: /\{/gi, end:/\}/gi, type:Edk2SymbolType.fdfFile}
        
    ];

    async produceInf(line:string, thisParser:LanguageParser, block:any){
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        return gSymbolProducer.produce(Edk2SymbolType.fdfInf, line, "", line, symRange, thisParser.filePath);

    }

    async produceFile(line:string, thisParser:LanguageParser, block:any){
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        return gSymbolProducer.produce(Edk2SymbolType.fdfFile, line, "", line, symRange, thisParser.filePath);

    }

    async produceDefinition(line:string, thisParser:LanguageParser, block:any){
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        let [key, value] = split(line,'=',2);
        return gSymbolProducer.produce(Edk2SymbolType.fdfDefinition, key, value, line, symRange, thisParser.filePath);

    }




}