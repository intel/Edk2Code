
import * as vscode from 'vscode';
import { BlockParser, DocumentParser } from "./languageParser";
import path = require("path");
import { Edk2SymbolType } from '../symbols/symbolsType';
import { REGEX_ANY_BUT_SECTION, REGEX_DEFINE, REGEX_GUID, REGEX_INCLUDE, REGEX_PATH_FILE, REGEX_PATH_FOLDER } from './commonParser';






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
    type= Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockComponentInf(),

        
        
    ];

}


class BlocklibraryDef extends BlockParser {

    name= "Library";
    tag= REGEX_PATH_FILE;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.decLibrary;
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



//
// Main sections
//

class BlockDefines extends BlockParser {
    name= "Defines";
    tag= /\[\s*(defines|buildoptions)\s*\]/gi;
    start= undefined;
    end= /^\[/gi;
    type= Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockDefinition(),
    ];
}


class BlockSkuIds extends BlockParser {
    
    name = "SkuIds";
    tag = /\[\s*(skuids)\s*\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        
    ];



}

class BlockLibraryClasses extends BlockParser {

    name = "LibraryClasses";
    tag = /\[\s*libraryclasses.*?\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlocklibraryDef(),
        
    ];

}



class BlockPcd extends BlockParser {
    name = "Pcds";
    tag = REGEX_ANY_BUT_SECTION;
    start = undefined;
    end = undefined;
    type = Edk2SymbolType.decPcd;
    visible:boolean = true;
    context: BlockParser[] = [];

}

class BlockPcdSection extends BlockParser {
    name = "PcdSection";
    tag = /\[\s*pcds.*?\]/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPcd(),
        
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
        
    ];


}



class BlockInclude extends BlockParser {

    name= "Include";
    tag= REGEX_PATH_FOLDER;
    excludeTag = undefined;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.decInclude;
    visible:boolean = true;

}

class BlockIncludeSection extends BlockParser {
    name = "Includes";
    tag = /\[\s*includes.*?\]/gi;
    start = undefined;
    end = /\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockInclude(),
    ];


}



class BlockGuid extends BlockParser {

    name= "Guid";
    tag= REGEX_ANY_BUT_SECTION;
    excludeTag = undefined;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.decGuid;
    visible:boolean = true;

}
class BlockGuidsSection extends BlockParser {
    name = "Guids";
    tag = /\[\s*Guids.*?\]/gi;
    start = undefined;
    end = /\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockGuid(),
    ];


}

class BlockProtocol extends BlockParser {

    name= "Protocol";
    tag= REGEX_GUID;
    excludeTag = undefined;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.decProtocol;
    visible:boolean = true;

}
class BlockProtocolsSection extends BlockParser {
    name = "Protocols";
    tag = /\[\s*Protocols.*?\]/gi;
    start = undefined;
    end = /\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockProtocol(),
    ];


}


class BlockPpi extends BlockParser {

    name= "Ppi";
    tag= REGEX_ANY_BUT_SECTION;
    excludeTag = undefined;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.decPpi;
    visible:boolean = true;

}
class BlockPpisSection extends BlockParser {
    name = "Ppis";
    tag = /\[\s*Ppis.*?\]/gi;
    start = undefined;
    end = /\[/gi;
    type = Edk2SymbolType.decSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPpi(),
    ];


}



export class DecParser extends DocumentParser {

    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];

    privateDefines: Map<string, string> = new Map<string, string>();

    blockParsers: BlockParser[] = [
            new BlockDefines(),
            new BlockIncludeSection(),
            new BlockGuidsSection(),
            new BlockProtocolsSection(),
            new BlockPpisSection(),
            new BlockLibraryClasses(),
            new BlockPcdSection(),
            new BlockGenericSection(),

    ];

}

