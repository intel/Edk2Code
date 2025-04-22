import * as vscode from 'vscode';
import { gDebugLog } from '../extension';
import { Edk2SymbolType, typeToStr } from './symbolsType';
import { DocumentParser } from '../edkParser/languageParser';
import { SectionProperties } from '../index/edkWorkspace';
import { ParserFactory } from '../edkParser/parserFactory';
import path = require('path');




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

    sectionProperties: SectionProperties;
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
        let parent = parser.symbolStack[parser.symbolStack.length - 1];
        this.sectionProperties = new SectionProperties();
        if(parent){
            this.sectionProperties = parent.sectionProperties;
        }
        gDebugLog.trace(`Symbol Created: ${location.range.start.line}: ${this.toString()}`);
    }

    async decCompletion(type:Edk2SymbolType, completionKind:vscode.CompletionItemKind=vscode.CompletionItemKind.File){
        let retData = [];
        let factory = new ParserFactory();
        let decs = this.parser.getSymbolsType(Edk2SymbolType.infPackage);
        for (const dec of decs) {
            let decTextPath = await dec.getValue();
            let document = await vscode.workspace.openTextDocument(vscode.Uri.file(decTextPath));
            let decParser = factory.getParser(document);
            if(decParser){
                await decParser.parseFile();
                let decPpis = decParser.getSymbolsType(type);
                for (const decPpi of decPpis) {
                    let decPpiValue = await decPpi.getKey();
                    retData.push(new vscode.CompletionItem({label:decPpiValue, detail:" " + path.basename(decPpi.location.uri.fsPath), description:""}, completionKind));
                }
            }
        }
        return retData;
    }

    async isInDec(type:Edk2SymbolType){
        let factory = new ParserFactory();
        let decs = this.parser.getSymbolsType(Edk2SymbolType.infPackage);
        const testKey = await this.getKey();
        for (const dec of decs) {
            let decTextPath = await dec.getValue();
            let document = await vscode.workspace.openTextDocument(vscode.Uri.file(decTextPath));
            let decParser = factory.getParser(document);
            if(decParser){
                await decParser.parseFile();
                let decSymbols = decParser.getSymbolsType(type);
                for (const decSymbol of decSymbols) {
                    const symbolKey = await decSymbol.getKey();
                    if(symbolKey === testKey){
                        return true;
                    }
                }
            }
        }
        return false;
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

