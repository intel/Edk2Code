
import * as vscode from 'vscode';
import { gotoValueFile, completionInfLibraries, infGotoLibraryDeclaration, gotoDecName, gotoFunction, gotoFolder, infGotoLibraryDefinition, completionInfCommon, gotoInfDefine } from '../Languages/edkOnEventFunctions';
import { EdkDatabase } from './edkDatabase';
import { split } from '../utils';
import { gDebugLog, gEdkDatabase } from '../extension';





export enum Edk2SymbolType {
    dscDefine,
    dscLibraryDefinition,
    dscModuleDefinition,
    dscSection,
    dscPcdDefinition,
    dscInclude,
    infDefine,
    infSource,
    infPackage,
    infPpi,
    infProtocol,
    infPcd,
    infGuid,
    infDepex,
    infLibrary,
    infBinary,
    infSectionLibraries,
    infSectionProtocols,
    infSectionPpis,
    infSectionGuids,
    infSectionPcds,
    infSection,
    infFunction,
    decSection,
    decDefine,
    decPackage,
    decPpi,
    decProtocol,
    decPcd,
    decIncludes,
    decLibrary,
    decGuid,
    aslDefinitionBlock,
    aslExternal,
    aslScope,
    aslDevice,
    aslName,
    aslMethod,
    aslField,
    aslOpRegion,
    aslDefault,
    vfrDefault,
    vfrFormset,
    vfrForm,
    vfrOneof,
    vfrCheckbox,
    vfrString,
    vfrPassword,
    vfrNumeric,
    vfrGoto,
    fdfSection,
    fdfInf,
    fdfDefinition,
    fdfFile,
    unknown,
}

export var typeToStr:Map<Edk2SymbolType, string> = new Map(
    [
        [Edk2SymbolType.dscDefine,"dscDefine"],
        [Edk2SymbolType.dscLibraryDefinition,"dscLibraryDefinition"],
        [Edk2SymbolType.dscModuleDefinition,"dscModuleDefinition"],
        [Edk2SymbolType.dscSection,"dscSection"],
        [Edk2SymbolType.dscPcdDefinition,"dscPcdDefinition"],
        [Edk2SymbolType.dscInclude,"dscInclude"],
        [Edk2SymbolType.infDefine,"infDefine"],
        [Edk2SymbolType.infSource,"infSource"],
        [Edk2SymbolType.infPackage,"infPackage"],
        [Edk2SymbolType.infPpi,"infPpi"],
        [Edk2SymbolType.infProtocol,"infProtocol"],
        [Edk2SymbolType.infPcd,"infPcd"],
        [Edk2SymbolType.infGuid,"infGuid"],
        [Edk2SymbolType.infDepex,"infDepex"],
        [Edk2SymbolType.infLibrary,"infLibrary"],
        [Edk2SymbolType.infBinary,"infBinary"],
        [Edk2SymbolType.infSectionLibraries,"infSectionLibraries"],
        [Edk2SymbolType.infSectionProtocols,"infSectionProtocols"],
        [Edk2SymbolType.infSectionPpis,"infSectionPpis"],
        [Edk2SymbolType.infSectionGuids,"infSectionGuids"],
        [Edk2SymbolType.infSectionPcds,"infSectionPcds"],
        [Edk2SymbolType.infSection,"infSection"],
        [Edk2SymbolType.infFunction,"infFunction"],
        [Edk2SymbolType.decSection,"decSection"],
        [Edk2SymbolType.decDefine,"decDefine"],
        [Edk2SymbolType.decPackage,"decPackage"],
        [Edk2SymbolType.decPpi,"decPpi"],
        [Edk2SymbolType.decProtocol,"decProtocol"],
        [Edk2SymbolType.decPcd,"decPcd"],
        [Edk2SymbolType.decIncludes,"decIncludes"],
        [Edk2SymbolType.decLibrary,"decLibrary"],
        [Edk2SymbolType.decGuid,"decGuid"],
        [Edk2SymbolType.aslDefinitionBlock,"aslDefinitionBlock"],
        [Edk2SymbolType.aslExternal,"aslExternal"],
        [Edk2SymbolType.aslScope,"aslScope"],
        [Edk2SymbolType.aslDevice,"aslDevice"],
        [Edk2SymbolType.aslName,"aslName"],
        [Edk2SymbolType.aslMethod,"aslMethod"],
        [Edk2SymbolType.aslField,"aslField"],
        [Edk2SymbolType.aslOpRegion,"aslOpRegion"],
        [Edk2SymbolType.aslDefault,"aslDefault"],
        [Edk2SymbolType.vfrDefault,"vfrDefault"],
        [Edk2SymbolType.vfrFormset,"vfrFormset"],
        [Edk2SymbolType.vfrForm,"vfrForm"],
        [Edk2SymbolType.vfrOneof,"vfrOneof"],
        [Edk2SymbolType.vfrCheckbox,"vfrCheckbox"],
        [Edk2SymbolType.vfrString,"vfrString"],
        [Edk2SymbolType.vfrPassword,"vfrPassword"],
        [Edk2SymbolType.vfrNumeric,"vfrNumeric"],
        [Edk2SymbolType.vfrGoto,"vfrGoto"],
        [Edk2SymbolType.fdfSection,"fdfSection"],
        [Edk2SymbolType.fdfInf,"fdfInf"],
        [Edk2SymbolType.fdfDefinition,"fdfDefinition"],
        [Edk2SymbolType.fdfFile,"fdfFile"],
        [Edk2SymbolType.unknown,"unknown"],
    ]
);



