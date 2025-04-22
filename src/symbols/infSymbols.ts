import { gConfigAgent, gCscope, gDebugLog, gEdkWorkspaces, gPathFind, gWorkspacePath } from "../extension";
import path = require('path');
import {  EdkSymbol } from "./edkSymbols";
import * as vscode from 'vscode';
import { rgSearch, rgSearchText } from "../rg";
import { Edk2SymbolType } from "./symbolsType";
import { isFileEdkLibrary, listFiles, listFilesRecursive, openTextDocument, split } from "../utils";
import { InfDsc } from "../index/edkWorkspace";
import { DocumentParser } from "../edkParser/languageParser";
import * as fs from 'fs';
import { ParserFactory } from "../edkParser/parserFactory";
import { REGEX_INF_SECTION } from "../edkParser/commonParser";



export class InfSection extends EdkSymbol{
    onCompletion: Function | undefined;
    onDefinition: Function | undefined;
    onHover: Function | undefined;
    onDeclaration: Function | undefined;
    
    public constructor(textLine: string, location: vscode.Location, enabled: boolean, visible: boolean, parser:DocumentParser) {
        super(textLine,location, enabled, visible, parser);
        textLine = textLine.replace('[','').replace(']','').trim();
        let items = textLine.split(',');
        for (const item of items) {
            REGEX_INF_SECTION.lastIndex = 0;
            let match = REGEX_INF_SECTION.exec(item.trim());
            if(match){
                let sectionType = (match.groups?.['sectionType'] || '').toLowerCase();
                let arch = (match.groups?.['arch'] || 'common').toLowerCase();
                this.sectionProperties.addProperty(sectionType, arch, "Library");
            }
        }



        
        
    }
}

export class EdkSymbolInfSectionLibraries extends InfSection {

    type = Edk2SymbolType.infSectionLibraries;
    kind = vscode.SymbolKind.Class;

    
    onCompletion = async ()=>{
        return completeLib(this);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolInfSectionSource extends InfSection {

    type = Edk2SymbolType.infSectionSource;
    kind = vscode.SymbolKind.Class;

    
    onCompletion = async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)=>{
        let text = document.getText(this.location.range);

        let files = await listFilesRecursive(path.dirname(this.location.uri.fsPath));
        let retData = [];
        for(const file of files){
            retData.push(new vscode.CompletionItem({label:file.replaceAll("\\","/"), detail:"", description:""}, vscode.CompletionItemKind.File));
        }
        return retData;
    };

    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolInfSectionProtocols extends InfSection {

    type = Edk2SymbolType.infSectionProtocols;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decProtocol, vscode.CompletionItemKind.Interface);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}


export class EdkSymbolInfPpi extends EdkSymbol {

