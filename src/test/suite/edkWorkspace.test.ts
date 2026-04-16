import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DebugLog } from '../../debugLog';
import {
    SectionProperty,
    SectionProperties,
    InfDsc,
    EdkWorkspaces,
    EdkWorkspace,
} from '../../index/edkWorkspace';

/**
 * Ensure gDebugLog is initialised even when the extension does not activate.
 */
function ensureGlobals() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

function makeLoc(line: number = 0): vscode.Location {
    return new vscode.Location(
        vscode.Uri.file('d:/fake/test.dsc'),
        new vscode.Position(line, 0)
    );
}

// ─── SectionProperty ──────────────────────────────────────────

suite('SectionProperty', () => {
    test('constructor lowercases all fields', () => {
        const prop = new SectionProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(prop.sectionType, 'libraryclasses');
        assert.strictEqual(prop.arch, 'x64');
        assert.strictEqual(prop.moduleType, 'dxe_driver');
    });

    test('constructor with already lowercase values', () => {
        const prop = new SectionProperty('components', 'ia32', 'peim');
        assert.strictEqual(prop.sectionType, 'components');
        assert.strictEqual(prop.arch, 'ia32');
        assert.strictEqual(prop.moduleType, 'peim');
    });
});

// ─── SectionProperties ────────────────────────────────────────

suite('SectionProperties', () => {
    test('starts with empty properties', () => {
        const sp = new SectionProperties();
        assert.strictEqual(sp.properties.length, 0);
    });

    test('addProperty adds correctly', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.properties.length, 1);
        assert.strictEqual(sp.properties[0].sectionType, 'libraryclasses');
    });

    test('addProperty multiple', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        sp.addProperty('Components', 'IA32', 'PEIM');
        assert.strictEqual(sp.properties.length, 2);
    });

    // ── compareArch ──

    test('compareArch returns true for matching arch', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('Components', 'X64', 'PEIM');

        assert.strictEqual(sp1.compareArch(sp2), true);
    });

    test('compareArch returns false for different archs', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('Components', 'IA32', 'PEIM');

        assert.strictEqual(sp1.compareArch(sp2), false);
    });

    // ── compareArchStr ──

    test('compareArchStr returns true for matching arch string', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareArchStr('X64'), true);
        assert.strictEqual(sp.compareArchStr('x64'), true);
    });

    test('compareArchStr returns false for non-matching arch', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareArchStr('IA32'), false);
    });

    // ── compareLibSectionType ──

    test('compareLibSectionType returns true for matching section type', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('LibraryClasses', 'IA32', 'PEIM');

        assert.strictEqual(sp1.compareLibSectionType(sp2), true);
    });

    test('compareLibSectionType returns false for different section types', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('Components', 'X64', 'DXE_DRIVER');

        assert.strictEqual(sp1.compareLibSectionType(sp2), false);
    });

    // ── compareLibSectionTypeStr ──

    test('compareLibSectionTypeStr case-insensitive match', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareLibSectionTypeStr('LibraryClasses'), true);
        assert.strictEqual(sp.compareLibSectionTypeStr('libraryclasses'), true);
        assert.strictEqual(sp.compareLibSectionTypeStr('LIBRARYCLASSES'), true);
    });

    test('compareLibSectionTypeStr returns false for non-matching', () => {
        const sp = new SectionProperties();
        sp.addProperty('Components', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareLibSectionTypeStr('LibraryClasses'), false);
    });

    // ── compareModuleType ──

    test('compareModuleType returns true for matching module type', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('Components', 'IA32', 'DXE_DRIVER');

        assert.strictEqual(sp1.compareModuleType(sp2), true);
    });

    test('compareModuleType returns false for different module types', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('LibraryClasses', 'X64', 'PEIM');

        assert.strictEqual(sp1.compareModuleType(sp2), false);
    });

    // ── compareModuleTypeStr ──

    test('compareModuleTypeStr case-insensitive', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareModuleTypeStr('DXE_DRIVER'), true);
        assert.strictEqual(sp.compareModuleTypeStr('dxe_driver'), true);
    });

    test('compareModuleTypeStr returns false for non-matching', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        assert.strictEqual(sp.compareModuleTypeStr('PEIM'), false);
    });

    // ── toString ──

    test('toString returns comma-separated properties', () => {
        const sp = new SectionProperties();
        sp.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        sp.addProperty('Components', 'IA32', 'PEIM');
        const str = sp.toString();
        assert.ok(str.includes(','), 'should contain comma separator');
    });

    // ── multi-property matching ──

    test('compareArch matches any combination', () => {
        const sp1 = new SectionProperties();
        sp1.addProperty('LibraryClasses', 'X64', 'DXE_DRIVER');
        sp1.addProperty('LibraryClasses', 'IA32', 'DXE_DRIVER');

        const sp2 = new SectionProperties();
        sp2.addProperty('Components', 'IA32', 'PEIM');

        assert.strictEqual(sp1.compareArch(sp2), true);
    });
});

