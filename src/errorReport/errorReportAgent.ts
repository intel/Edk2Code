
import * as vscode from 'vscode';
import { DscErrorReport } from './dscErrorReport';
import { InfErrorReport } from './infErrorReport';
import { ErrorElement } from './errorReport';
import { gConfigAgent, gDebugLog, gEdkDatabase } from '../extension';
import { Edk2SymbolType } from '../edkParser/edkSymbols';
import { rgSearch } from '../rg';

export class ErrorReportAgent {
    console: vscode.OutputChannel;

    constructor() {
        this.console = vscode.window.createOutputChannel("EDK2 Warnings");
        vscode.window.onDidChangeActiveTextEditor(this.fileOpened, this);

    }

    printReport(filePath:string , report:ErrorElement[]){

        this.console.clear();
        this.console.appendLine(`${filePath}`);
        this.console.appendLine(`------------------------`);
        if(report.length === 0){
            this.console.append("0 Warnings found");
            return;
        }
        for (const r of report) {
            this.console.appendLine(`[${r.errorType}] ${r.message} - ${r.location.uri.fsPath}:${r.location.range.start.line+1}`);
        }
    }



    async fileOpened() {
        if(!gConfigAgent.getIsShowLanguageWarnings()){return;}
        // Get opened file
        var document = vscode.window.activeTextEditor?.document;
        if (document === undefined) { return; }
        
        
        switch (document.languageId) {
            case "edk2_dsc":
                let dscReport = new DscErrorReport(this.console);
                let dscReportData = await dscReport.generateReport(document);
                this.printReport(document.fileName, dscReportData);
                await dscReport.gutter.render();
                break;
            case "edk2_inf":
                let infReport = new InfErrorReport(this.console);
                let infReportData = await infReport.generateReport(document);
                this.printReport(document.fileName, infReportData);
                await infReport.gutter.render();
                break;
            default:
                break;
        }
        

    }
}
