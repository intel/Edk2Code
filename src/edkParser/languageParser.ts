import { EdkDatabase } from "./edkDatabase";
import { Edk2DocumentSymbols, Edk2Symbol, Edk2SymbolType } from "./edkSymbols";
import { gDebugLog, gSymbolProducer } from "../extension";
import * as vscode from 'vscode';
import { normalizePath, readLines, split } from "../utils";

export class LanguageParser {

    findByName(name: string) {
        name = name.toLowerCase();
        let retVal = [];
        for (const symb of this.getSymbolsList()) {
            if (symb.name.toLowerCase() === name) {
                retVal.push(symb);
            }
        }
        return retVal;
    }

    findByValueMatch(valueRegex: RegExp) {
        let retVal = [];
        for (const symb of this.getSymbolsList()) {
            if (symb.value.match(valueRegex)) {
                retVal.push(symb);
            }
        }
        return retVal;
    }

    findByValueMatchChildrens(valueRegex: RegExp) {
        let retVal = [];
        for (const symb of this.getSymbolsList()) {
            if (symb.value.match(valueRegex)) {
                for (const child of symb.children) {
                    retVal.push(child);
                }
            }
        }
        return retVal;
    }

    lastAddedBlock = undefined;
    edkDatabase: EdkDatabase;
    commentStart: string = "";
    commentEnd: string = "";
    commentLine: string[] = [];
    symbolsData: Edk2DocumentSymbols;

    blocks!: any[];
    blocksDic: Map<string, any> = new Map();

    inComment: boolean = false;
    blockStack: any[] = [];
    lineNo = 0;
    currentLineRaw = "";
    linesLength = 0;
    filePath = "";

    constructor(db: EdkDatabase, file: string) {
        this.edkDatabase = db;
        this.filePath = file;
        this.symbolsData = new Edk2DocumentSymbols(file);
        gDebugLog.info(`Parser created: ${file}`);
     
    }

    private removeInactiveSymbols(){
        let cleanSymbolList:Edk2Symbol[] = [];
        for (const s of this.symbolsData.symbolList) {
            if(s.isActive()){
                cleanSymbolList.push(s);
            }
        }
        this.symbolsData.symbolList = new Set(cleanSymbolList);
    }

    getSymbolsList(includeInactive:boolean=false) {
        if(includeInactive){
            return this.symbolsData.symbolList;
        }

        let cleanSymbolList:Edk2Symbol[] = [];
        for (const s of this.symbolsData.symbolList) {
            if(s.isActive()){
                cleanSymbolList.push(s);
            }
        }
        return new Set(cleanSymbolList);

    }

    getSymbolsTree() {
        return this.symbolsData.symbols;
    }

    async reloadSymbols() {
        await this.parseFile();
    }

    async parseInfPath(line: string) {
        if (!line.toLowerCase().includes(".inf")) { return; }
        line = split(line, "{", 2)[0];
        if (line.includes("|")) {
            let p = split(line, "|", 2)[1];
            let sp = await this.edkDatabase.findPath(p);
            return sp;
        } else {
            let sp = await this.edkDatabase.findPath(line);
            return sp;
        }
    }

    async preParse(){}
    async postParse(){}

    /**
     * Main Parsing function
     */
    async parseFile() {
        gDebugLog.info(`Parsing file: ${this.filePath}`);
        if(this.edkDatabase.parseComplete){
            await this.preParse();
        }
        // Initialize variables for parsing
        this.blockStack = [];
        this.symbolsData = new Edk2DocumentSymbols(this.filePath);

        // Populate with include source node location
        let include = this.edkDatabase.includeSource.get(normalizePath(this.filePath).toUpperCase());
        if(include){
            let symb = this.edkDatabase.findByTypeAndValue(Edk2SymbolType.dscInclude,normalizePath(this.filePath));
            if(symb.length>0 && symb[0].parent){
                // Add a copy of the parent so it wont include original offspring
                this.symbolsData.pushParent(symb[0].parent.clone());
            }
        }

        this.lineNo = 0;
        for (const b of this.blocks) {
            b["pending"] = 0;
            this.blocksDic.set(b.name, b);
        }


        let lines = readLines(this.filePath);
        this.linesLength = lines.length;

        for (let line of lines) {
            this.currentLineRaw = line;
            this.lineNo += 1;
            // Skip comments

            for (const comment of this.commentLine) {
                line = line.trim().split(comment)[0].trim();
            }
            let rawLine = line;
            if (line.startsWith(this.commentStart)) {
                this.inComment = true;
            }
            if (line.endsWith(this.commentEnd)) {
                this.inComment = false;
                continue;
            }
            if (line.length === 0) {
                continue;
            }

            if (!this.inComment) {
                let rLine = this.edkDatabase.replaceVariables(rawLine);
                await this.parseLine(rLine);
            }

        }
        if(this.edkDatabase.parseComplete){
            await this.postParse();
        }
        // this.removeInactiveSymbols();
        gDebugLog.info(`File parsed: ${this.filePath}`);
    }