// ─── InfDsc ───────────────────────────────────────────────────

suite('InfDsc', () => {
    test('constructor with section parent sets sectionProperties', () => {
        ensureGlobals();
        const loc = makeLoc(10);
        const inf = new InfDsc(
            'MdePkg/Library/BaseLib/BaseLib.inf',
            loc,
            'Components.X64',
            'MdePkg/Library/BaseLib/BaseLib.inf'
        );
        assert.strictEqual(inf.parent, undefined, 'section parent should set parent to undefined');
        assert.ok(inf.sectionProperties.properties.length > 0, 'should have section properties');
        assert.strictEqual(inf.sectionProperties.properties[0].sectionType, 'components');
        assert.strictEqual(inf.sectionProperties.properties[0].arch, 'x64');
    });

    test('constructor with INF parent sets parent path', () => {
        ensureGlobals();
        const loc = makeLoc(5);
        const inf = new InfDsc(
            'MdePkg/Library/BaseLib/BaseLib.inf',
            loc,
            'SomeModule/Module.inf',
            'SomeLib|MdePkg/Library/BaseLib/BaseLib.inf'
        );
        assert.ok(inf.parent !== undefined, 'INF parent should set parent path');
        assert.ok(inf.parent!.includes('Module.inf'));
        assert.strictEqual(inf.sectionProperties.properties.length, 0, 'INF parent should not set section properties');
    });

    test('constructor normalizes path separators', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'MdePkg/Library/BaseLib/BaseLib.inf',
            loc,
            'Components.common',
            'line text'
        );
        // path.sep on Windows is \\, on Linux /
        assert.ok(!inf.path.includes('/') || path.sep === '/', 'forward slashes should be normalized to path.sep');
    });

    test('constructor with multi-section parent', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'Pkg/Lib.inf',
            loc,
            'LibraryClasses.X64.DXE_DRIVER,LibraryClasses.IA32.PEIM',
            'SomeLib|Pkg/Lib.inf'
        );
        assert.strictEqual(inf.parent, undefined);
        assert.strictEqual(inf.sectionProperties.properties.length, 2);
        assert.strictEqual(inf.sectionProperties.properties[0].arch, 'x64');
        assert.strictEqual(inf.sectionProperties.properties[0].moduleType, 'dxe_driver');
        assert.strictEqual(inf.sectionProperties.properties[1].arch, 'ia32');
        assert.strictEqual(inf.sectionProperties.properties[1].moduleType, 'peim');
    });

    test('constructor with section missing arch defaults to common', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'Pkg/Lib.inf',
            loc,
            'libraryclasses',
            'SomeLib|Pkg/Lib.inf'
        );
        assert.strictEqual(inf.sectionProperties.properties[0].sectionType, 'libraryclasses');
        assert.strictEqual(inf.sectionProperties.properties[0].arch, 'common');
        assert.strictEqual(inf.sectionProperties.properties[0].moduleType, 'common');
    });

    test('getModuleTypeStr returns comma-separated module types', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'Pkg/Lib.inf',
            loc,
            'LibraryClasses.X64.DXE_DRIVER,LibraryClasses.IA32.PEIM',
            'SomeLib|Pkg/Lib.inf'
        );
        const moduleTypes = inf.getModuleTypeStr();
        assert.ok(moduleTypes.includes('dxe_driver'));
        assert.ok(moduleTypes.includes('peim'));
        assert.ok(moduleTypes.includes(','));
    });

    test('getModuleTypeStr single property', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'Pkg/Mod.inf',
            loc,
            'Components.X64',
            'Pkg/Mod.inf'
        );
        const moduleTypes = inf.getModuleTypeStr();
        assert.strictEqual(moduleTypes, 'common');
    });

    test('toString includes path and line number', () => {
        ensureGlobals();
        const loc = makeLoc(42);
        const inf = new InfDsc(
            'Pkg/Mod.inf',
            loc,
            'Components.X64',
            'Pkg/Mod.inf'
        );
        const str = inf.toString();
        assert.ok(str.includes('42'), 'toString should include line number');
    });

    test('text property stores original line', () => {
        ensureGlobals();
        const loc = makeLoc();
        const inf = new InfDsc(
            'Pkg/Lib.inf',
            loc,
            'LibraryClasses.common',
            'BaseLib|MdePkg/Library/BaseLib/BaseLib.inf'
        );
        assert.strictEqual(inf.text, 'BaseLib|MdePkg/Library/BaseLib/BaseLib.inf');
    });

    test('location is preserved', () => {
        ensureGlobals();
        const loc = makeLoc(99);
        const inf = new InfDsc(
            'Pkg/Lib.inf',
            loc,
            'Components',
            'line'
        );
        assert.strictEqual(inf.location.range.start.line, 99);
    });
});

