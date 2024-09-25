import * as vscode from 'vscode';
import { gDebugLog } from '../extension';
import { Edk2SymbolType, typeToStr } from './symbolsType';
import { DocumentParser } from '../edkParser/languageParser';



export interface Edk2SymbolProperties {
    sectionType: string;
    arch: string;
    moduleType: string;
}




export abstract class EdkSymbol extends vscode.DocumentSymbol {
    type: Edk2SymbolType = Edk2SymbolType.unknown;

    // Events
    abstract onCompletion: undefined|Function;
    abstract onDefinition: undefined|Function;
    abstract onHover: undefined|Function;
    abstract onDeclaration: undefined|Function;

    location: vscode.Location;
    
    enabled: boolean = true;
    visible: boolean = true;

    properties: Edk2SymbolProperties[] = [];
    parent: EdkSymbol | undefined = undefined;

    guid:string = "";
    parser:DocumentParser;
    

    protected _textLine: string;
    public get textLine(): string {
        return this.parser.defines.replaceDefines(this._textLine);
    }
    public set textLine(value: string) {
        this._textLine = value;
    }

    updateRange(range:vscode.Range){
        this.location.range = range;
        this.range = range;
        this.selectionRange = range;
    }



    public constructor(textLine: string, location: vscode.Location, enabled: boolean, visible: boolean, parser:DocumentParser) {
        super(textLine, "", vscode.SymbolKind.Null,
            location.range,
            location.range);
        
        // Debug
        // this.detail = this.constructor.toString().match(/\w+/g)![1];

        this.enabled = enabled;
        this.visible = visible;
        this.location = location;
        this._textLine = textLine;
        this.parser = parser;
        this.name = textLine.replaceAll(/\s+/gi," ");
        console.log(`SYMBOL: ${textLine}`);
        gDebugLog.verbose(`Symbol Created: ${location.range.start.line}: ${this.toString()}`);
    }

    toString() {
        return `(${this.range.start.line + 1},${this.range.start.character}),(${this.range.end.line + 1},${this.range.end.character})(${this.typeToString()}): ${this.name}`;
    }


    typeToString() {
        return typeToStr.get(this.type);
    }

    async getValue(){
        gDebugLog.error(`getValue not implemented for ${this.type}`);
        return this.textLine;
    }

    async getKey(){
        gDebugLog.error(`getKey not implemented for ${this.type}`);
        return this.textLine;
    }

}

