import { TextDocument } from "vscode";
import { ErrorElement, ErrorReport } from "./errorReport";
import { gConfigAgent, gDebugLog, gEdkDatabase, gGrayOutController } from "../extension";
import { pathCompare, split } from "../utils";
import { Edk2SymbolType } from "../edkParser/edkSymbols";
import * as vscode from 'vscode';
import { rgSearch } from "../rg";
import { rgPath } from "vscode-ripgrep";
import path = require("path");
import { EdkDatabase, MapData } from "../edkParser/edkDatabase";


var lensReport:undefined|vscode.Disposable;

export class InfErrorReport extends ErrorReport{

    constructor(console:vscode.OutputChannel){
        super(console);
        if(lensReport){
            lensReport.dispose();
        }

    }

    async generateReport(document:TextDocument){
        this.gutter.warningSymbols = [];
        let problems:ErrorElement[] = [];
        
        gEdkDatabase.clearInactiveLines(document.fileName);

        // List sources paths
        let sources = await gEdkDatabase.findByType(Edk2SymbolType.infSource,"edk2_inf", document.fileName);
        let sourcesPath:Set<string> = new Set();
        
        for (const s of sources) {
            sourcesPath.add(s.value);
        }
        
        //
        // Unused Guids
        //
        let symb = await gEdkDatabase.findByType(Edk2SymbolType.infGuid,"edk2_inf", document.fileName);
        for (const s of symb) {
            let found = await rgSearch(s.value, Array.from(sourcesPath));
            if(found.length === 0){
                problems.push({errorType:"Unused GUID", location: s.location, message:s.value});
                gEdkDatabase.addInactiveLine(document.fileName,s.location.range.start.line+1);
            }
        }

        //
        // Unused PCDs
        //
        symb = await gEdkDatabase.findByType(Edk2SymbolType.infPcd,"edk2_inf", document.fileName);
        for (const s of symb) {
            let pcdValue = split(s.value,".",2);
            let found = await rgSearch(pcdValue[1], Array.from(sourcesPath));
            if(found.length === 0){
                problems.push({errorType:"Unused PCD", location: s.location, message:s.value});
                gEdkDatabase.addInactiveLine(document.fileName,s.location.range.start.line+1);
            }
        }

        //
        // Unused Protocol
        //
        symb = await gEdkDatabase.findByType(Edk2SymbolType.infProtocol,"edk2_inf", document.fileName);
        for (const s of symb) {
            let found = await rgSearch(s.value, Array.from(sourcesPath));
            if(found.length === 0){
                problems.push({errorType:"Unused Protocol", location: s.location, message:s.value});
                gEdkDatabase.addInactiveLine(document.fileName,s.location.range.start.line+1);
            }
        }

        //
        // Unused PPI
        //
        symb = await gEdkDatabase.findByType(Edk2SymbolType.infPpi,"edk2_inf", document.fileName);
        for (const s of symb) {
            let found = await rgSearch(s.value, Array.from(sourcesPath));
            if(found.length === 0){
                problems.push({errorType:"Unused PPI", location: s.location, message:s.value});
                gEdkDatabase.addInactiveLine(document.fileName,s.location.range.start.line+1);
            }
        }

        

        let inactiveLibraries = await gEdkDatabase.getInactiveLibraries(document.fileName);
        for (const l of inactiveLibraries) {
            problems.push({errorType:"Unuse Library", location: l.location, message:l.name});
        }
        
        return problems;
    }

}



