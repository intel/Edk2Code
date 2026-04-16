import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DecParser } from '../../edkParser/decParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

function ensureGlobals() {
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

async function parseDecFile(filename: string): Promise<DecParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new DecParser(document);
    await parser.parseFile();
    return parser;
}

function symbolsOfType(parser: DecParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('DEC Parser – Symbol Extraction', () => {

    let parser: DecParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseDecFile('testDecParsing.dec');
    });

    suite('Sections', () => {
        test('Parses [Defines] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const defines = sections.filter(s => /defines/i.test(s.name));
            assert.ok(defines.length >= 1, 'Expected at least one [Defines] section');
        });

        test('Parses [Includes] sections (common + arch-specific)', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const incSections = sections.filter(s => /includes/i.test(s.name));
            assert.ok(incSections.length >= 2, `Expected >=2 Includes sections, got ${incSections.length}`);
        });

        test('Parses [LibraryClasses] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const libSections = sections.filter(s => /libraryclasses/i.test(s.name));
            assert.ok(libSections.length >= 1, 'Expected at least one [LibraryClasses] section');
        });

        test('Parses [Guids] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const guidSections = sections.filter(s => /guids/i.test(s.name));
            assert.ok(guidSections.length >= 1, 'Expected at least one [Guids] section');
        });

        test('Parses [Protocols] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const protoSections = sections.filter(s => /protocols/i.test(s.name));
            assert.ok(protoSections.length >= 1, 'Expected at least one [Protocols] section');
        });

        test('Parses [Ppis] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const ppiSections = sections.filter(s => /ppis/i.test(s.name));
            assert.ok(ppiSections.length >= 1, 'Expected at least one [Ppis] section');
        });

        test('Parses PCD sections', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.decSection);
            const pcdSections = sections.filter(s => /pcds/i.test(s.name));
            assert.ok(pcdSections.length >= 2, `Expected >=2 PCD sections, got ${pcdSections.length}`);
        });
    });

    suite('Includes', () => {
        test('Parses include directory entries', () => {
            const includes = symbolsOfType(parser, Edk2SymbolType.decInclude);
            assert.ok(includes.length >= 2, `Expected >=2 include paths, got ${includes.length}`);
        });
    });

    suite('Libraries', () => {
        test('Parses library class entries', () => {
            const libs = symbolsOfType(parser, Edk2SymbolType.decLibrary);
            assert.ok(libs.length >= 2, `Expected >=2 library classes, got ${libs.length}`);
        });
    });

    suite('GUIDs', () => {
        test('Parses GUID entries', () => {
            const guids = symbolsOfType(parser, Edk2SymbolType.decGuid);
            assert.ok(guids.length >= 1, `Expected >=1 GUID, got ${guids.length}`);
        });
    });

    suite('Protocols', () => {
        test('Parses protocol entries', () => {
            const protocols = symbolsOfType(parser, Edk2SymbolType.decProtocol);
            assert.ok(protocols.length >= 2, `Expected >=2 protocols, got ${protocols.length}`);
        });
    });

    suite('PPIs', () => {
        test('Parses PPI entries', () => {
            const ppis = symbolsOfType(parser, Edk2SymbolType.decPpi);
            assert.ok(ppis.length >= 1, `Expected >=1 PPI, got ${ppis.length}`);
        });
    });

    suite('PCDs', () => {
        test('Parses PCD entries', () => {
            const pcds = symbolsOfType(parser, Edk2SymbolType.decPcd);
            assert.ok(pcds.length >= 2, `Expected >=2 PCDs, got ${pcds.length}`);
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