// ─── EdkWorkspaces ────────────────────────────────────────────

suite('EdkWorkspaces', () => {
    test('isConfigured returns false when no workspaces', () => {
        const ws = new EdkWorkspaces();
        assert.strictEqual(ws.isConfigured(), false);
    });

    test('isConfigured returns true after adding a workspace', async () => {
        ensureGlobals();
        const ws = new EdkWorkspaces();
        // Create a minimal mock document for the constructor
        const filePath = path.resolve(__dirname, '../../../test/testDscParsing.dsc');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        const edkWs = new EdkWorkspace(doc);
        ws.workspaces = [edkWs];
        assert.strictEqual(ws.isConfigured(), true);
    });

    test('getInstance returns singleton', () => {
        const inst1 = EdkWorkspaces.getInstance();
        const inst2 = EdkWorkspaces.getInstance();
        assert.strictEqual(inst1, inst2);
    });

    test('isFileInUse returns undefined when no workspaces', async () => {
        const ws = new EdkWorkspaces();
        const result = await ws.isFileInUse(vscode.Uri.file('d:/fake/file.dsc'));
        assert.strictEqual(result, undefined);
    });

    test('getWorkspace returns empty array when no workspaces', async () => {
        const ws = new EdkWorkspaces();
        const result = await ws.getWorkspace(vscode.Uri.file('d:/fake/file.dsc'));
        assert.strictEqual(result.length, 0);
    });

    test('getDefinition returns undefined when no workspaces', async () => {
        const ws = new EdkWorkspaces();
        const result = await ws.getDefinition(vscode.Uri.file('d:/fake/file.dsc'), 'SOME_VAR');
        assert.strictEqual(result, undefined);
    });

    test('replaceDefines returns original text when no workspaces', async () => {
        const ws = new EdkWorkspaces();
        const result = await ws.replaceDefines(vscode.Uri.file('d:/fake/file.dsc'), '$(MY_VAR)/path');
        assert.strictEqual(result, '$(MY_VAR)/path');
    });

    test('getLib returns empty array when no workspaces', async () => {
        const ws = new EdkWorkspaces();
        const loc = new vscode.Location(
            vscode.Uri.file('d:/fake/file.dsc'),
            new vscode.Position(0, 0)
        );
        const result = await ws.getLib(loc);
        assert.strictEqual(result.length, 0);
    });
});

