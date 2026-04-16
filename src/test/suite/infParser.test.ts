import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { InfParser } from '../../edkParser/infParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

function ensureGlobals() {
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

async function parseInfFile(filename: string): Promise<InfParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new InfParser(document);
    await parser.parseFile();
    return parser;
}

function symbolsOfType(parser: InfParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('INF Parser – Symbol Extraction', () => {

    let parser: InfParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseInfFile('testInfParsing.inf');
    });

    suite('Sections', () => {
        test('Parses [Defines] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSection);
            const defines = sections.filter(s => /defines/i.test(s.name));
            assert.ok(defines.length >= 1, 'Expected at least one [Defines] section');
        });

        test('Parses [Sources] section(s)', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionSource);
            assert.ok(sections.length >= 1, `Expected >=1 Sources section, got ${sections.length}`);
        });

        test('Parses [Packages] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionPackages);
            assert.ok(sections.length >= 1, 'Expected at least one [Packages] section');
        });

        test('Parses [LibraryClasses] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionLibraries);
            assert.ok(sections.length >= 1, 'Expected at least one [LibraryClasses] section');
        });

        test('Parses [Protocols] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionProtocols);
            assert.ok(sections.length >= 1, 'Expected at least one [Protocols] section');
        });

        test('Parses [Ppis] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionPpis);
            assert.ok(sections.length >= 1, 'Expected at least one [Ppis] section');
        });

        test('Parses [Guids] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionGuids);
            assert.ok(sections.length >= 1, 'Expected at least one [Guids] section');
        });

        test('Parses [Pcd] / [FixedPcd] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionPcds);
            assert.ok(sections.length >= 1, 'Expected at least one PCD section');
        });

        test('Parses [Depex] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.infSectionDepex);
            assert.ok(sections.length >= 1, 'Expected at least one [Depex] section');
        });
    });

    suite('Defines', () => {
        test('Parses INF defines (MODULE_TYPE, BASE_NAME, etc.)', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.infDefine);
            assert.ok(defines.length >= 7, `Expected >=7 defines, got ${defines.length}`);
        });

        test('Parses ENTRY_POINT define', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.infDefine);
            const ep = defines.find(s => /ENTRY_POINT/i.test(s.name));
            assert.ok(ep, 'ENTRY_POINT should be parsed');
        });

        test('Parses CONSTRUCTOR define', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.infDefine);
            const ctor = defines.find(s => /CONSTRUCTOR/i.test(s.name));
            assert.ok(ctor, 'CONSTRUCTOR should be parsed');
        });

        test('Parses DESTRUCTOR define', () => {
            const defines = symbolsOfType(parser, Edk2SymbolType.infDefine);
            const dtor = defines.find(s => /DESTRUCTOR/i.test(s.name));
            assert.ok(dtor, 'DESTRUCTOR should be parsed');
        });
    });

    suite('Sources', () => {
        test('Parses source file entries', () => {
            const sources = symbolsOfType(parser, Edk2SymbolType.infSource);
            assert.ok(sources.length >= 3, `Expected >=3 source entries, got ${sources.length}`);
        });
    });

    suite('Packages', () => {
        test('Parses package references', () => {
            const packages = symbolsOfType(parser, Edk2SymbolType.infPackage);
            assert.ok(packages.length >= 2, `Expected >=2 packages, got ${packages.length}`);
        });
    });

    suite('Libraries', () => {
        test('Parses library class references', () => {
            const libs = symbolsOfType(parser, Edk2SymbolType.infLibrary);
            assert.ok(libs.length >= 3, `Expected >=3 library references, got ${libs.length}`);
        });
    });

    suite('Protocols', () => {
        test('Parses protocol entries', () => {
            const protocols = symbolsOfType(parser, Edk2SymbolType.infProtocol);
            assert.ok(protocols.length >= 2, `Expected >=2 protocols, got ${protocols.length}`);
        });
    });

    suite('PPIs', () => {
        test('Parses PPI entries', () => {
            const ppis = symbolsOfType(parser, Edk2SymbolType.infPpi);
            assert.ok(ppis.length >= 1, `Expected >=1 PPI, got ${ppis.length}`);
        });
    });

    suite('GUIDs', () => {
        test('Parses GUID entries', () => {
            const guids = symbolsOfType(parser, Edk2SymbolType.infGuid);
            assert.ok(guids.length >= 2, `Expected >=2 GUIDs, got ${guids.length}`);
        });
    });

    suite('PCDs', () => {
        test('Parses PCD entries', () => {
            const pcds = symbolsOfType(parser, Edk2SymbolType.infPcd);
            assert.ok(pcds.length >= 1, `Expected >=1 PCD, got ${pcds.length}`);
        });
    });

    suite('Depex', () => {
        test('Parses dependency expression entries', () => {
            const depex = symbolsOfType(parser, Edk2SymbolType.infDepex);
            assert.ok(depex.length >= 1, `Expected >=1 depex entry, got ${depex.length}`);
        });
    });

    suite('Consistency', () => {
        test('symbolsTree is not empty', () => {
            assert.ok(parser.symbolsTree.length > 0, 'symbolsTree should not be empty');
        });

        test('symbolsList equals recursive tree count', () => {
            function countNodes(nodes: vscode.DocumentSymbol[]): number {
                let c = 0;
                for (const n of nodes) { c++; c += countNodes(n.children); }
                return c;
            }
            assert.strictEqual(parser.symbolsList.length, countNodes(parser.symbolsTree));
        });

        test('Comments are not parsed as symbols', () => {
            for (const s of parser.symbolsList) {
                assert.ok(!s.name.startsWith('#'), `Symbol should not start with #: "${s.name}"`);
            }
        });
    });
});