    private getCurrentBlock() {
        return this.blockStack[this.blockStack.length - 1];
    }

    isPendingBlock() {
        if (this.blockStack.length > 0) {
            return true;
        }
        return false;
    }

    async parseLine(line: string) {
        let fullLine = line;
        
        if (line.length === 0) { return; }

        // CLOSE block
        line = fullLine;
        if (this.isPendingBlock()) {

                if (this.getCurrentBlock().end !== undefined && line.match(this.getCurrentBlock().end)) {
                    line = this.endBlockSection(line);
                }


        }

        // START Block
        line = fullLine;
        if (this.isPendingBlock()) {
                if (this.getCurrentBlock().start !== undefined && line.match(this.getCurrentBlock().start)) {
                    this.startBlockSection(line);
                }
        }

        // NEW Block
        line = fullLine;
        for (const block of this.blocks) {

            if (line.match(block.tag)) {
                let lineIndex = fullLine.length - line.length;
                await this.newBlockSection(line, block, lineIndex, fullLine);
            }

        }



        if (this.isPendingBlock() &&
            this.getCurrentBlock().inBlockFunction !== undefined) {
            let line = fullLine;
            // remove block beging
            let matchBlock = line.match(this.getCurrentBlock().tag);
            if (matchBlock) {
                line = fullLine.slice(matchBlock[0].length);
            }
            if (line.length > 0) {
                let block = this.getCurrentBlock();
                let x = await block.inBlockFunction(line, this, this.getCurrentBlock());
            }
        }

    }


    startBlockSection(line: string) {
        // This is used when blocks can have nested start symbols
        gDebugLog.debug(`START block [${this.getCurrentBlock().name}]: ${line}`);
        this.getCurrentBlock().pending += 1;
        // line = line.slice(1).trim();
        return line;
    }

    endBlockSection(line: string) {

        if (this.getCurrentBlock().start !== undefined) {
            this.getCurrentBlock().pending -= 1;
        }

        if (this.getCurrentBlock().pending <= 0) {
            // line = line.slice(1).trim();
            gDebugLog.debug(`END BLock [${this.getCurrentBlock().name}]: ${line}`);
            this.blockStack.pop();

            let previousParent = this.symbolsData.popParent();
            if (previousParent) {
                let parentRange = new vscode.Range(
                    previousParent.range.start,
                    new vscode.Position(this.lineNo-1, line.length)
                );
                gDebugLog.debug("Adjust parent range:");
                gDebugLog.debug(`  before: ${previousParent}`);
                previousParent.range = parentRange;
                gDebugLog.debug(`  after:  ${previousParent}`);
                
            }

        }
        return line;
    }

    async newBlockSection(line: string, block: any, lineIndex: number, fullLine: string, value: string | undefined = undefined) {
        gDebugLog.debug(`CREATE [${block.name}]: ${line}`);
        // check if this is really a valid name
        let validName = true;
        if (lineIndex > 0) {
            if (!fullLine.slice(lineIndex - 1).match(block.tag)) {
                validName = false;
            }
        }
        if (validName) {

            // Add new element to symbols tree
            if (block.end !== undefined) {
                await this.pushBlockParent(line, value, block);
                this.blockStack.push(block);
            } else {
                await this.pushBlockSingle(block, line);
                this.blockStack.push(block);
                this.endBlockSection(line);
            }
            this.lastAddedBlock = block;
        }
    }

    async pushBlockSingle(block: any, line: string) {
        let symRange = new vscode.Range(
            new vscode.Position(this.lineNo - 1, 0),
            new vscode.Position(this.lineNo - 1, 0)
        );
        let temp;
        if("produce" in block){
            temp = await block.produce(line, this, block);
        }else{
            temp = gSymbolProducer.produce(block.type, line, "", line, symRange, this.filePath);
        }
        if(temp){
            this.symbolsData.pushParent(temp);
        }
    }