// ─── EdkWorkspace ─────────────────────────────────────────────

suite('EdkWorkspace', () => {
    let workspace: EdkWorkspace;

    suiteSetup(async () => {
        ensureGlobals();
        const filePath = path.resolve(__dirname, '../../../test/testDscParsing.dsc');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        workspace = new EdkWorkspace(doc);
    });

    // ── Constructor ──

    test('constructor sets mainDsc from document', () => {
        assert.ok(workspace.mainDsc.fsPath.endsWith('testDscParsing.dsc'));
    });

    test('constructor generates a numeric id', () => {
        assert.strictEqual(typeof workspace.id, 'number');
        assert.ok(workspace.id > 0);
    });

    test('platformName starts as undefined', () => {
        assert.strictEqual(workspace.platformName, undefined);
    });

    test('flashDefinitionDocument starts as undefined', () => {
        assert.strictEqual(workspace.flashDefinitionDocument, undefined);
    });

    // ── Lists ──

    test('filesLibraries starts empty', () => {
        assert.strictEqual(workspace.filesLibraries.length, 0);
    });

    test('filesModules starts empty', () => {
        assert.strictEqual(workspace.filesModules.length, 0);
    });

    test('dscList is initially empty', () => {
        assert.strictEqual(workspace.dscList().length, 0);
    });

    test('fdfList is initially empty', () => {
        assert.strictEqual(workspace.fdfList().length, 0);
    });

    test('getFilesList aggregates all file lists', () => {
        assert.ok(Array.isArray(workspace.getFilesList()));
    });

    test('includeTree starts empty', () => {
        assert.strictEqual(workspace.includeTree.length, 0);
    });

    // ── Definitions (no processing) ──

    test('getDefinitions returns a Map', () => {
        const defs = workspace.getDefinitions();
        assert.ok(defs instanceof Map);
    });

    test('getDefinition returns undefined for unknown key', () => {
        assert.strictEqual(workspace.getDefinition('NON_EXISTENT'), undefined);
    });

    test('getDefinitionLocation returns undefined for unknown key', () => {
        assert.strictEqual(workspace.getDefinitionLocation('NON_EXISTENT'), undefined);
    });

    test('replaceDefine passes through text with no defines', () => {
        const result = workspace.replaceDefine('$(UNKNOWN_VAR)/path');
        assert.strictEqual(result, '$(UNKNOWN_VAR)/path');
    });

    // ── PCDs ──

    test('getPcds returns undefined for unknown namespace', () => {
        assert.strictEqual(workspace.getPcds('gUnknownPkg'), undefined);
    });

    test('getAllPcds returns a Map', () => {
        const pcds = workspace.getAllPcds();
        assert.ok(pcds instanceof Map);
    });

    // ── Library / Module management ──

    test('filesLibraries can be set', () => {
        const loc = makeLoc();
        const lib = new InfDsc('Pkg/Lib.inf', loc, 'LibraryClasses.common', 'BaseLib|Pkg/Lib.inf');
        workspace.filesLibraries = [lib];
        assert.strictEqual(workspace.filesLibraries.length, 1);
        workspace.filesLibraries = []; // reset
    });

    test('filesModules can be set', () => {
        const loc = makeLoc();
        const mod = new InfDsc('Pkg/Mod.inf', loc, 'Components.X64', 'Pkg/Mod.inf');
        workspace.filesModules = [mod];
        assert.strictEqual(workspace.filesModules.length, 1);
        workspace.filesModules = []; // reset
    });

    test('getFilesList includes libraries and modules', () => {
        const loc = makeLoc();
        workspace.filesLibraries = [new InfDsc('Pkg/Lib.inf', loc, 'LibraryClasses', 'Lib|Pkg/Lib.inf')];
        workspace.filesModules = [new InfDsc('Pkg/Mod.inf', loc, 'Components', 'Pkg/Mod.inf')];
        const list = workspace.getFilesList();
        assert.ok(list.length >= 2, 'should include at least library and module paths');
        workspace.filesLibraries = [];
        workspace.filesModules = [];
    });

    // ── filesDsc / filesFdf sets ──

    test('filesDsc can be set and read', async () => {
        const filePath = path.resolve(__dirname, '../../../test/testDscParsing.dsc');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        workspace.filesDsc = new Set([doc]);
        assert.strictEqual(workspace.filesDsc.size, 1);
        assert.strictEqual(workspace.dscList().length, 1);
        workspace.filesDsc = new Set();
    });

    test('filesFdf can be set and read', async () => {
        const filePath = path.resolve(__dirname, '../../../test/testFdfParsing.fdf');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        workspace.filesFdf = new Set([doc]);
        assert.strictEqual(workspace.filesFdf.size, 1);
        assert.strictEqual(workspace.fdfList().length, 1);
        workspace.filesFdf = new Set();
    });

    // ── getLib ──

    test('getLib returns undefined when no matching library', async () => {
        const loc = new vscode.Location(
            vscode.Uri.file('d:/nonexistent/file.dsc'),
            new vscode.Position(999, 0)
        );
        const result = await workspace.getLib(loc);
        assert.strictEqual(result, undefined);
    });

    test('getLib finds matching library by location', async () => {
        const uri = vscode.Uri.file('d:/fake/platform.dsc');
        const loc = new vscode.Location(uri, new vscode.Position(10, 0));
        const lib = new InfDsc('Pkg/Lib.inf', loc, 'LibraryClasses.common', 'BaseLib|Pkg/Lib.inf');
        workspace.filesLibraries = [lib];

        const result = await workspace.getLib(loc);
        assert.ok(result !== undefined, 'should find the library');
        assert.strictEqual(result!.path, lib.path);
        workspace.filesLibraries = [];
    });
});

