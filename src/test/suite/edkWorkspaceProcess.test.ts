import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DebugLog } from '../../debugLog';
import { ConfigAgent } from '../../configuration';
import { DiagnosticManager } from '../../diagnostics';
import { EdkWorkspace, InfDsc } from '../../index/edkWorkspace';
import { PathFind } from '../../pathfind';

/**
 * Ensure all globals required by EdkWorkspace processing are available.
 * Stubs status bar, tree provider, path finder, config agent, and
 * diagnostics so the private _processDocument / _doProccessWorkspace
 * can run in a test environment.
 */
function ensureProcessingGlobals() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
    if (!ext.gWorkspacePath) {
        ext.gWorkspacePath = path.resolve(__dirname, '../../../');
    }
    if (!ext.gConfigAgent) {
        ext.gConfigAgent = new ConfigAgent();
    }
    if (!ext.gPathFind) {
        ext.gPathFind = new PathFind();
    }
    // Stub edkWorkspaceTreeProvider.refresh()
    if (!ext.edkWorkspaceTreeProvider) {
        ext.edkWorkspaceTreeProvider = { refresh() {} };
    }

    // Initialize DiagnosticManager (creates diagnosticsCollection)
    DiagnosticManager.getInstance();

    // Stub edkStatusBar functions that reference myStatusBarItem
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const statusBar = require('../../statusBar');
    if (!statusBar.myStatusBarItem) {
        statusBar.myStatusBarItem = {
            text: '',
            tooltip: '',
            show() {},
            hide() {},
            backgroundColor: undefined,
            command: undefined,
        };
    }
}

/**
 * Open a DSC file from the test/ folder and create an EdkWorkspace from it.
 */
async function openDscDocument(filename: string): Promise<vscode.TextDocument> {
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    return vscode.workspace.openTextDocument(uri);
}

// ═══════════════════════════════════════════════════════════════
//  _processDocument tests
// ═══════════════════════════════════════════════════════════════

