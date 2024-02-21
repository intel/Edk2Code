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
    [EdkDiagnosticCodes.missingPath, "Missing path"]
  ]);

export class DiagnosticManager {
    private static instance: DiagnosticManager;
    private static diagnosticsCollection: vscode.DiagnosticCollection;
    private static diagnostics:vscode.Diagnostic[] = [];

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

    public static warning(documentUri: vscode.Uri, line: number, edkDiagCode: EdkDiagnosticCodes, detail:string){
        if(!edkErrorDescriptions.has(edkDiagCode)){
            throw new Error(`Unknown EDK diagnostic code: ${edkDiagCode}`);
        }
        DiagnosticManager.reportProblem(documentUri, line, edkErrorDescriptions.get(edkDiagCode)!+": "+detail, vscode.DiagnosticSeverity.Warning);
    }

    public static error(documentUri: vscode.Uri, line: number,  edkDiagCode: EdkDiagnosticCodes, detail:string){
        if(!edkErrorDescriptions.has(edkDiagCode)){
            throw new Error(`Unknown EDK diagnostic code: ${edkDiagCode}`);
        }
        DiagnosticManager.reportProblem(documentUri, line, edkErrorDescriptions.get(edkDiagCode)!+": "+detail, vscode.DiagnosticSeverity.Error);
    }

    public static reportProblem(documentUri: vscode.Uri, line: number, message: string, severity: vscode.DiagnosticSeverity, source?: string, code?: string | number) {
        // Create a range that covers the entire line
        const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (source) {
            diagnostic.source = source;
        }
        if (code) {
            diagnostic.code = code;
        }
        this.diagnostics.push(diagnostic);
        DiagnosticManager.diagnosticsCollection.set(documentUri, this.diagnostics);
    }

    public static clearProblems() {
        this.diagnostics = [];
        DiagnosticManager.diagnosticsCollection.clear();
    }
}
