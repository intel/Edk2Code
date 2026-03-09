import * as vscode from 'vscode';

import { gDebugLog } from './extension';

/**
 * Manages grayout decorations for inactive code regions across all documents.
 * 
 * Uses a single shared TextEditorDecorationType and a single set of event
 * listeners instead of per-file controllers. This avoids:
 * - Creating/disposing decoration types on every tab switch (main perf issue)
 * - N event listeners for N files  
 * - Reference equality checks on TextDocument that silently fail
 */
export class GrayoutManager {
    /** Single shared decoration type — created once, reused for all files */
    private decoration: vscode.TextEditorDecorationType;

    /** Map from fsPath -> grayout ranges for that file */
    private rangeMap: Map<string, vscode.Range[]> = new Map();

    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.decoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            light: { opacity: "0.3" },
            dark: { opacity: "0.3" },
        });

        // Single listener: re-apply decorations when the active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.applyToEditor(editor);
                }
            })
        );

        // Handle split editors and editor reuse
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors((editors) => {
                for (const editor of editors) {
                    this.applyToEditor(editor);
                }
            })
        );
    }

    /**
     * Store grayout ranges for a document and immediately apply decorations
     * to all visible editors showing that document.
     */
    setRanges(uri: vscode.Uri, ranges: vscode.Range[]) {
        gDebugLog.trace(`GrayoutManager.setRanges(): ${uri.fsPath} (${ranges.length} ranges)`);
        this.rangeMap.set(uri.fsPath, ranges);
        this.applyToUri(uri.fsPath);
    }

    /**
     * Remove grayout ranges for a document and clear its decorations.
     */
    clearRanges(uri: vscode.Uri) {
        gDebugLog.trace(`GrayoutManager.clearRanges(): ${uri.fsPath}`);
        this.rangeMap.delete(uri.fsPath);
        this.applyToUri(uri.fsPath);
    }

    /**
     * Remove all grayout ranges and clear decorations from all visible editors.
     */
    clearAll() {
        gDebugLog.trace(`GrayoutManager.clearAll()`);
        this.rangeMap.clear();
        // Clear decorations on all visible editors
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.decoration, []);
        }
    }

    /**
     * Apply stored decorations to a specific editor.
     */
    private applyToEditor(editor: vscode.TextEditor) {
        const fsPath = editor.document.uri.fsPath;
        const ranges = this.rangeMap.get(fsPath);
        if (ranges && ranges.length > 0) {
            gDebugLog.trace(`GrayoutManager: Applying ${ranges.length} ranges to ${fsPath}`);
            editor.setDecorations(this.decoration, ranges);
        } else {
            // Clear any stale decorations for files not in the map
            editor.setDecorations(this.decoration, []);
        }
    }

    /**
     * Apply decorations to all visible editors showing the given file.
     */
    private applyToUri(fsPath: string) {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.fsPath === fsPath) {
                this.applyToEditor(editor);
            }
        }
    }

    dispose() {
        this.decoration.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
        this.rangeMap.clear();
    }
}

/**
 * @deprecated Use GrayoutManager instead. Kept temporarily for backward compatibility.
 */
export class GrayoutController {
    decoration:vscode.TextEditorDecorationType|undefined;
    
    document:vscode.TextDocument;
    range:vscode.Range[];
    changeEvent:vscode.Disposable;

    public constructor(document:vscode.TextDocument, range:vscode.Range[]) {
        
        this.document = document;

        this.range = range;
        this.changeEvent = vscode.window.onDidChangeActiveTextEditor(()=>{
            if(vscode.window.activeTextEditor?.document.uri.fsPath === this.document.uri.fsPath){
                this.doGrayOut();
            }
        }, this);
        
    }

    
    grayoutRange(unusdedRanges:vscode.Range[]) {
            gDebugLog.trace("grayoutRange()");
            let activeEditor = vscode.window.activeTextEditor;
            
            if(!activeEditor){return;}
            if(activeEditor.document.uri.fsPath !== this.document.uri.fsPath){return;}

            gDebugLog.trace(`Unused Ranges: ${JSON.stringify(unusdedRanges)}`);
            
            this.disposeDecoration();

            let decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    light: {
                        opacity: "0.3",
                    },
                    dark: {
                        opacity: "0.3",
                    }
            });

            this.decoration = decoration;

            const blockDecorationOptions: vscode.DecorationOptions[] = [];
            for (const targetRange of unusdedRanges) {
                const decoration = { range: targetRange};
                blockDecorationOptions.push(decoration);
            }
            activeEditor?.setDecorations(decoration, blockDecorationOptions);

    }



    dispose(){
        this.disposeDecoration();
        this.changeEvent?.dispose();
    }

    disposeDecoration(){
        if(this.decoration){
            this.decoration.dispose();
        }
    }

    doGrayOut(){
        if (vscode.window.visibleTextEditors.some(editor => editor.document.uri.fsPath === this.document.uri.fsPath)) {
            gDebugLog.info(`doGrayOut(): ${this.document.uri.fsPath}`);
            this.grayoutRange(this.range);
        }
    }

}