suite('EdkWorkspace._processDocument', () => {
    let workspace: EdkWorkspace;
    let doc: vscode.TextDocument;

    suiteSetup(async function () {
        this.timeout(15_000);
        ensureProcessingGlobals();
        doc = await openDscDocument('testDscProcess.dsc');
        workspace = new EdkWorkspace(doc);
        // Call private method directly
        await (workspace as any)._processDocument(doc, 'DSC');
    });

    suite('Document Registration', () => {
        test('Adds document to filesDsc', () => {
            const dscPaths = workspace.dscList();
            assert.ok(dscPaths.length >= 1, 'filesDsc should contain at least the main document');
            assert.ok(
                dscPaths.some(p => p.endsWith('testDscProcess.dsc')),
                'filesDsc should include testDscProcess.dsc'
            );
        });

        test('isDocumentInIndex returns true after processing', () => {
            assert.strictEqual(
                (workspace as any).isDocumentInIndex(doc),
                true,
                'Document should be in the index after processing'
            );
        });

        test('Processing same document twice is a no-op', async () => {
            const sizeBefore = workspace.dscList().length;
            await (workspace as any)._processDocument(doc, 'DSC');
            assert.strictEqual(workspace.dscList().length, sizeBefore, 'Should not re-add');
        });
    });

    suite('Defines Extraction', () => {
        test('Extracts PLATFORM_NAME from [Defines]', () => {
            assert.strictEqual(workspace.getDefinition('PLATFORM_NAME'), 'TestProcess');
        });

        test('Extracts PLATFORM_GUID', () => {
            assert.strictEqual(
                workspace.getDefinition('PLATFORM_GUID'),
                '11111111-2222-3333-4444-555555555555'
            );
        });

        test('Extracts DEFINE MY_FLAG', () => {
            assert.strictEqual(workspace.getDefinition('MY_FLAG'), 'TRUE');
        });

        test('Extracts DEFINE with empty value', () => {
            const val = workspace.getDefinition('EMPTY_DEF');
            assert.ok(val !== undefined, 'EMPTY_DEF should be defined');
            assert.strictEqual(val!.trim(), '');
        });

        test('Extracts root-level DEFINE', () => {
            assert.strictEqual(workspace.getDefinition('ROOT_DEF'), 'RootValue');
        });

        test('getDefinitionLocation returns a Location for known define', () => {
            const loc = workspace.getDefinitionLocation('PLATFORM_NAME');
            assert.ok(loc !== undefined, 'Should have a location');
            assert.ok(loc!.uri.fsPath.endsWith('testDscProcess.dsc'));
        });

        test('getDefinitions returns all defines as a Map', () => {
            const defs = workspace.getDefinitions();
            assert.ok(defs instanceof Map);
            assert.ok(defs.size >= 5, `Expected >=5 defines, got ${defs.size}`);
        });
    });

    suite('Define Variable Substitution', () => {
        test('DERIVED define has $(BASE) resolved', () => {
            const val = workspace.getDefinition('DERIVED');
            assert.strictEqual(val, 'HelloWorld', 'DERIVED should be resolved to HelloWorld');
        });

        test('replaceDefine substitutes known variables', () => {
            const result = workspace.replaceDefine('$(MY_FLAG)');
            assert.strictEqual(result, 'TRUE');
        });

        test('replaceDefine leaves unknown variables untouched', () => {
            const result = workspace.replaceDefine('$(TOTALLY_UNKNOWN)');
            assert.strictEqual(result, '$(TOTALLY_UNKNOWN)');
        });
    });

    suite('PCD Extraction', () => {
        test('Extracts PCDs in gTestPkg namespace', () => {
            const pcds = workspace.getPcds('gTestPkg');
            assert.ok(pcds !== undefined, 'gTestPkg PCDs should exist');
        });

        test('PcdTestMask has correct value', () => {
            const pcds = workspace.getPcds('gTestPkg');
            const pcd = pcds?.get('PcdTestMask');
            assert.ok(pcd !== undefined, 'PcdTestMask should exist');
            assert.strictEqual(pcd!.value, '0x2F');
        });

        test('PcdBootTimeout from DynamicDefault', () => {
            const pcds = workspace.getPcds('gTestPkg');
            const pcd = pcds?.get('PcdBootTimeout');
            assert.ok(pcd !== undefined, 'PcdBootTimeout should exist');
            assert.strictEqual(pcd!.value, '5');
        });

        test('PCD with L"string" value strips L prefix', () => {
            const pcds = workspace.getPcds('gTestPkg');
            const pcd = pcds?.get('PcdStringVal');
            assert.ok(pcd !== undefined, 'PcdStringVal should exist');
            assert.ok(pcd!.value.startsWith('"'), 'Value should start with " after L is stripped');
        });

        test('PCD has location information', () => {
            const pcds = workspace.getPcds('gTestPkg');
            const pcd = pcds?.get('PcdTestMask');
            assert.ok(pcd!.position.uri.fsPath.endsWith('testDscProcess.dsc'));
        });

        test('getAllPcds returns all namespaces', () => {
            const all = workspace.getAllPcds();
            assert.ok(all.has('gTestPkg'), 'Should have gTestPkg namespace');
        });
    });

    suite('Conditional Processing', () => {
        test('!if TRUE branch: COND_TAKEN is defined', () => {
            assert.strictEqual(workspace.getDefinition('COND_TAKEN'), 'IfTrueValue');
        });

        test('!if TRUE branch: else branch not taken', () => {
            // COND_TAKEN should NOT be IfFalseValue
            assert.notStrictEqual(workspace.getDefinition('COND_TAKEN'), 'IfFalseValue');
        });

        test('!if FALSE: else branch taken, COND_ELSE is defined', () => {
            assert.strictEqual(workspace.getDefinition('COND_ELSE'), 'ElseValue');
        });

        test('!if FALSE: if branch not taken, COND_FALSE_IF not defined', () => {
            assert.strictEqual(workspace.getDefinition('COND_FALSE_IF'), undefined);
        });

        test('Nested conditionals: outer TRUE inner FALSE -> INNER_ELSE defined', () => {
            assert.strictEqual(workspace.getDefinition('OUTER_TRUE'), 'OuterOk');
            assert.strictEqual(workspace.getDefinition('INNER_ELSE'), 'InnerElseOk');
        });

        test('Nested conditionals: INNER_FALSE not defined', () => {
            assert.strictEqual(workspace.getDefinition('INNER_FALSE'), undefined);
        });

        test('!ifdef on existing variable takes the branch', () => {
            assert.strictEqual(workspace.getDefinition('IFDEF_TAKEN'), 'yes');
        });

        test('!ifndef on undefined variable takes the branch', () => {
            assert.strictEqual(workspace.getDefinition('IFNDEF_TAKEN'), 'yes');
        });

        test('COND_A before conditional is still defined', () => {
            assert.strictEqual(workspace.getDefinition('COND_A'), 'BeforeIf');
        });
    });

    suite('Library and Module References', () => {
        test('Libraries are collected (even if paths unresolved)', () => {
            // Libraries are added even when gPathFind.findPath returns empty
            assert.ok(workspace.filesLibraries.length >= 2,
                `Expected >=2 library refs, got ${workspace.filesLibraries.length}`);
        });

        test('Modules are collected (even if paths unresolved)', () => {
            assert.ok(workspace.filesModules.length >= 2,
                `Expected >=2 module refs, got ${workspace.filesModules.length}`);
        });

        test('Library InfDsc has correct section properties', () => {
            const lib = workspace.filesLibraries.find(l => l.path.includes('BaseLib'));
            assert.ok(lib !== undefined, 'BaseLib should be in libraries');
            assert.ok(lib!.sectionProperties.properties.length > 0);
        });

        test('Module InfDsc preserves location', () => {
            const mod = workspace.filesModules[0];
            assert.ok(mod.location.uri.fsPath.endsWith('testDscProcess.dsc'));
        });
    });

    suite('Grayout Ranges', () => {
        test('parsedDocuments has entry for processed document', () => {
            const ranges = (workspace as any).parsedDocuments.get(doc.uri.fsPath);
            assert.ok(ranges !== undefined, 'Should have grayout entry');
        });

        test('Grayout ranges exist for inactive conditional blocks', () => {
            const ranges: vscode.Range[] = (workspace as any).parsedDocuments.get(doc.uri.fsPath);
            // The !if FALSE ... !else block should generate at least one grayout range
            assert.ok(ranges.length >= 1,
                `Expected >=1 grayout ranges, got ${ranges.length}`);
        });
    });

    suite('Comment Stripping', () => {
        test('stripComment removes line comments', () => {
            const result = (workspace as any).stripComment('DEFINE X = 1 # comment');
            assert.strictEqual(result, 'DEFINE X = 1');
        });

        test('stripComment preserves hash inside quotes', () => {
            const result = (workspace as any).stripComment('DEFINE X = "value#with#hash"');
            assert.strictEqual(result, 'DEFINE X = "value#with#hash"');
        });

        test('stripComment trims whitespace', () => {
            const result = (workspace as any).stripComment('  some text  ');
            assert.strictEqual(result, 'some text');
        });

        test('stripComment returns empty for comment-only line', () => {
            const result = (workspace as any).stripComment('# just a comment');
            assert.strictEqual(result, '');
        });
    });
});

