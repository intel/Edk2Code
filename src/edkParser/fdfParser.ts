
import { Edk2SymbolType } from "../symbols/symbolsType";
import { createRange, split } from "../utils";
import { REGEX_DEFINE, REGEX_INCLUDE } from "./commonParser";
import { BlockParser, DocumentParser } from "./languageParser";

class BlockIncludes extends BlockParser {
    name = "Include";
    type = Edk2SymbolType.fdfInclude;
    tag = REGEX_INCLUDE;
    start = undefined;
    end = undefined;
    visible:boolean = true;
}

class BlockAprioriInf extends BlockParser {
    name= "Apriori";
    tag= /APRIORI \w+/gi;
    start= /.*?{/;
    end= /(^\})|(^\!include)/gi;
    type= Edk2SymbolType.unknown;

    visible:boolean = true;
    context: BlockParser[] = [
        new BlockComponentInf(),
    ];
}


class BlockComponentInf extends BlockParser {
    name= "ComponentInf";
    tag= /^INF\s+[\s\.\w\$\(\)_\-\\\/]*\.inf/gi;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.fdfInf;

    visible:boolean = true;
}

class BlockSimpleLine extends BlockParser {

    name= "Text";
    tag= /.*/gi;
    excludeTag = /^\[/gi;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.unknown;
    visible:boolean = true;

}

class BlockDefinition extends BlockParser {
    name= "Definition";
    tag= REGEX_DEFINE;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.fdfDefinition;
    visible:boolean = true;

}

class BlockFV extends BlockParser {
    name = "FV";
    tag = /^\[\s*FV\./gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.fdfSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockComponentInf(),
        new BlockAprioriInf(),
        new BlockDefinition(),
        new BlockIncludes(),
        new BlockSimpleLine(),
    ];
}

class BlockFd extends BlockParser {
    name = "FD";
    tag = /^\[\s*FD\./gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.fdfSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockDefinition(),
        new BlockIncludes(),
        new BlockSimpleLine(),
    ];
}

class BlockRuleSection extends BlockParser {
    name = "Rule";
    tag = /^\[\s*Rule\./gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.fdfSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockIncludes(),
        new BlockSimpleLine(),
    ];
}


class BlockGenericSection extends BlockParser {
    name = "SectionUnknown";
    tag = /\[/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockIncludes(),
        new BlockSimpleLine()
    ];
}



export class FdfParser extends DocumentParser {

    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];

    privateDefines: Map<string, string> = new Map<string, string>();

    blockParsers: BlockParser[] = [
            new BlockFV(),
            new BlockFd(),
            new BlockRuleSection(),
            new BlockGenericSection(),

            new BlockComponentInf(true),
            new BlockIncludes(true),
    ];




}