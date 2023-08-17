import { Edk2SymbolType } from "../edkParser/edkSymbols";
import { gEdkDatabase, gGrayOutController, gSymbolProducer } from "../extension";
import { createRange, split } from "../utils";
import { LanguageParser } from "./languageParser";


export class InfParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];


    blocks: any[] = [
        {name:"Packages", tag: /\[\s*(packages.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.infPackage},
        {name:"Sources", tag: /\[\s*(sources.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.infSource},
        {name:"Defines", tag: /\[\s*(defines.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserBinary, binarySymbol: "=", childType:Edk2SymbolType.infDefine},
        {name:"Libraryclasses", tag: /\[\s*libraryclasses.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionLibraries, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infLibrary},
        {name:"Definition", tag: /^define .+/gi, start: undefined, end: undefined, type:Edk2SymbolType.infDefine, produce:this.produceDefine},
        {name:"Protocols", tag: /\[\s*protocols.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionProtocols, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infProtocol},
        {name:"Ppis", tag: /\[\s*ppis.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionPpis, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infPpi},
        {name:"Guids", tag: /\[\s*guids.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionGuids, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infGuid},
        {name:"Pcd", tag: /\[\s*(fixed)?pcd.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionPcds, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infPcd},
        {name:"Binaries", tag: /\[\s*(binaries.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infBinary},
        {name:"depex", tag: /\[\s*(depex.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infDepex},
    ];

    async produceDefine(line:string, thisParser:LanguageParser, block:any){
        let symRange = createRange(thisParser.lineNo-1,thisParser.lineNo-1, line.length);
        line = line.replaceAll(/DEFINE/gi,"").trim();
        let [key,value] = split(line,"=",2);
        thisParser.edkDatabase.setBuildDefine(key,value);
        return gSymbolProducer.produce(Edk2SymbolType.infDefine, key, value, value, symRange, thisParser.filePath);
    }

    async postParse(): Promise<void> {
        
        let inactiveSymbols = await this.edkDatabase.getInactiveLibraries(this.filePath);
        this.edkDatabase.clearInactiveLines(this.filePath);
        for (const inac of inactiveSymbols) {
            this.edkDatabase.addInactiveLine(this.filePath,inac.range.start.line+1);
        }
        await gGrayOutController.doGrayOut();
    }





}