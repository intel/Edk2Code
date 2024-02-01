
import { Edk2SymbolType } from "../symbols/symbolsType";
import { createRange, split } from "../utils";
import { REGEX_ANY_BUT_SECTION, REGEX_DEFINE } from "./commonParser";
import { BlockParser, DocumentParser } from "./languageParser";

class BlockModuleType extends BlockParser {
    name= "ModuleType";
    tag= /MODULE_TYPE\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockBaseName extends BlockParser {
    name= "BaseName";
    tag= /BASE_NAME\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockEntryPoint extends BlockParser {
    name= "EntryPoint";
    tag= /ENTRY_POINT\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockLibraryClass extends BlockParser {
    name= "LibraryClass";
    tag= /LIBRARY_CLASS\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockConstructor extends BlockParser {
    name= "Constructor";
    tag= /CONSTRUCTOR\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockDestructor extends BlockParser {
    name= "Destructor";
    tag= /DESTRUCTOR\s*\=/gi;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockDefinition extends BlockParser {
    name= "Definition";
    tag= REGEX_DEFINE;
    start = undefined;
    end = undefined;
    type= Edk2SymbolType.infDefine;
    visible:boolean = true;
}

class BlockDefinesSection extends BlockParser {
    name = "Defines";
    tag = /^\[\s*Defines/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSection;
    visible:boolean = true;
    context: BlockParser[] = [

        new BlockModuleType(),
        new BlockBaseName(),
        new BlockEntryPoint(),
        new BlockLibraryClass(),
        new BlockConstructor(),
        new BlockDestructor(),
        new BlockDefinition(),
        new BlockSimpleLine(),
    ];
}


class BlockSource extends BlockParser {
    name = "Source";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infSource;
    visible:boolean = true;

}
class BlockSourcesSection extends BlockParser {
    name = "Sources";
    tag = /^\[\s*Sources/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionSource;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockSource(),
        new BlockSimpleLine(),
    ];
}


class BlockPackage extends BlockParser {
    name = "Package";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infPackage;
    visible:boolean = true;

}
class BlockPackagesSection extends BlockParser {
    name = "Packages";
    tag = /^\[\s*Packages/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionPackages;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPackage(),
        new BlockSimpleLine(),
    ];
}


class BlockLibrary extends BlockParser {
    name = "Library";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infLibrary;
    visible:boolean = true;
}

class BlockLibraryClassesSection extends BlockParser {
    name = "LibraryClasses";
    tag = /^\[\s*LibraryClasses/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionLibraries;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockLibrary(),
        new BlockSimpleLine(),
    ];
}

class BlockGuid extends BlockParser {
    name = "Guid";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infGuid;
    visible:boolean = true;
}

class BlockDepex extends BlockParser {
    name = "Depex";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infDepex;
    visible:boolean = true;

}

class BlockGuidsSection extends BlockParser {
    name = "Guids";
    tag = /^\[\s*Guids/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionGuids;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockGuid(),
        new BlockSimpleLine(),
    ];
}


class BlockProtocol extends BlockParser {
    name = "Protocol";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infProtocol;
    visible:boolean = true;
}

class BlockProtocolsSection extends BlockParser {
    name = "Protocols";
    tag = /^\[\s*Protocols/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionProtocols;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockProtocol(),
        new BlockSimpleLine(),
    ];
}

class BlockPpi extends BlockParser {
    name = "Ppi";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infPpi;
    visible:boolean = true;
}

class BlockPpisSection extends BlockParser {
    name = "Ppi";
    tag = /^\[\s*Ppis/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionPpis;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPpi(),
    ];
}

class BlockPcd extends BlockParser {
    name = "Pcd";
    tag = REGEX_ANY_BUT_SECTION;
    start =  undefined;
    end =  undefined;
    type = Edk2SymbolType.infPcd;
    visible:boolean = true;
}

class BlockPcdSection extends BlockParser {
    name = "Pcd";
    tag = /^\[\s*(feature|fixed)?Pcd/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionPcds;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPcd(),
        new BlockSimpleLine(),
    ];
}

class BlockDepexSection extends BlockParser {
    name = "Depex";
    tag = /^\[\s*Depex/gi;
    start =  undefined;
    end =  /^\[/gi;
    type = Edk2SymbolType.infSectionDepex;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockDepex(),
    ];
}

class BlockSimpleLine extends BlockParser {
    name= "Text";
    tag= REGEX_ANY_BUT_SECTION;
    excludeTag = /^\[/gi;
    start= undefined;
    end= undefined;
    type= Edk2SymbolType.unknown;
    visible:boolean = true;
}

class BlockGenericSection extends BlockParser {
    name = "SectionUnknown";
    tag = /\[/gi;
    start = undefined;
    end = /^\[/gi;
    type = Edk2SymbolType.infSection;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockSimpleLine()
    ];
}

export class InfParser extends DocumentParser {
    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["#"];
    
    blockParsers: BlockParser[] = [

        new BlockSourcesSection(),
        new BlockPackagesSection(),
        new BlockLibraryClassesSection(),
        new BlockGuidsSection(),
        new BlockPpisSection(),
        new BlockProtocolsSection(),
        new BlockPcdSection(),
        new BlockDepexSection(),
        
        new BlockDefinesSection(),
        new BlockGenericSection(),
];

    isLibrary(){
        if(this.document.getText().match(/^\s*library_class\s*=/gmi)){
            return true;
        }
        return false;
    }
}

// export class XInfParser extends LanguageParser {

//     blockParsers: BlockParser[] = [];
//     commentStart: string = "/*";
//     commentEnd: string = "*/";
//     commentLine: string[] = ["#"];


    // blocks: any[] = [
    //     {name:"Packages", tag: /\[\s*(packages.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.infPackage},
    //     {name:"Sources", tag: /\[\s*(sources.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserPath, childType:Edk2SymbolType.infSource},
    //     {name:"Defines", tag: /\[\s*(defines.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserBinary, binarySymbol: "=", childType:Edk2SymbolType.infDefine},
    //     {name:"Libraryclasses", tag: /\[\s*libraryclasses.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionLibraries, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infLibrary},
    //     {name:"Definition", tag: /^define .+/gi, start: undefined, end: undefined, type:Edk2SymbolType.infDefine, produce:this.produceDefine},
    //     {name:"Protocols", tag: /\[\s*protocols.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionProtocols, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infProtocol},
    //     {name:"Ppis", tag: /\[\s*ppis.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionPpis, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infPpi},
    //     {name:"Guids", tag: /\[\s*guids.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionGuids, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infGuid},
    //     {name:"Pcd", tag: /\[\s*(fixed)?pcd.*?\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSectionPcds, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infPcd},
    //     {name:"Binaries", tag: /\[\s*(binaries.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infBinary},
    //     {name:"depex", tag: /\[\s*(depex.*?)\s*\]/gi, start: undefined, end: /^\[/gi, type:Edk2SymbolType.infSection, inBlockFunction:this.blockParserLine, childType:Edk2SymbolType.infDepex},
    // ];




// }