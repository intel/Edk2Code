
import { Edk2SymbolType } from "../symbols/symbolsType";
import { createRange, split } from "../utils";
import { REGEX_ANY_BUT_SECTION, REGEX_DEFINE } from "./commonParser";
import { BlockParser, DocumentParser } from "./languageParser";


class BlockFormsetSection extends BlockParser {
    name = "Formset";
    tag = /\bformset\b/gi;
    start =  undefined;
    end =/^endformset/gi;
    type = Edk2SymbolType.vfrFormset;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockOneOfSection(),
        new BlockNumericSection(),
        new BlockCheckboxSection(),
        new BlockCheckboxSection(),
        new BlockStringSection(),
        new BlockPasswordSection(),
        new BlockGotoSection()
    ];
}

class BlockFormSection extends BlockParser {
    name = "Form";
    tag = /\bform\b/gi;
    start =  undefined;
    end =/^endform/gi;
    type = Edk2SymbolType.vfrForm;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockOneOfSection(),
        new BlockNumericSection(),
        new BlockCheckboxSection(),
        new BlockCheckboxSection(),
        new BlockStringSection(),
        new BlockPasswordSection(),
        new BlockGotoSection()
    ];
}


class BlockPrompt extends BlockParser {
    name = "Prompt";
    tag = /\bprompt\b/gi;
    start =  undefined;
    end =undefined;
    type = Edk2SymbolType.vfrString;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}

class BlockOneOfSection extends BlockParser {
    name = "OneOf";
    tag = /\boneof\b/gi;
    start =  undefined;
    end =/^endoneof/gi;
    type = Edk2SymbolType.vfrOneof;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPrompt(),
    ];
}

class BlockCheckboxSection extends BlockParser {
    name = "Checkbox";
    tag = /\bcheckbox\b/gi;
    start =  undefined;
    end =/^endcheckbox/gi;
    type = Edk2SymbolType.vfrCheckbox;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPrompt(),
    ];
}

class BlockStringSection extends BlockParser {
    name = "String";
    tag = /\bstring\b/gi;
    start =  undefined;
    end =/^endstring/gi;
    type = Edk2SymbolType.vfrString;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}

class BlockPasswordSection extends BlockParser {
    name = "Password";
    tag = /\bpassword\b/gi;
    start =  undefined;
    end =/^endpassword/gi;
    type = Edk2SymbolType.vfrPassword;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPrompt(),
    ];
}

class BlockNumericSection extends BlockParser {
    name = "Numeric";
    tag = /\bnumeric\b/gi;
    start =  undefined;
    end =/^endnumeric/gi;
    type = Edk2SymbolType.vfrNumeric;
    visible:boolean = true;
    context: BlockParser[] = [
        new BlockPrompt(),
    ];
}

class BlockGotoSection extends BlockParser {
    name = "Goto";
    tag = /\bgoto\b/gi;
    start = undefined;
    end = undefined;
    type = Edk2SymbolType.vfrGoto;
    visible:boolean = true;
    context: BlockParser[] = [

    ];
}


export class VfrParser extends DocumentParser {
    commentStart: string = "/*";
    commentEnd: string = "*/";
    commentLine: string[] = ["//"];
    
    blockParsers: BlockParser[] = [

        new BlockFormsetSection(),
        new BlockFormSection(),
        new BlockOneOfSection(),
        new BlockCheckboxSection(),
        new BlockStringSection(),
        new BlockPasswordSection(),
        new BlockNumericSection(),
        new BlockGotoSection(true),

];
}



