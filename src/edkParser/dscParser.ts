
import * as vscode from 'vscode';
import { BlockParser, DocumentParser } from "./languageParser";
import path = require("path");
import { Edk2SymbolType } from '../symbols/symbolsType';
import { REGEX_DEFINE, REGEX_INCLUDE } from './commonParser';


export const UNDEFINED_VARIABLE = "???";

class BlockIncludes extends BlockParser {
    name = "Include";
    type = Edk2SymbolType.dscInclude;
    tag = REGEX_INCLUDE;
    start = undefined;
    end = undefined;
    visible:boolean = true;
}



class BlockComponentInf extends BlockParser {
    name= "ComponentInf";
    tag= /^[\s\.\w\$\(\)_\-\\\/]*\.inf/gi;
    start= /.*?{/;
    end= /(^\})|(^\[)|(^[\s\.\w\$\(\)_\-\\\/]*\.inf)|(^\!include)/gi;
    type= Edk2SymbolType.dscModuleDefinition;

    visible:boolean = true;
    context: BlockParser[] = [
        new BlocklibraryDef(),
        new BlockPcd(),
    ];
}

class BlockComponentsSection extends BlockParser {
    name= "Components";
    tag= /\[\s*components.*?\]/gi;
    start= undefined;
    end= /^\[/gi;
    type= Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockComponentInf(),

        new BlockIncludes(),
        
        
    ];




}



class BlocklibraryDef extends BlockParser {

    name= "libraryDef";
    tag= /^\w*\s*\|\s*[\s\.\w\$\(\)_\-\\\/]*\.inf/gi;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.dscLibraryDefinition;
    visible:boolean = true;


}

class BlockflashDefinition extends BlockParser {


    name= "flashDefinition";
    tag= /^flash_definition\s*\=\s*.*/gi;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.dscLibraryDefinition;
    visible:boolean = true;

}



class BlockDefinition extends BlockParser {

    name= "Definition";
    tag= REGEX_DEFINE;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.dscDefine;
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

//
// Main sections
//

class BlockDefines extends BlockParser {
    name= "Defines";
    tag= /\[\s*(defines|buildoptions)\s*\]/gi;
    start= undefined;
    end= /^\[/gi;
    type= Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockflashDefinition(),
        new BlockDefinition(),
        new BlockIncludes(),
        
    ];
}


class BlockSkuIds extends BlockParser {
    
    name = "SkuIds";
    tag = /\[\s*(skuids)\s*\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockIncludes(),
        
    ];



}

class BlockLibraryClasses extends BlockParser {

    name = "LibraryClasses";
    tag = /\[\s*libraryclasses.*?\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlocklibraryDef(),
        new BlockIncludes(),
        
    ];

}



class BlockPcd extends BlockParser {
    name = "Pcds";
    tag = /.*?\..*?\|.*$/gi;
    start = undefined;
    end = undefined;
    type = Edk2SymbolType.dscPcdDefinition;
    visible:boolean = true;
    context: BlockParser[] = [];

}

class BlockPcdSection extends BlockParser {
    name = "PcdSection";
    tag = /\[\s*pcds.*?\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.dscSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPcd(),
        new BlockIncludes(),
        
    ];
}

class BlockGenericSection extends BlockParser {
    name = "SectionUnknown";
    tag = /\[/gi;
    start = undefined;
    end = /\[/gi;
    type = Edk2SymbolType.unknown;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockIncludes(),
        
    ];


}



export class DscParser extends DocumentParser {

    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];

    privateDefines: Map<string, string> = new Map<string, string>();

    blockParsers: BlockParser[] = [
            new BlockDefines(),
            new BlockComponentsSection(),
            new BlockLibraryClasses(),
            new BlockSkuIds(),
            new BlockPcdSection(),
            new BlockGenericSection(),

            new BlockDefinition(true),
            new BlockIncludes(true),
            new BlockComponentInf(true),
            new BlocklibraryDef(true),
            new BlockPcd(true),
    ];




}
