import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { FdfParser } from '../../edkParser/fdfParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

function ensureGlobals() {
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

async function parseFdfFile(filename: string): Promise<FdfParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new FdfParser(document);
    await parser.parseFile();
    return parser;
}

function symbolsOfType(parser: FdfParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('FDF Parser – Symbol Extraction', () => {

    let parser: FdfParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseFdfFile('testFdfParsing.fdf');
    });

    suite('Sections', () => {
        test('Parses [FD.*] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.fdfSection);
            const fd = sections.filter(s => /FD\./i.test(s.name));
            assert.ok(fd.length >= 1, `Expected >=1 FD section, got ${fd.length}`);
        });

        test('Parses [FV.*] sections', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.fdfSection);
            const fv = sections.filter(s => /FV\./i.test(s.name));
            assert.ok(fv.length >= 2, `Expected >=2 FV sections, got ${fv.length}`);
        });

        test('Parses [Rule.*] section', () => {
            const sections = symbolsOfType(parser, Edk2SymbolType.fdfSection);
            const rules = sections.filter(s => /Rule\./i.test(s.name));
            assert.ok(rules.length >= 1, `Expected >=1 Rule section, got ${rules.length}`);
        });
    });

    suite('INF References', () => {
        test('Parses INF module references', () => {
            const infs = symbolsOfType(parser, Edk2SymbolType.fdfInf);
            assert.ok(infs.length >= 3, `Expected >=3 INF refs, got ${infs.length}`);
        });
    });

    suite('Defines', () => {
        test('Parses DEFINE statements', () => {
            const defs = symbolsOfType(parser, Edk2SymbolType.fdfDefinition);
            assert.ok(defs.length >= 2, `Expected >=2 DEFINE statements, got ${defs.length}`);
        });
    });

    suite('Includes', () => {
        test('Parses !include directive', () => {
            const includes = symbolsOfType(parser, Edk2SymbolType.fdfInclude);
            assert.ok(includes.length >= 1, 'Expected at least one !include');
            const inc = includes.find(s => /TestFdfInclude/i.test(s.name));
            assert.ok(inc, 'TestFdfInclude.fdf.inc should be found');
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
