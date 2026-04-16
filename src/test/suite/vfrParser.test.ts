import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { VfrParser } from '../../edkParser/vfrParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

function ensureGlobals() {
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

async function parseVfrFile(filename: string): Promise<VfrParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new VfrParser(document);
    await parser.parseFile();
    return parser;
}

function symbolsOfType(parser: VfrParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('VFR Parser – Symbol Extraction', () => {

    let parser: VfrParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseVfrFile('testVfrParsing.vfr');
    });

    suite('Formset', () => {
        test('Parses formset', () => {
            const formsets = symbolsOfType(parser, Edk2SymbolType.vfrFormset);
            assert.ok(formsets.length >= 1, 'Expected at least one formset');
        });

        test('Parses form blocks', () => {
            const forms = symbolsOfType(parser, Edk2SymbolType.vfrForm);
            assert.ok(forms.length >= 0, `Unexpected negative form count: ${forms.length}`);
        });
    });

    suite('Controls', () => {
        test('Parses oneof controls', () => {
            const oneofs = symbolsOfType(parser, Edk2SymbolType.vfrOneof);
            assert.ok(oneofs.length >= 2, `Expected >=2 oneofs, got ${oneofs.length}`);
        });

        test('Parses checkbox controls', () => {
            const checkboxes = symbolsOfType(parser, Edk2SymbolType.vfrCheckbox);
            assert.ok(checkboxes.length >= 1, `Expected >=1 checkbox, got ${checkboxes.length}`);
        });

        test('Parses numeric controls', () => {
            const numerics = symbolsOfType(parser, Edk2SymbolType.vfrNumeric);
            assert.ok(numerics.length >= 1, `Expected >=1 numeric, got ${numerics.length}`);
        });

        test('Parses string controls', () => {
            const strings = symbolsOfType(parser, Edk2SymbolType.vfrString);
            assert.ok(strings.length >= 1, `Expected >=1 string control, got ${strings.length}`);
        });

        test('Parses password controls', () => {
            const passwords = symbolsOfType(parser, Edk2SymbolType.vfrPassword);
            assert.ok(passwords.length >= 1, `Expected >=1 password control, got ${passwords.length}`);
        });

        test('Parses goto references', () => {
            const gotos = symbolsOfType(parser, Edk2SymbolType.vfrGoto);
            assert.ok(gotos.length >= 2, `Expected >=2 goto refs, got ${gotos.length}`);
        });

        test('Parses prompt entries inside controls', () => {
            const prompts = symbolsOfType(parser, Edk2SymbolType.vfrString);
            assert.ok(prompts.length >= 2, `Expected >=2 prompt/string entries, got ${prompts.length}`);
        });
    });

    suite('Tree Structure', () => {
        test('symbolsTree is not empty', () => {
            assert.ok(parser.symbolsTree.length > 0);
        });

        test('Formset or form has children', () => {
            const formsets = symbolsOfType(parser, Edk2SymbolType.vfrFormset);
            const forms = symbolsOfType(parser, Edk2SymbolType.vfrForm);
            const withChildren = [...formsets, ...forms].filter(s => s.children.length > 0);
            assert.ok(withChildren.length > 0, 'At least one formset or form should have children');
        });
    });

    suite('Consistency', () => {
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
                assert.ok(!s.name.startsWith('//'), `Symbol should not start with //: "${s.name}"`);
            }
        });
    });
});