    type = Edk2SymbolType.infPpi;
    kind = vscode.SymbolKind.Event;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decPpi, vscode.CompletionItemKind.Interface);
    };

    onDefinition = async (parser:DocumentParser)=>{
        return decDefinition(this,Edk2SymbolType.decPpi);
    };
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolInfSectionPpis extends InfSection {

    type = Edk2SymbolType.infSectionPpis;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decPpi, vscode.CompletionItemKind.Interface);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfSectionGuids extends InfSection {

    type = Edk2SymbolType.infSectionGuids;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decGuid, vscode.CompletionItemKind.Constant);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolinfSectionDepex extends InfSection {

    type = Edk2SymbolType.infSectionDepex;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decGuid, vscode.CompletionItemKind.Constant);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolInfSectionPcds extends InfSection {

    type = Edk2SymbolType.infSectionPcds;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decPcd, vscode.CompletionItemKind.Constant);
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfSection extends EdkSymbol {

    type = Edk2SymbolType.infSection;
    kind = vscode.SymbolKind.Class;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolSectionPackages extends InfSection {

    type = Edk2SymbolType.infSectionPackages;
    kind = vscode.SymbolKind.Class;

    onCompletion = async (parser:DocumentParser)=>{
        return completionPackage();
    };
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}

export class EdkSymbolInfDefine extends EdkSymbol {

    type = Edk2SymbolType.infDefine;
    kind = vscode.SymbolKind.Constant;

    public constructor(textLine: string, location: vscode.Location, enabled: boolean, visible: boolean, parser:DocumentParser) {
        super(textLine,location, enabled, visible, parser);
        let key = split(this._textLine.replace(/^\s*define\s*/gi,""),"=",2)[0].trim();
        let value = split(this._textLine, "=", 2)[1].trim();
        this.parser.defines.setDefinition(key,value,location);
    }

    async getKey() {
        let key = split(this.textLine,"=",2)[0].trim();
        return key.replace(/\s*define\s*/gi, "");
    }

    async getValue(){
        let value = split(this.textLine, "=", 2)[1].trim();
        return value;
    }

    onCompletion: undefined;
    onDefinition = async (parser:DocumentParser)=>{
        
        let key = await this.getKey();
        if(["constructor", "destructor", "entry_point"].includes(key.toLowerCase())){
            let sources = parser.getSymbolsType(Edk2SymbolType.infSource);
            let p = [];
            for (const s of sources) {
                p.push(await s.getValue());
            }
            let wps = await gEdkWorkspaces.getWorkspace(this.location.uri);
            if(wps.length){
                let locations = await gCscope.getDefinitionPositions(await this.getValue());
                if(locations.length){
                    return locations;
                }
            }

            let locations = await rgSearch(await this.getValue(),[],p);
            return locations;
            
        }

        

    };
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfSource extends EdkSymbol {

    type = Edk2SymbolType.infSource;
    kind = vscode.SymbolKind.File;
    
    onCompletion = async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)=>{
        let text = document.getText(this.location.range);
        let listDirPath = path.join(path.dirname(this.location.uri.fsPath),text.trim());
        let files = await listFiles(listDirPath);
        let retData = [];
        for(const file of files){
            const stat = fs.statSync(file);
            let icon = vscode.CompletionItemKind.File;
            if (stat.isDirectory()) {
              icon = vscode.CompletionItemKind.Folder;
            }
            let relativePath = file.replace(listDirPath,"");
            retData.push(new vscode.CompletionItem({label:relativePath.replaceAll("\\","/"), detail:"", description:""}, icon));
        }
        return retData;
    };

    onDefinition = async (parser:DocumentParser)=>{
        let filePath = this.textLine.replace(/\s*\|.*/, "");
        let relPath = path.dirname(this.location.uri.fsPath);
        return await gPathFind.findPath(filePath, relPath);
    };
    onHover: undefined;
    onDeclaration: undefined;

    async getValue(){

        let filePathText = this.textLine.replace(/\s*\|.*/, "");
        let relPath = path.dirname(this.location.uri.fsPath);
        let filePath = await gPathFind.findPath(filePathText,relPath);
        if(filePath.length){
            return filePath[0].uri.fsPath;
        }
        return this.textLine;
    }
}
export class EdkSymbolInfLibrary extends EdkSymbol {

    type = Edk2SymbolType.infLibrary;
    kind = vscode.SymbolKind.Module;

    onCompletion = async ()=>{
        return completeLib(this);
    };



    onDefinition = async (parser:DocumentParser)=>{
        let libName = this.textLine.replace(/\s*\|.*/, "");


        let wps = await gEdkWorkspaces.getWorkspace(this.location.uri);
        if(wps.length){


            // Check if this is a library
            let isLibrary = await isFileEdkLibrary(this.location.uri);

            if(isLibrary){
                let libDeclarationLocations:vscode.Location[] = [];
                for (const wp of wps) {
                    libDeclarationLocations = libDeclarationLocations.concat(await wp.getLibDefinition(libName));
                }
                return libDeclarationLocations;
            }else{
                // Modules
                let dscLibDeclarations:InfDsc[] = [];
                for (const wp of wps) {
                    dscLibDeclarations = dscLibDeclarations.concat(await wp.getLibDeclarationModule(this.location.uri, libName));
                }
                let libDeclarationLocations:vscode.Location[] = [];
                for (const declaration of dscLibDeclarations) {
                    let location = await gPathFind.findPath(declaration.path);
                    if(location.length){
                        libDeclarationLocations.push(location[0]);
                    }
                }
                return libDeclarationLocations;
            }

        }else{
            let locations = await rgSearch(`--regexp "LIBRARY_CLASS\\s*=\\s*\\b${libName}\\b"`,["*.inf"]);
            return locations;
        }

    };


    onHover: undefined;

    onDeclaration = async ()=>{
        let libName = this.textLine.replace(/\s*\|.*/, "");


        let wps = await gEdkWorkspaces.getWorkspace(this.location.uri);
        if(wps.length){

            let isLibrary = await isFileEdkLibrary(this.location.uri);
            if(isLibrary){
                // Libraries return all results of libraries used in workspaces
                let dscLibDeclarations:InfDsc[] = [];
                for (const wp of wps) {
                    dscLibDeclarations = dscLibDeclarations.concat(await wp.getLibDeclaration(libName));
                }
                return dscLibDeclarations.map((x)=>{return x.location;});
            }else{

                // Libraries return all results of libraries used in workspaces
                let dscLibDeclarations:InfDsc[] = [];
                for (const wp of wps) {
                    dscLibDeclarations = dscLibDeclarations.concat(await wp.getLibDeclarationModule(this.location.uri, libName));
                }
                return dscLibDeclarations.map((x)=>{return x.location;});
            }
        }else{
            let locations = await rgSearch(`--regexp "\\b${libName}\\s*\\|\\b"`,["*.dsc","*.dsc.inc"]);
            return locations;
        }
    };


    async getDefinition(parser:DocumentParser){
        let libName = this.textLine.replace(/\s*\|.*/, "");
        let wps = await gEdkWorkspaces.getWorkspace(this.location.uri);
        if(wps.length){


            // Check if this is a library
            let isLibrary = await isFileEdkLibrary(this.location.uri);

            if(isLibrary){
                let libDeclarationLocations:vscode.Location[] = [];
                for (const wp of wps) {
                    libDeclarationLocations = libDeclarationLocations.concat(await wp.getLibDefinition(libName));
                }
                return libDeclarationLocations;
            }else{
                // Modules
                let dscLibDeclarations:InfDsc[] = [];
                for (const wp of wps) {
                    dscLibDeclarations = dscLibDeclarations.concat(await wp.getLibDeclarationModule(this.location.uri, libName));
                }
                let libDeclarationLocations:vscode.Location[] = [];
                for (const declaration of dscLibDeclarations) {
                    let location = await gPathFind.findPath(declaration.path);
                    if(location.length){
                        libDeclarationLocations.push(location[0]);
                    }
                }
                return libDeclarationLocations;
            }

        }else{
            let locations = await rgSearch(`--regexp "LIBRARY_CLASS\\s*=\\s*\\b${libName}\\b"`,["*.inf"]);
            return locations;
        }
    }
}
export class EdkSymbolInfPackage extends EdkSymbol {

    type = Edk2SymbolType.infPackage;
    kind = vscode.SymbolKind.Package;

    onCompletion = async (parser:DocumentParser)=>{
        return completionPackage();
    };

    onDefinition = async (parser:DocumentParser)=>{
        let filePath = this.textLine.replace(/\s*\|.*/, "");
        return await gPathFind.findPath(filePath);
    };
    async getValue(){
        let filePath = this.textLine.replace(/\s*\|.*/, "");
        let path = await gPathFind.findPath(filePath);
        if(path.length){
            return path[0].uri.fsPath;
        }
        return "";
    }
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfProtocol extends EdkSymbol {

    type = Edk2SymbolType.infProtocol;
    kind = vscode.SymbolKind.Event;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decProtocol, vscode.CompletionItemKind.Interface);
    };
    onDefinition = async (parser:DocumentParser)=>{
        return decDefinition(this, Edk2SymbolType.decProtocol);
    };
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfPcd extends EdkSymbol {

    type = Edk2SymbolType.infPcd;
    kind = vscode.SymbolKind.String;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decPcd, vscode.CompletionItemKind.Constant);
    };
    onDefinition = async (parser:DocumentParser)=>{
        return decDefinition(this, Edk2SymbolType.decPcd);
    };
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfGuid extends EdkSymbol {

    type = Edk2SymbolType.infGuid;
    kind = vscode.SymbolKind.Number;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decGuid, vscode.CompletionItemKind.Constant);
    };
    onDefinition = async (parser:DocumentParser)=>{
        return decDefinition(this,Edk2SymbolType.decGuid);
    };
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfDepex extends EdkSymbol {

    type = Edk2SymbolType.infDepex;
    kind = vscode.SymbolKind.Property;

    onCompletion = async (parser:DocumentParser)=>{
        return this.decCompletion(Edk2SymbolType.decPpi, vscode.CompletionItemKind.Interface);
    };

    onDefinition = async (parser:DocumentParser)=>{
        return decDefinition(this,Edk2SymbolType.decPpi);
    };
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfBinary extends EdkSymbol {

    type = Edk2SymbolType.infBinary;
    kind = vscode.SymbolKind.Field;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}
export class EdkSymbolInfFunction extends EdkSymbol {

    type = Edk2SymbolType.infFunction;
    kind = vscode.SymbolKind.Method;

    onCompletion: undefined;
    onDefinition: undefined;
    onHover: undefined;
    onDeclaration: undefined;
}




async function decDefinition(thisSymbol:EdkSymbol, type:Edk2SymbolType){
    let factory = new ParserFactory();
    let thisPpi = await thisSymbol.getKey();
    let decs = thisSymbol.parser.getSymbolsType(Edk2SymbolType.infPackage);
    for (const dec of decs) {
        let decTextPath = await dec.getValue();
        let document = await openTextDocument(vscode.Uri.file(decTextPath));
        let decParser = factory.getParser(document);
        if(decParser){
            await decParser.parseFile();
            let decPpis = decParser.getSymbolsType(type);
            for (const decPpi of decPpis) {
                let decPpiValue = await decPpi.getKey();
                if(decPpiValue === thisPpi){
                    return decPpi.location;
                }
            }
        }
    }
}

async function completionPackage(){
    let paths = await vscode.workspace.findFiles(`**\\*.dec`);
    let retData = [];
    let includePaths = gConfigAgent.getBuildPackagePaths();
    for (const p of includePaths) {
        for (const file of paths) {
            if(file.fsPath.startsWith(p + path.sep)){
                let completion = file.fsPath.slice(p.length + 1).replaceAll("\\","/");
                retData.push(new vscode.CompletionItem({label:completion, detail:"", description:""}, vscode.CompletionItemKind.File));
            }
        }
    }
    return retData;
}

async function completeLib(thisSymbol:EdkSymbol) {
    let retData = [];
    let wps = await gEdkWorkspaces.getWorkspace(thisSymbol.location.uri);
    let libPaths: string[] = [];
    if(wps.length) {
        for(const wp of wps) {
            for(const lib of wp.filesLibraries) {
                let libNameDsc = lib.text.split("|", 2)[0].trim();
                if(libPaths.includes(libNameDsc)) { 
                    continue;
                }

                retData.push(new vscode.CompletionItem({label:libNameDsc, detail: "", description: ""}, vscode.CompletionItemKind.Enum));
                libPaths.push(libNameDsc);
            }
        }
    } else {
        let textList = await rgSearchText(`-i --regexp "^\\s*LIBRARY_CLASS\\s*="`, ["*.inf"]);
        let libNames: string[] = [];
        for(const text of textList) {
            // Push libName to return data:
            // LIBRARY_CLASS = libName | values
            //                 ^^^^^^^
            let libName = text.split("=", 2)[1].split("|", 2)[0].trim();
            // Skip NULL libraries
            if(libName.toLowerCase() === "null"){continue;}
            if(!libNames.includes(libName)) {
                libNames.push(libName);
                retData.push(new vscode.CompletionItem({label:libName, detail: "", description: ""}, vscode.CompletionItemKind.Enum));
            }
        }
    }
    return retData;
}