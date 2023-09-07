
import { Edk2SymbolType } from "../symbols/symbolsType";
import { createRange, split } from "../utils";
import { REGEX_ANY_BUT_SECTION, REGEX_DEFINE } from "./commonParser";
import { BlockParser, DocumentParser } from "./languageParser";


class BlockDefinitionBlock extends BlockParser {
    name = "DefinitionBlock";
    tag = /\bDefinitionBlock\b/gi;
    start =  /\{/gi;
    end =  /\}/gi;
    type = Edk2SymbolType.aslDefinitionBlock;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockExternal(),
        new BlockScope(),
        new BlockDevice(),
        new BlockName(),
        new BlockMethod(),
        new BlockField(),
        new BlockOperationRegion(),
    ];
}

class BlockExternal extends BlockParser {
    name = "External";
    tag = /\bExternal\b/gi;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.aslExternal;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}

class BlockScope extends BlockParser {
    name = "Scope";
    tag = /\bScope\b/gi;
    start =  /\{/gi;
    end =  /\}/gi;
    type = Edk2SymbolType.aslScope;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockExternal(),
        new BlockName(),
        new BlockField(),
        new BlockOperationRegion(),
        new BlockDevice(),
    ];
}

class BlockDevice extends BlockParser {
    name = "Device";
    tag = /\bDevice\b/gi;
    start =  /\{/gi;
    end =  /\}/gi;
    type = Edk2SymbolType.aslDevice;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockExternal(),
        new BlockName(),
        new BlockField(),
        new BlockOperationRegion(),
        new BlockMethod(),
    ];
}

class BlockName extends BlockParser {
    name = "Name";
    tag = /\bName\b/gi;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.aslName;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}

class BlockMethod extends BlockParser {
    name = "Method";
    tag = /\bMethod\b/gi;
    start =  /\{/gi;
    end =  /\}/gi;
    type = Edk2SymbolType.aslMethod;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockExternal(),
        new BlockName(),
        new BlockField(),
        new BlockOperationRegion(),
    ];
}

class BlockField extends BlockParser {
    name = "Field";
    tag = /\bField\b/gi;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.aslField;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}


class BlockOperationRegion extends BlockParser {
    name = "OperationRegion";
    tag = /\bOperationRegion\b/gi;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.aslOpRegion;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}


export class AslParser extends DocumentParser {
    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["//"];
    
    blockParsers: BlockParser[] = [
new BlockDefinitionBlock(),
new BlockExternal(true),
new BlockScope(),
new BlockDevice(),
new BlockName(true),
new BlockMethod(),
new BlockField(true),
new BlockOperationRegion(true),

];
}