// ─── EdkWorkspace.evaluateExpression ──────────────────────────

suite('EdkWorkspace.evaluateExpression', () => {
    let workspace: EdkWorkspace;

    suiteSetup(async () => {
        ensureGlobals();
        const filePath = path.resolve(__dirname, '../../../test/testDscParsing.dsc');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        workspace = new EdkWorkspace(doc);
    });

    // ── Boolean literals ──

    test('TRUE evaluates to true', () => {
        assert.strictEqual(workspace.evaluateExpression('TRUE'), true);
    });

    test('FALSE evaluates to false', () => {
        assert.strictEqual(workspace.evaluateExpression('FALSE'), false);
    });

    test('true/false case-insensitive', () => {
        assert.strictEqual(workspace.evaluateExpression('true'), true);
        assert.strictEqual(workspace.evaluateExpression('True'), true);
        assert.strictEqual(workspace.evaluateExpression('false'), false);
    });

    // ── Numeric literals ──

    test('numeric 1 is truthy', () => {
        assert.strictEqual(workspace.evaluateExpression('1'), 1);
    });

    test('numeric 0 is falsy', () => {
        assert.strictEqual(workspace.evaluateExpression('0'), 0);
    });

    // ── Equality operators ──

    test('== with matching strings', () => {
        assert.strictEqual(workspace.evaluateExpression('"hello" == "hello"'), true);
    });

    test('== with non-matching strings', () => {
        assert.strictEqual(workspace.evaluateExpression('"hello" == "world"'), false);
    });

    test('!= with different strings', () => {
        assert.strictEqual(workspace.evaluateExpression('"hello" != "world"'), true);
    });

    test('!= with same strings', () => {
        assert.strictEqual(workspace.evaluateExpression('"hello" != "hello"'), false);
    });

    test('EQ operator', () => {
        assert.strictEqual(workspace.evaluateExpression('"a" EQ "a"'), true);
    });

    test('NE operator', () => {
        assert.strictEqual(workspace.evaluateExpression('"a" NE "b"'), true);
    });

    // ── Logical operators ──

    test('AND with both true', () => {
        assert.strictEqual(workspace.evaluateExpression('TRUE AND TRUE'), true);
    });

    test('AND with one false', () => {
        assert.strictEqual(workspace.evaluateExpression('TRUE AND FALSE'), false);
    });

    test('OR with one true', () => {
        assert.strictEqual(workspace.evaluateExpression('FALSE OR TRUE'), true);
    });

    test('OR with both false', () => {
        assert.strictEqual(workspace.evaluateExpression('FALSE OR FALSE'), false);
    });

    test('&& operator', () => {
        assert.strictEqual(workspace.evaluateExpression('TRUE && TRUE'), true);
    });

    test('|| operator', () => {
        assert.strictEqual(workspace.evaluateExpression('FALSE || TRUE'), true);
    });

    // ── NOT operator ──

    test('NOT TRUE evaluates to false', () => {
        // NOT is a unary operator that uses stack pop for y, x is undefined
        const result = workspace.evaluateExpression('NOT TRUE');
        assert.strictEqual(result, false);
    });

    test('NOT FALSE evaluates to true', () => {
        const result = workspace.evaluateExpression('NOT FALSE');
        // NOT inverts the value
        assert.ok(result, 'NOT FALSE should be truthy');
    });

    // ── Arithmetic ──

    test('addition', () => {
        assert.strictEqual(workspace.evaluateExpression('3 + 2'), 5);
    });

    test('subtraction', () => {
        assert.strictEqual(workspace.evaluateExpression('5 - 2'), 3);
    });

    test('multiplication', () => {
        assert.strictEqual(workspace.evaluateExpression('3 * 4'), 12);
    });

    test('division', () => {
        assert.strictEqual(workspace.evaluateExpression('10 / 2'), 5);
    });

    test('modulus', () => {
        assert.strictEqual(workspace.evaluateExpression('10 % 3'), 1);
    });

    // ── Comparison ──

    test('greater than', () => {
        assert.strictEqual(workspace.evaluateExpression('5 > 3'), true);
    });

    test('less than', () => {
        assert.strictEqual(workspace.evaluateExpression('3 > 5'), false);
    });

    test('greater or equal', () => {
        assert.strictEqual(workspace.evaluateExpression('5 >= 5'), true);
    });

    test('less or equal', () => {
        assert.strictEqual(workspace.evaluateExpression('3 <= 5'), true);
    });

    // ── Parentheses ──

    test('parentheses group expressions', () => {
        assert.strictEqual(workspace.evaluateExpression('(TRUE OR FALSE) AND TRUE'), true);
    });

    test('nested parentheses', () => {
        assert.strictEqual(workspace.evaluateExpression('((1 + 2) * 3)'), 9);
    });

    test('unbalanced parentheses throw', () => {
        assert.throws(() => {
            workspace.evaluateExpression('(TRUE AND FALSE');
        });
    });

    // ── IN operator ──

    test('IN operator with match', () => {
        assert.strictEqual(workspace.evaluateExpression('"X64" IN "X64 IA32 ARM"'), true);
    });

    test('IN operator without match', () => {
        assert.strictEqual(workspace.evaluateExpression('"AARCH64" IN "X64 IA32 ARM"'), false);
    });

    // ── Undefined variables (???) ──

    test('undefined variable evaluates to false', () => {
        // The expression evaluator replaces "???" with FALSE
        assert.strictEqual(workspace.evaluateExpression('"???"'), false);
    });

    // ── String without quotes treated as string ──

    test('bare word is treated as quoted string', () => {
        const result = workspace.evaluateExpression('hello == "hello"');
        assert.strictEqual(result, true);
    });

    // ── Complex expressions ──

    test('complex: (1 + 2) > 2 AND TRUE', () => {
        assert.strictEqual(workspace.evaluateExpression('(1 + 2) > 2 AND TRUE'), true);
    });

    test('complex: FALSE OR (5 == 5)', () => {
        assert.strictEqual(workspace.evaluateExpression('FALSE OR (5 == 5)'), true);
    });
});
