import * as vscode from 'vscode';
import { gDebugLog } from '../extension';
import { Edk2SymbolType, typeToStr } from './symbolsType';
import { DocumentParser } from '../edkParser/languageParser';
import { SectionProperties } from '../index/edkWorkspace';
import { getParserForDocument } from '../edkParser/parserFactory';
import path = require('path');
import { debuglog } from 'util';
import { log } from 'console';

let decSymbolCache = new Map<string, string>();


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

    /** Override in subclasses to extract a specific portion of the text line as the symbol name. */
    protected get nameRegex(): RegExp | undefined { return undefined; }

    /** Override in subclasses to extract a description (detail) from the text line. */
    protected get descriptionRegex(): RegExp | undefined { return undefined; }
    



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
        const regex = this.nameRegex;
        if (regex) {
            const match = textLine.match(regex);
            this.name = match ? (match[1] ?? match[0]).trim() : textLine.trim();
        } else {
            this.name = textLine.replaceAll(/\s+/gi, " ");
        }

        const descRegex = this.descriptionRegex;
        if (descRegex) {
            const descMatch = textLine.match(descRegex);
            this.detail = descMatch ? (descMatch[1] ?? descMatch[0]).trim() : '';
        }
        
        let parent = parser.symbolStack[parser.symbolStack.length - 1];
        this.sectionProperties = new SectionProperties();
        if(parent){
            this.sectionProperties = parent.sectionProperties;
        }
        gDebugLog.trace(`Symbol Created: ${location.range.start.line}: ${this.toString()}`);
    }

    async decCompletion(type:Edk2SymbolType, completionKind:vscode.CompletionItemKind=vscode.CompletionItemKind.File){
        let retData = [];
        let decs = this.parser.getSymbolsType(Edk2SymbolType.infPackage);
        for (const dec of decs) {
            let decTextPath = await dec.getValue();
            let document = await vscode.workspace.openTextDocument(vscode.Uri.file(decTextPath));
            let decParser = await getParserForDocument(document);
            if(decParser){
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
        let decs = this.parser.getSymbolsType(Edk2SymbolType.infPackage);
        const testKey = await this.getKey();


        for (const dec of decs) {
            let decTextPath = await dec.getValue();
            if(decSymbolCache.has(testKey)){
                let cachedPath = decSymbolCache.get(testKey);
                if(cachedPath === decTextPath){
                    return true;
                }
            }
            let document = await vscode.workspace.openTextDocument(vscode.Uri.file(decTextPath));
            let decParser = await getParserForDocument(document);
            if(decParser){
                let decSymbols = decParser.getSymbolsType(type);
                for (const decSymbol of decSymbols) {
                    
                    const symbolKey = await decSymbol.getKey();
                    decSymbolCache.set(symbolKey, decTextPath);
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
        // gDebugLog.warning(`getValue not implemented for ${this.type}`);
        return this.textLine;
    }

    async getKey(){
        // gDebugLog.warning(`getKey not implemented for ${this.type}`);
        return this.textLine;
    }

    static iconForKind(kind: vscode.SymbolKind): vscode.ThemeIcon {
        const map: Partial<Record<vscode.SymbolKind, string>> = {
            [vscode.SymbolKind.File]:          'symbol-file',
            [vscode.SymbolKind.Module]:        'symbol-module',
            [vscode.SymbolKind.Namespace]:     'symbol-namespace',
            [vscode.SymbolKind.Package]:       'symbol-package',
            [vscode.SymbolKind.Class]:         'symbol-class',
            [vscode.SymbolKind.Method]:        'symbol-method',
            [vscode.SymbolKind.Property]:      'symbol-property',
            [vscode.SymbolKind.Field]:         'symbol-field',
            [vscode.SymbolKind.Constructor]:   'symbol-constructor',
            [vscode.SymbolKind.Enum]:          'symbol-enum',
            [vscode.SymbolKind.Interface]:     'symbol-interface',
            [vscode.SymbolKind.Function]:      'symbol-function',
            [vscode.SymbolKind.Variable]:      'symbol-variable',
            [vscode.SymbolKind.Constant]:      'symbol-constant',
            [vscode.SymbolKind.String]:        'symbol-string',
            [vscode.SymbolKind.Number]:        'symbol-number',
            [vscode.SymbolKind.Boolean]:       'symbol-boolean',
            [vscode.SymbolKind.Array]:         'symbol-array',
            [vscode.SymbolKind.Object]:        'symbol-object',
            [vscode.SymbolKind.Key]:           'symbol-key',
            [vscode.SymbolKind.Null]:          'symbol-null',
            [vscode.SymbolKind.EnumMember]:    'symbol-enum-member',
            [vscode.SymbolKind.Struct]:        'symbol-struct',
            [vscode.SymbolKind.Event]:         'symbol-event',
            [vscode.SymbolKind.Operator]:      'symbol-operator',
            [vscode.SymbolKind.TypeParameter]: 'symbol-type-parameter',
        };
        return new vscode.ThemeIcon(map[kind] ?? 'symbol-misc');
    }

}