// ═══════════════════════════════════════════════════════════════
//  _doProccessWorkspace tests
// ═══════════════════════════════════════════════════════════════

suite('EdkWorkspace._doProccessWorkspace', () => {
    let workspace: EdkWorkspace;

    suiteSetup(async function () {
        this.timeout(15_000);
        ensureProcessingGlobals();
        const doc = await openDscDocument('testDscProcess.dsc');
        workspace = new EdkWorkspace(doc);
        const result = await (workspace as any)._doProccessWorkspace();
        assert.ok(result === true, '_doProccessWorkspace should return true');
    });

    suite('Workspace Initialization', () => {
        test('platformName is populated from PLATFORM_NAME define', () => {
            assert.strictEqual(workspace.platformName, 'TestProcess');
        });

        test('workInProgress is false after completion', () => {
            assert.strictEqual((workspace as any).workInProgress, false);
        });

        test('processComplete is true after completion', () => {
            assert.strictEqual((workspace as any).processComplete, true);
        });
    });

    suite('State Reset', () => {
        test('Running again resets and re-processes', async () => {
            // First run already done in suiteSetup. Reset workInProgress flag
            // by accessing the internal state directly (it was set to false).
            const result = await (workspace as any)._doProccessWorkspace();
            assert.ok(result === true, 'Second run should succeed');
            assert.strictEqual(workspace.platformName, 'TestProcess');
        });

        test('Returns false if already in progress', async () => {
            (workspace as any).workInProgress = true;
            const result = await (workspace as any)._doProccessWorkspace();
            assert.strictEqual(result, false, 'Should return false when workInProgress');
            (workspace as any).workInProgress = false;
        });
    });

    suite('Defines After Full Processing', () => {
        test('All defines from [Defines] section are available', () => {
            const defs = workspace.getDefinitions();
            assert.ok(defs.has('PLATFORM_NAME'));
            assert.ok(defs.has('MY_FLAG'));
            assert.ok(defs.has('MY_PATH'));
        });

        test('Conditional defines are correctly resolved', () => {
            assert.strictEqual(workspace.getDefinition('COND_TAKEN'), 'IfTrueValue');
            assert.strictEqual(workspace.getDefinition('COND_ELSE'), 'ElseValue');
        });

        test('replaceDefine works after processing', () => {
            const result = workspace.replaceDefine('$(PLATFORM_NAME)');
            assert.strictEqual(result, 'TestProcess');
        });
    });

    suite('PCDs After Full Processing', () => {
        test('PCDs are available after processing', () => {
            const pcds = workspace.getPcds('gTestPkg');
            assert.ok(pcds !== undefined);
            assert.ok(pcds!.size >= 3, `Expected >=3 PCDs, got ${pcds!.size}`);
        });
    });

    suite('File Lists After Full Processing', () => {
        test('dscList contains the main document', () => {
            const list = workspace.dscList();
            assert.ok(list.length >= 1, 'dscList should have at least 1 entry');
            assert.ok(list.some(p => p.endsWith('testDscProcess.dsc')));
        });

        test('Libraries are populated', () => {
            assert.ok(workspace.filesLibraries.length >= 2);
        });

        test('Modules are populated', () => {
            assert.ok(workspace.filesModules.length >= 2);
        });

        test('getFilesList aggregates all lists', () => {
            const all = workspace.getFilesList();
            assert.ok(all.length >= 4,
                `Expected >=4 total files (dsc+libs+mods), got ${all.length}`);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
//  proccessWorkspace (public API) tests
// ═══════════════════════════════════════════════════════════════

suite('EdkWorkspace.proccessWorkspace', () => {
    test('proccessWorkspace runs without errors', async function () {
        this.timeout(15_000);
        ensureProcessingGlobals();
        const doc = await openDscDocument('testDscProcess.dsc');
        const workspace = new EdkWorkspace(doc);
        const result = await workspace.proccessWorkspace();
        assert.ok(result === true, 'proccessWorkspace should return true');
        assert.strictEqual(workspace.platformName, 'TestProcess');
    });

    test('proccessWorkspace populates defines and PCDs', async function () {
        this.timeout(15_000);
        ensureProcessingGlobals();
        const doc = await openDscDocument('testDscProcess.dsc');
        const workspace = new EdkWorkspace(doc);
        await workspace.proccessWorkspace();
        assert.ok(workspace.getDefinitions().size > 0, 'Should have defines');
        assert.ok(workspace.getAllPcds().size > 0, 'Should have PCDs');
    });
});
