import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { AslParser } from '../../edkParser/aslParser';
import { Edk2SymbolType } from '../../symbols/symbolsType';
import { DebugLog } from '../../debugLog';

function ensureGlobals() {
    const ext = require('../../extension');
    if (!ext.gDebugLog) {
        ext.gDebugLog = new DebugLog();
    }
}

async function parseAslFile(filename: string): Promise<AslParser> {
    ensureGlobals();
    const filePath = path.resolve(__dirname, '../../../test', filename);
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const parser = new AslParser(document);
    await parser.parseFile();
    return parser;
}

function symbolsOfType(parser: AslParser, type: Edk2SymbolType) {
    return parser.symbolsList.filter(s => s.type === type);
}

suite('ASL Parser – Symbol Extraction', () => {

    let parser: AslParser;

    suiteSetup(async function () {
        this.timeout(10_000);
        parser = await parseAslFile('testAslParsing.asl');
    });

    suite('Blocks', () => {
        test('Parses DefinitionBlock', () => {
            const defs = symbolsOfType(parser, Edk2SymbolType.aslDefinitionBlock);
            assert.ok(defs.length >= 1, 'Expected at least one DefinitionBlock');
        });

        test('Parses External declarations', () => {
            const externals = symbolsOfType(parser, Edk2SymbolType.aslExternal);
            assert.ok(externals.length >= 2, `Expected >=2 externals, got ${externals.length}`);
        });

        test('Parses Scope blocks', () => {
            const scopes = symbolsOfType(parser, Edk2SymbolType.aslScope);
            assert.ok(scopes.length >= 2, `Expected >=2 scopes, got ${scopes.length}`);
        });

        test('Parses Device blocks', () => {
            const devices = symbolsOfType(parser, Edk2SymbolType.aslDevice);
            assert.ok(devices.length >= 2, `Expected >=2 devices, got ${devices.length}`);
        });
    });

    suite('Members', () => {
        test('Parses Name declarations', () => {
            const names = symbolsOfType(parser, Edk2SymbolType.aslName);
            assert.ok(names.length >= 4, `Expected >=4 names, got ${names.length}`);
        });

        test('Parses Method blocks', () => {
            const methods = symbolsOfType(parser, Edk2SymbolType.aslMethod);
            assert.ok(methods.length >= 2, `Expected >=2 methods, got ${methods.length}`);
        });

        test('Parses OperationRegion declarations', () => {
            const regions = symbolsOfType(parser, Edk2SymbolType.aslOpRegion);
            assert.ok(regions.length >= 2, `Expected >=2 OperationRegions, got ${regions.length}`);
        });

        test('Parses Field declarations', () => {
            const fields = symbolsOfType(parser, Edk2SymbolType.aslField);
            assert.ok(fields.length >= 2, `Expected >=2 fields, got ${fields.length}`);
        });
    });

    suite('Tree Structure', () => {
        test('DefinitionBlock has children', () => {
            const defBlock = symbolsOfType(parser, Edk2SymbolType.aslDefinitionBlock);
            assert.ok(defBlock.length > 0);
            assert.ok(defBlock[0].children.length > 0, 'DefinitionBlock should have child symbols');
        });

        test('Device contains Names as children', () => {
            const devices = symbolsOfType(parser, Edk2SymbolType.aslDevice);
            const tpm = devices.find(d => /TPM0/i.test(d.name));
            assert.ok(tpm, 'TPM0 device should exist');
            const childTypes = tpm!.children.map(c => (c as any).type);
            assert.ok(childTypes.includes(Edk2SymbolType.aslName), 'TPM0 should contain a Name');
        });
    });

    suite('Consistency', () => {
        test('symbolsTree is not empty', () => {
            assert.ok(parser.symbolsTree.length > 0);
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
                assert.ok(!s.name.startsWith('//'), `Symbol should not start with //: "${s.name}"`);
            }
        });
    });
});
