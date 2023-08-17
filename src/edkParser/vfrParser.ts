import { Edk2SymbolType } from "./edkSymbols";
import { LanguageParser } from "./languageParser";


export class VfrParser extends LanguageParser {


    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["//"];



    blocks: any[] = [
        {name: "formset" , tag : /\bformset\b/gi, start: undefined, end: /^endformset/gi , type: Edk2SymbolType.vfrFormset, inBlockFunction:undefined },
        {name: "form"    , tag    : /\bform\b/gi, start: undefined, end: /^endform/gi    , type: Edk2SymbolType.vfrForm, inBlockFunction:undefined },
        {name: "oneof"   , tag   : /\boneof\b/gi, start: undefined, end: /^endoneof/gi   , type: Edk2SymbolType.vfrOneof, inBlockFunction:undefined },
        {name: "checkbox", tag: /\bcheckbox\b/gi, start: undefined, end: /^endcheckbox/gi, type: Edk2SymbolType.vfrCheckbox, inBlockFunction:undefined },
        {name: "string"  , tag  : /\bstring\b/gi, start: undefined, end: /^endstring/gi  , type: Edk2SymbolType.vfrString, inBlockFunction:undefined },
        {name: "password", tag: /\bpassword\b/gi, start: undefined, end: /^endpassword/gi, type: Edk2SymbolType.vfrPassword, inBlockFunction:undefined },
        {name: "numeric" , tag : /\bnumeric\b/gi, start: undefined, end: /^endnumeric/gi , type: Edk2SymbolType.vfrNumeric, inBlockFunction:undefined },
        {name: "goto"    , tag    : /\bgoto\b/gi, start: undefined, end: undefined     , type: Edk2SymbolType.vfrGoto, inBlockFunction:undefined }

        // { name: "option", start: undefined, end: undefined  , type:Edk2SymbolType.unknown },
        // { name: "text", start: undefined, end: undefined  , type:Edk2SymbolType.unknown },
        // { name: "efivarstore", start: undefined, end: undefined  , type:Edk2SymbolType.unknown },
        // { name: "varstore", start: undefined, end: undefined  , type:Edk2SymbolType.unknown },
        // { name: "defaultstore", start: undefined, end: undefined  , type:Edk2SymbolType.unknown },
    ];

}