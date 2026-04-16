import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DscParser } from '../../edkParser/dscParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

/**
 * Ensure gDebugLog is initialised even when the extension does not activate
 * (e.g. no workspace folders in the test environment).
 */
function ensureGlobals() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

/**
 * Helper: open a .dsc file from the test/ folder and parse it with DscParser.
 * Returns the parser instance so callers can inspect symbolsList / symbolsTree.
 */
async function parseDscFile(filename: string): Promise<DscParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new DscParser(document);
    await parser.parseFile();
    return parser;
}

/** Filter helper: return all symbols of a given type from the flat list. */
function symbolsOfType(parser: DscParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('DSC Parser – Symbol Extraction', () => {

    let parser: DscParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseDscFile('testDscParsing.dsc');
    });

    suite('Sections', () => {
        test('Parses [Defines] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const defines = sections.filter(s => /defines/i.test(s.name));
            assert.ok(defines.length >= 1, 'Expected at least one [Defines] section');
        });

        test('Parses [LibraryClasses] sections (common + arch-specific)', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const libSections = sections.filter(s => /libraryclasses/i.test(s.name));
            assert.ok(libSections.length >= 2, `Expected >=2 LibraryClasses sections, got ${libSections.length}`);
        });

        test('Parses [Components] and [Components.X64] sections', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const compSections = sections.filter(s => /components/i.test(s.name));
            assert.ok(compSections.length >= 2, `Expected >=2 Components sections, got ${compSections.length}`);
        });

        test('Parses [SkuIds] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const sku = sections.filter(s => /skuids/i.test(s.name));
            assert.strictEqual(sku.length, 1, 'Expected exactly one [SkuIds] section');
        });

        test('Parses [BuildOptions] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscBuildOptionsSection);
            assert.ok(sections.length >= 1, 'Expected at least one [BuildOptions] section');
        });

        test('Parses PCD sections (FixedAtBuild + DynamicDefault)', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const pcdSections = sections.filter(s => /pcd/i.test(s.name));
            assert.ok(pcdSections.length >= 2, `Expected >=2 PCD sections, got ${pcdSections.length}`);
        });
    });

    suite('Defines', () => {
        test('Parses DEFINE statements inside [Defines]', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.dscDefine);
            assert.ok(defines.length >= 3, `Expected >=3 defines, got ${defines.length}`);
        });

        test('DEFINE with empty value is still parsed', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.dscDefine);
            const emptyVar = defines.find(s => /EMPTY_VAR/i.test(s.name));
            assert.ok(emptyVar, 'EMPTY_VAR define should be parsed');
        });

        test('Root-level DEFINE (outside section) is parsed', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.dscDefine);
            const rootDef = defines.find(s => /ROOT_DEFINE/i.test(s.name));
            assert.ok(rootDef, 'ROOT_DEFINE should be parsed as a root-level define');
        });
    });

    suite('Libraries', () => {
        test('Parses library class definitions', () => {
            const libs = symbolsOfType(parser, Edk2SymbolType.dscLibraryDefinition);
            assert.ok(libs.length >= 4, `Expected >=4 library definitions, got ${libs.length}`);
        });

        test('Library definition with extra whitespace around pipe is parsed', () => {
            const libs = symbolsOfType(parser, Edk2SymbolType.dscLibraryDefinition);
            const printLib = libs.find(s => /PrintLib/i.test(s.name));
            assert.ok(printLib, 'PrintLib (extra whitespace around |) should be parsed');
        });
    });

    suite('Modules / Components', () => {
        test('Parses simple .inf module references', () => {
            const modules = symbolsOfType(parser, Edk2SymbolType.dscModuleDefinition);
            assert.ok(modules.length >= 3, `Expected >=3 module definitions, got ${modules.length}`);
        });

        test('Module with sub-sections (curly braces) is parsed', () => {
            const modules = symbolsOfType(parser, Edk2SymbolType.dscModuleDefinition);
            const complex = modules.find(s => /ComplexModule/i.test(s.name));
            assert.ok(complex, 'ComplexModule.inf should be parsed as a module definition');
            assert.ok(complex!.children.length > 0, 'ComplexModule should have child sub-sections');
        });

        test('Component sub-sections are parsed (<LibraryClasses>, <Pcds>, <BuildOptions>)', () => {
            const subSections = symbolsOfType(parser, Edk2SymbolType.dscComponentSubSection);
            assert.ok(subSections.length >= 2, `Expected >=2 component sub-sections, got ${subSections.length}`);
        });
    });

    suite('PCDs', () => {
        test('Parses PCD definitions', () => {
            const pcds = symbolsOfType(parser, Edk2SymbolType.dscPcdDefinition);
            assert.ok(pcds.length >= 3, `Expected >=3 PCD definitions, got ${pcds.length}`);
        });
    });

    suite('Build Options', () => {
        test('Parses build option entries', () => {
            const opts = symbolsOfType(parser, Edk2SymbolType.dscBuildOption);
            assert.ok(opts.length >= 2, `Expected >=2 build options, got ${opts.length}`);
        });
    });

    suite('Includes', () => {
        test('Parses !include directive', () => {
            const includes = symbolsOfType(parser, Edk2SymbolType.dscInclude);
            assert.ok(includes.length >= 1, 'Expected at least one !include directive');
            const inc = includes.find(s => /TestInclude/i.test(s.name));
            assert.ok(inc, 'TestInclude.dsc.inc should be found');
        });
    });

    suite('Tree Structure', () => {
        test('symbolsTree contains top-level section nodes', () => {
            assert.ok(parser.symbolsTree.length > 0, 'symbolsTree should not be empty');
            for (const root of parser.symbolsTree) {
                assert.ok(
                    root.type === Edk2SymbolType.dscSection ||
                    root.type === Edk2SymbolType.dscBuildOptionsSection ||
                    root.type === Edk2SymbolType.dscDefine ||
                    root.type === Edk2SymbolType.dscInclude ||
                    root.type === Edk2SymbolType.dscModuleDefinition ||
                    root.type === Edk2SymbolType.dscLibraryDefinition ||
                    root.type === Edk2SymbolType.dscPcdDefinition ||
                    root.type === Edk2SymbolType.dscBuildOption ||
                    root.type === Edk2SymbolType.unknown,
                    `Unexpected root symbol type: ${root.type}`
                );
            }
        });

        test('Library definitions are children of their parent section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.dscSection);
            const libSection = sections.find(s => /^\[?\s*libraryclasses\s*\]?$/i.test(s.name));
            if (libSection) {
                const childLibs = libSection.children.filter(
                    c => (c as any).type === Edk2SymbolType.dscLibraryDefinition
                );
                assert.ok(childLibs.length >= 3, `Expected >=3 library children in [LibraryClasses], got ${childLibs.length}`);
            }
        });
    });

    suite('Consistency', () => {
        test('symbolsList length equals total nodes across the tree', () => {
            function countNodes(nodes: vscode.DocumentSymbol[]): number {
                let count = 0;
                for (const n of nodes) {
                    count++;
                    count += countNodes(n.children);
                }
                return count;
            }
            const treeCount = countNodes(parser.symbolsTree);
            assert.strictEqual(parser.symbolsList.length, treeCount,
                'Flat symbolsList length should equal recursive tree node count');
        });

        test('Comments are not parsed as symbols', () => {
            const allNames = parser.symbolsList.map(s => s.name);
            for (const name of allNames) {
                assert.ok(!name.startsWith('#'), `Symbol name should not start with #: "${name}"`);
                assert.ok(!name.startsWith('/*'), `Symbol name should not start with /*: "${name}"`);
            }
        });
    });
});
