import * as vscode from 'vscode';


export enum EdkDiagnosticCodes{
sectionEmpty = 1000,
mixedSectionTypes,
unknownSectionType,
syntaxSectionType,
syntaxStatement,
statementNoKey,
duplicateStatement,
publicAndPrivate,
undefinedTokenSpaceGuid,
includePathNotFound,
includeFileMultiplePaths,
nestedPackages,
duplicateDeclaration,
duplicateIncludePath,
duplicateGuid,
undefinedLibraryClass,
relativePath,
syntaxPath,
duplicateIncludeFile,
missingPath,
conditionalMissform,
unusedSymbol,
}

export const edkErrorDescriptions: Map<EdkDiagnosticCodes, string> = new Map([
    [EdkDiagnosticCodes.sectionEmpty, "Section is empty"],
    [EdkDiagnosticCodes.mixedSectionTypes, "Mixed section types are not allowed"],
    [EdkDiagnosticCodes.unknownSectionType, "Unknown section type"],
    [EdkDiagnosticCodes.syntaxSectionType, "Syntax error in section type"],
    [EdkDiagnosticCodes.syntaxStatement, "Syntax error in statement"],
    [EdkDiagnosticCodes.statementNoKey, "Statement has no key"],
    [EdkDiagnosticCodes.duplicateStatement, "Duplicate statement"],
    [EdkDiagnosticCodes.publicAndPrivate, "Public and private modifiers are mutually exclusive"],
    [EdkDiagnosticCodes.undefinedTokenSpaceGuid, "Undefined token space GUID"],
    [EdkDiagnosticCodes.includePathNotFound, "Include path not found"],
    [EdkDiagnosticCodes.includeFileMultiplePaths, "Include file found in multiple paths"],
    [EdkDiagnosticCodes.nestedPackages, "Nested packages are not allowed"],
    [EdkDiagnosticCodes.duplicateDeclaration, "Duplicate declaration"],
    [EdkDiagnosticCodes.duplicateIncludePath, "Duplicate include path"],
    [EdkDiagnosticCodes.duplicateGuid, "Duplicate GUID"],
    [EdkDiagnosticCodes.undefinedLibraryClass, "Undefined library class"],
    [EdkDiagnosticCodes.relativePath, "Relative path not allowed"],
    [EdkDiagnosticCodes.syntaxPath, "Syntax error in path"],
    [EdkDiagnosticCodes.duplicateIncludeFile, "Duplicate include file"],
    [EdkDiagnosticCodes.missingPath, "Missing path"],
    [EdkDiagnosticCodes.conditionalMissform, "Conditional block missform"],
    [EdkDiagnosticCodes.unusedSymbol, "Unused symbol"],
  ]);

export class DiagnosticManager {
    private static instance: DiagnosticManager;
    private static diagnosticsCollection: vscode.DiagnosticCollection;
    private static diagnostics:Map<string, vscode.Diagnostic[]> = new Map();
    private static xxxdiagnostics:vscode.Diagnostic[] = [];

    private constructor() {
        // Prevent reinitialization of the diagnosticsCollection
        if (!DiagnosticManager.diagnosticsCollection) {
            DiagnosticManager.diagnosticsCollection = vscode.languages.createDiagnosticCollection('edk2Problems');
        }
    }

    public static getInstance(): DiagnosticManager {
        if (!DiagnosticManager.instance) {
            DiagnosticManager.instance = new DiagnosticManager();
        }
        return DiagnosticManager.instance;
    }

    public static warning(documentUri: vscode.Uri, line: number | vscode.Range, edkDiagCode: EdkDiagnosticCodes, detail:string, tags: vscode.DiagnosticTag[] = []) {
        if(!edkErrorDescriptions.has(edkDiagCode)){
            throw new Error(`Unknown EDK diagnostic code: ${edkDiagCode}`);
        }
        return DiagnosticManager.reportProblem(documentUri, line, edkErrorDescriptions.get(edkDiagCode)!+": "+detail, vscode.DiagnosticSeverity.Warning,"","", tags);
    }

    public static error(documentUri: vscode.Uri, line: number | vscode.Range,  edkDiagCode: EdkDiagnosticCodes, detail:string, tags: vscode.DiagnosticTag[] = []){
        if(!edkErrorDescriptions.has(edkDiagCode)){
            throw new Error(`Unknown EDK diagnostic code: ${edkDiagCode}`);
        }
        return DiagnosticManager.reportProblem(documentUri, line, edkErrorDescriptions.get(edkDiagCode)!+": "+detail, vscode.DiagnosticSeverity.Error,"","", tags);
    }

    private static addDiagnostic(documentUri: vscode.Uri, diagnostic: vscode.Diagnostic) {
        if (!DiagnosticManager.diagnostics.has(documentUri.fsPath)) {
            DiagnosticManager.diagnostics.set(documentUri.fsPath, []);
        }
        DiagnosticManager.diagnostics.get(documentUri.fsPath)!.push(diagnostic);
    }

    private static getDiagnostic(documentUri: vscode.Uri): vscode.Diagnostic[] {
        return DiagnosticManager.diagnostics.get(documentUri.fsPath) || [];
    }

    private static clearDiagnostic(documentUri: vscode.Uri) {
        DiagnosticManager.diagnostics.delete(documentUri.fsPath);
    }

    private static clearAllDiagnostics() {
        DiagnosticManager.diagnostics.clear();
    }

    public static reportProblem(documentUri: vscode.Uri, 
                                line: number|vscode.Range,
                                message: string,
                                severity: vscode.DiagnosticSeverity,
                                source?: string,
                                code?: string | number,
                                tags: vscode.DiagnosticTag[]= []) 
        {
        console.log(`REPORT problem ${documentUri.fsPath} ${line} ${message} ${severity}`);
        // Create a range that covers the entire line
        let range:vscode.Range;
        if (line instanceof vscode.Range) {
            range = line;
        }else{
            range = new vscode.Range(line as number, 0, line as number, Number.MAX_VALUE);
        }
        

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (source) {
            diagnostic.source = source;
        }
        if (code) {
            diagnostic.code = code;
        }
        diagnostic.tags = tags;
        
        DiagnosticManager.addDiagnostic(documentUri, diagnostic);
        DiagnosticManager.diagnosticsCollection.set(documentUri, DiagnosticManager.getDiagnostic(documentUri));
        return diagnostic;
    }

    public static clearAllProblems() {
        DiagnosticManager.clearAllDiagnostics();
        DiagnosticManager.diagnosticsCollection.clear();
    }

    public static clearProblems(documentUri: vscode.Uri) {
        DiagnosticManager.clearDiagnostic(documentUri);
        DiagnosticManager.diagnosticsCollection.delete(documentUri);
    }
}