var edkSymbolProducerMap = new Map([
    [Edk2SymbolType.dscSection, { "icon": vscode.SymbolKind.Class, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.dscDefine, { "icon": vscode.SymbolKind.Constant, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.dscPcdDefinition, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.dscInclude, { "icon": vscode.SymbolKind.File, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.dscLibraryDefinition, { "icon": vscode.SymbolKind.Module, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.dscModuleDefinition, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.infSectionLibraries, { "icon": vscode.SymbolKind.Class, "onCompletion":completionInfLibraries,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSectionProtocols, { "icon": vscode.SymbolKind.Class, "onCompletion":completionInfCommon,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSectionPpis, { "icon": vscode.SymbolKind.Class, "onCompletion":completionInfCommon,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSectionGuids, { "icon": vscode.SymbolKind.Class, "onCompletion":completionInfCommon,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSectionPcds, { "icon": vscode.SymbolKind.Class, "onCompletion":completionInfCommon,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSection, { "icon": vscode.SymbolKind.Class, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.infDefine, { "icon": vscode.SymbolKind.Constant, "onCompletion":undefined,"onDefinition": gotoInfDefine, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infSource, { "icon": vscode.SymbolKind.File, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infLibrary, { "icon": vscode.SymbolKind.Module, "onCompletion":undefined,"onDefinition": infGotoLibraryDefinition, "onHover": undefined , "onDeclaration": infGotoLibraryDeclaration}],
    [Edk2SymbolType.infPackage, { "icon": vscode.SymbolKind.Package, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infPpi, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": gotoDecName, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infProtocol, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": gotoDecName, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infPcd, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": gotoDecName, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infGuid, { "icon": vscode.SymbolKind.Number, "onCompletion":undefined,"onDefinition": gotoDecName, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infDepex, { "icon": vscode.SymbolKind.Property, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infBinary, { "icon": vscode.SymbolKind.Field, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.infFunction, { "icon": vscode.SymbolKind.Method, "onCompletion":undefined,"onDefinition": gotoFunction, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.decSection, { "icon": vscode.SymbolKind.Class, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decDefine, { "icon": vscode.SymbolKind.Constant, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decLibrary, { "icon": vscode.SymbolKind.Module, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decPackage, { "icon": vscode.SymbolKind.Package, "onCompletion":undefined,"onDefinition": gotoValueFile, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decPpi, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decProtocol, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decPcd, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decGuid, { "icon": vscode.SymbolKind.Number, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.decIncludes, { "icon": vscode.SymbolKind.File, "onCompletion":undefined,"onDefinition": gotoFolder, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.aslDefinitionBlock, { "icon": vscode.SymbolKind.Package, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslExternal, { "icon": vscode.SymbolKind.Interface, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslScope, { "icon": vscode.SymbolKind.Module, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslDevice, { "icon": vscode.SymbolKind.Constant, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslName, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslMethod, { "icon": vscode.SymbolKind.Method, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslField, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslOpRegion, { "icon": vscode.SymbolKind.Enum, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.aslDefault, { "icon": vscode.SymbolKind.Key, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.vfrDefault, { "icon": vscode.SymbolKind.Null, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrFormset, { "icon": vscode.SymbolKind.Class, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrForm, { "icon": vscode.SymbolKind.Package, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrOneof, { "icon": vscode.SymbolKind.Enum, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrCheckbox, { "icon": vscode.SymbolKind.Boolean, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrString, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrPassword, { "icon": vscode.SymbolKind.String, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrNumeric, { "icon": vscode.SymbolKind.Number, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.vfrGoto, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.fdfSection, { "icon": vscode.SymbolKind.Class, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.fdfInf, { "icon": vscode.SymbolKind.Event, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.fdfDefinition, { "icon": vscode.SymbolKind.Constant, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
    [Edk2SymbolType.fdfFile, { "icon": vscode.SymbolKind.File, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],

    [Edk2SymbolType.unknown, { "icon": vscode.SymbolKind.Null, "onCompletion":undefined,"onDefinition": undefined, "onHover": undefined , "onDeclaration": undefined}],
]);


export interface Edk2SymbolProperties{
    sectionType:string;
    arch:string;
    moduleType:string;
}

export class Edk2Symbol extends vscode.DocumentSymbol {
    parent: Edk2Symbol | undefined = undefined;
    filePath: string = "";
    children: Edk2Symbol[] = [];
    documentLine: vscode.TextLine | undefined = undefined;
    document: vscode.TextDocument | undefined = undefined;
    textRange: vscode.Range;
    type: Edk2SymbolType;
    onEvents: any;
    value: string;
    location:vscode.Location;

    properties: Edk2SymbolProperties[] = [];

    isActive(){
        return gEdkDatabase.isLocationActive(this.location);
    }

    toString(){
        let properties = "";
        for (const p of this.properties) {
            properties += `${p.sectionType}.${p.arch}.${p.moduleType}, `;
        }
        properties = properties.slice(0,-2);
        return `(${this.range.start.line+1},${this.range.start.character}),(${this.range.end.line+1},${this.range.end.character})(${this.typeToString()}):  ${this.name} - ${this.value} [${properties}]`;
    }

    typeToString(){
        return typeToStr.get(this.type);
    }

    clone(){
        return new Edk2Symbol(this.name, this.detail, this.value, this.kind, this.range, this.range, this.type, this.onEvents, this.filePath);
    }

    constructor(name: string, detail: string, value: string, icon: vscode.SymbolKind, range: vscode.Range, selectionRange: vscode.Range,
        type: Edk2SymbolType = Edk2SymbolType.unknown,
        onEvents: any | undefined = undefined,
        filePath:string) {

        super(name, detail, icon, range, selectionRange);
        this.filePath = filePath;
        this.location = new vscode.Location(vscode.Uri.file(filePath),range);
        this.value = value;
        this.type = type;
        this.textRange = range;
        this.onEvents = onEvents;
        gDebugLog.verbose(`Symbol Created: ${this}`);

        // Debug
        //   this.name = `[${this.range.start.line + 1}, ${this.range.end.line + 1}] ${this.name}`;
        //     if(value.includes("PeiMain.inf")){
        //       debugLog.error(`lib created: ${name}`);
        //     }
    }

    pushChildren(c: Edk2Symbol) {
        this.children.push(c);
    }

}


export class Edk2SymbolProducer {
    produce(type: Edk2SymbolType, name: string, detail: string, value: string, range: vscode.Range, filePath: string): Edk2Symbol {

        let symbolData = edkSymbolProducerMap.get(type);

        let icon = vscode.SymbolKind.Null;
        let onEvents = undefined;
        if (symbolData) {
            icon = symbolData["icon"];
            onEvents = symbolData;
        }


        gDebugLog.verbose("Edk2SymbolProducer.produce()");
        let symbol = new Edk2Symbol(name, detail, value, icon, range, range, type, onEvents, filePath);
        
        return symbol;
    }
}

export class Edk2DocumentSymbols {
    symbols: Edk2Symbol[] = [];
    filePath: string;
    parentStack: Edk2Symbol[] = [];
    symbolList: Set<Edk2Symbol> = new Set();

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    findByValueRegex(regex:RegExp){
        let retSymbols: Edk2Symbol[] = [];
        for (const symb of this.symbolList) {
            if (symb.value.match(regex)) {
                retSymbols.push(symb);
            }
        }
        return retSymbols;
    }

    findByValue(value: string) {
        value = value.toLocaleLowerCase().trim();
        let retSymbols: Edk2Symbol[] = [];
        for (const symb of this.symbolList) {
            if (symb.value.toLowerCase() === value) {
                retSymbols.push(symb);
            }
        }
        return retSymbols;
    }

    findByName(name: string) {
        name = name.toLocaleLowerCase().trim();
        let retSymbols: Edk2Symbol[] = [];
        for (const symb of this.symbolList) {
            if (symb.name.toLowerCase() === name) {
                retSymbols.push(symb);
            }
        }
        return retSymbols;
    }

    findByType(type: Edk2SymbolType) {
        let retSymbols: Edk2Symbol[] = [];
        for (const symb of this.symbolList) {
            if (symb.type === type) {
                retSymbols.push(symb);
            }
        }
        return retSymbols;
    }

    getLastParent() {
        if (this.parentStack.length > 0) {
            return this.parentStack[this.parentStack.length - 1];
        }
        return undefined;
    }

    pushChild(symbol: Edk2Symbol) {
        let lastParent = this.getLastParent();
        if (lastParent) {
            lastParent.children.push(symbol);
        } else {
            this.symbols.push(symbol);
        }
        symbol.parent = lastParent;

        if(symbol.parent !== undefined &&
           !symbol.name.includes("[") &&
           !symbol.parent.name.match(/\[\s*defines\s*\]/gi)){
            let name = symbol.parent.name.replaceAll("[","").replaceAll("]","").trim();
            let sectionDefinitions = name.split(",").map((x)=>{return x.trim().toLowerCase();});
            symbol.properties = [];
            for (const definition of sectionDefinitions) {
                let [sectionType, arch, moduleType] = split(definition,".",3, "*").map((x)=>{
                    return x === "common"? "*": x.replace("???","*");
                });
                symbol.properties.push({sectionType:sectionType, arch:arch, moduleType:moduleType});
            }
        }else if(symbol.name.includes("[")){
            let name = symbol.name.replaceAll("[","").replaceAll("]","").trim();
            let sectionDefinitions = name.split(",").map((x)=>{return x.trim().toLowerCase();});
            symbol.properties = [];
            for (const definition of sectionDefinitions) {
                let [sectionType, arch, moduleType] = split(definition,".",3, "*").map((x)=>{
                    return x === "common"? "*": x.replace("???","*");
                });
                symbol.properties.push({sectionType:sectionType, arch:arch, moduleType:moduleType});
            }
        }

        
        
        this.symbolList.add(symbol);
    }

    pushParent(symbol: Edk2Symbol) {
        this.pushChild(symbol);
        this.parentStack.push(symbol);
    }

    popParent() {
        return this.parentStack.pop();
    }
}



export class EdkDeclarationProvider implements vscode.DeclarationProvider {
    edkDatabase:EdkDatabase;
    constructor(db: EdkDatabase) {
        this.edkDatabase = db;
    }
    async provideDeclaration(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken){
        let parser = await this.edkDatabase.getParser(document.uri.fsPath);
        if(!parser){return;}
        let selectedSymbol = await this.edkDatabase.getSelectedSymbol(document,position);
        if (selectedSymbol !== undefined && selectedSymbol.onEvents["onDeclaration"] !== undefined) {
            let temp = await selectedSymbol.onEvents["onDeclaration"](selectedSymbol, this.edkDatabase, parser);
            return temp;
        }
        return [];
    }

}

export class EdkDefinitionProvider implements vscode.DefinitionProvider {
    edkDatabase:EdkDatabase;
    constructor(db: EdkDatabase) {
        this.edkDatabase = db;
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        
        let parser = await this.edkDatabase.getParser(document.uri.fsPath);
        if(!parser){return;}
        let selectedSymbol = await this.edkDatabase.getSelectedSymbol(document,position);
        gDebugLog.verbose(`Definition for: ${selectedSymbol}`);
        if (selectedSymbol !== undefined && selectedSymbol.onEvents["onDefinition"] !== undefined) {
            let temp = await selectedSymbol.onEvents["onDefinition"](selectedSymbol, this.edkDatabase, parser);
            return temp;
        }
        return [];
    }
}



export class EdkCompletionProvider implements vscode.CompletionItemProvider{

    edkDatabase;
  
    constructor(parser: EdkDatabase) {
      this.edkDatabase = parser;
    }
    
    async  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext){
      let selectedSymbol = await this.edkDatabase.getSelectedSymbol(document, position);
      let parser = await this.edkDatabase.getParser(document.uri.fsPath);
      if (selectedSymbol !== undefined && 
          selectedSymbol.onEvents["onCompletion"] !== undefined) {
          return await selectedSymbol.onEvents["onCompletion"](selectedSymbol, this.edkDatabase, parser);
      }
      return [];
    }
  }