    async pushBlockParent(line: string, value: string | undefined, block: any) {
        let symRange = new vscode.Range(
            new vscode.Position(this.lineNo - 1, 0),
            new vscode.Position(this.linesLength, this.currentLineRaw.length)
        );
        let setValue = line;
        if (value) {
            setValue = value;
        }
        let temp;
        if("produce" in block){
            temp = await block.produce(line, this, block);
        }else{
            temp = gSymbolProducer.produce(block.type, line, "", setValue, symRange, this.filePath);
        }
        
        this.symbolsData.pushParent(temp);
    }

    pushSimpleSymbol(line: string, name: string, detail: string, value: string, symbolType: Edk2SymbolType, singleLine: boolean = true) {
        let symRange;
        if (singleLine) {
            symRange = new vscode.Range(
                new vscode.Position(this.lineNo - 1, 0),
                new vscode.Position(this.lineNo - 1, this.currentLineRaw.length)
            );
        } else {
            symRange = new vscode.Range(
                new vscode.Position(this.lineNo - 1, 0),
                new vscode.Position(this.linesLength, this.currentLineRaw.length)
            );
        }
        let newSymbol = gSymbolProducer.produce(symbolType,
            name,
            detail,
            value,
            symRange,
            this.filePath);
        this.symbolsData.pushChild(newSymbol);
    }



    async pushBinarySymbol(line: string, splitSymbol: string, symbolType: Edk2SymbolType, skipRegex: RegExp | undefined = undefined, singleLine: boolean = true) {

        if (skipRegex) {
            if (line.match(skipRegex)) {
                return;
            }
        }

        if (!line.includes(splitSymbol)) { return; }

        // Add new symbol
        let [name, value] = split(line, splitSymbol, 2).map((x) => { return x.trim(); });
        let symRange;
        if (singleLine) {
            symRange = new vscode.Range(
                new vscode.Position(this.lineNo - 1, 0),
                new vscode.Position(this.lineNo - 1, this.currentLineRaw.length)
            );
        } else {
            symRange = new vscode.Range(
                new vscode.Position(this.lineNo - 1, 0),
                new vscode.Position(this.linesLength, this.currentLineRaw.length)
            );
        }
        let detail = value;

        let newSymbol = gSymbolProducer.produce(symbolType,
            name,
            detail,
            value,
            symRange,
            this.filePath);
        this.symbolsData.pushChild(newSymbol);
    }


    async parseAndPushRegexSymbol(line: string, parseRegex: RegExp, symbolType: Edk2SymbolType, skipRegex: RegExp | undefined = undefined, singleLine: boolean = true) {

        if (skipRegex) {
            if (line.match(skipRegex)) {
                return;
            }
        }


        if (line.match(parseRegex)) {
            let result = parseRegex.exec(line);
            if (!result) { return; }
            let expectedResults = ["name", "detail", "value"];
            let results: any = {
                "name": "",
                "detail": "",
                "value": ""
            };

            if (result.groups) {
                for (const keys of expectedResults) {
                    if (keys in result.groups) {
                        results[keys] = result.groups[keys];
                    }
                }
            }

            let symRange;
            if (singleLine) {
                symRange = new vscode.Range(
                    new vscode.Position(this.lineNo - 1, 0),
                    new vscode.Position(this.lineNo - 1, this.currentLineRaw.length)
                );
            } else {
                symRange = new vscode.Range(
                    new vscode.Position(this.lineNo - 1, 0),
                    new vscode.Position(this.linesLength, this.currentLineRaw.length)
                );
            }


            let newSymbol = gSymbolProducer.produce(symbolType,
                results.name,
                results.detail,
                results.value,
                symRange,
                this.filePath);
            this.symbolsData.pushChild(newSymbol);
        }

    }

    //
    // Block parsers
    //

    blockParserLine(line: string, thisParser: LanguageParser, block: any) {
        thisParser.pushSimpleSymbol(line, line, "", line, block.childType);
    }

    async blockParserBinary(line: string, thisParser: LanguageParser, block: any) {
        await thisParser.pushBinarySymbol(line, block.binarySymbol, block.childType, /^\!/gi);
    }

    /**
     * Parsers a line that contains <name>|<path> or <path>
     * @param line 
     * @param thisParser 
     * @param block 
     */
    async blockParserPath(line: string, thisParser: LanguageParser, block: any) {
        line = split(line, "|", 2)[0];

        let fp = await thisParser.edkDatabase.findPath(line, thisParser.filePath);
        let value = line;
        if (fp) {
            value = fp;
        }
        thisParser.pushSimpleSymbol(line, line, "", value, block.childType);
    }

}