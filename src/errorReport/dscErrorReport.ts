import { TextDocument } from "vscode";
import { ErrorElement, ErrorReport } from "./errorReport";
import { gEdkDatabase } from "../extension";
import { pathCompare, split } from "../utils";
import { Edk2SymbolType } from "../edkParser/edkSymbols";
import * as vscode from 'vscode';

export class DscErrorReport extends ErrorReport{
    constructor(console:vscode.OutputChannel){
        super(console);

    }

    async generateReport(document:TextDocument){
        let report:ErrorElement[] = [];

        this.gutter.warningSymbols = [];
        //
        // Unused libraries
        //
        let unusedLibraries = [];
        for (const unuseLib of gEdkDatabase.unusedLibrariesList) {
            if(pathCompare(unuseLib.filePath, document.fileName)){
                unusedLibraries.push(unuseLib);
            }
        }
        if(unusedLibraries.length>0){
            for (const l of unusedLibraries) {
                report.push({errorType:"Unused Libraries", location: l.location, message:`${l.name}`});
                this.gutter.warningSymbols.push(l.range);
            }
        }

        //
        // Wrong Name
        //
        let libraries = gEdkDatabase.findByType(Edk2SymbolType.dscLibraryDefinition,"edk2_dsc");
        let wrongNames:any[] = [];
        for (const lib of libraries) {
            if(pathCompare(document.fileName, lib.filePath)){
                let infSymb = gEdkDatabase.findByNameAndFilePath("library_class", lib.value);
                if(infSymb.length===0){continue;}
                let infName = split(infSymb[0].value,"|",2)[0];
                if(lib.name !== split(infSymb[0].value,"|",2)[0]){
                    wrongNames.push({lib:lib, realName:infName});
                }
            }
        }
        if(wrongNames.length>0){            
            for (const l of wrongNames) {
                report.push({errorType:"Wrong LIBRARY_CLASS name used in definition", location: l.lib.location, message:`${l.lib.name} != ${l.realName}`});
                this.gutter.warningSymbols.push(l.range);
            }
        }
        return report;
    }
}


