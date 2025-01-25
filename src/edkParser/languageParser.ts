
import { gDebugLog } from "../extension";
import * as vscode from 'vscode';
import path = require("path");
import { SymbolFactory } from "../symbols/symbolFactory";
import { Edk2SymbolType } from '../symbols/symbolsType';
import { WorkspaceDefinitions } from "../index/definitions";
import { EdkSymbol } from "../symbols/edkSymbols";
import { SectionProperties } from "../index/edkWorkspace";


export abstract class BlockParser {
    abstract name: string; // Name of the block parser
    abstract tag: RegExp; // Regular expression to match the block tag
    abstract start: RegExp | undefined; // Regular expression to match the start of the block content
    abstract end: RegExp | undefined; // Regular expression to match the end of the block content
    abstract type: Edk2SymbolType; // Type of the block parser
    excludeTag: RegExp | undefined; // Regular expression to exclude specific tags
    context: BlockParser[] = []; // Array of block parsers that can be nested inside this block parser
    abstract visible: boolean; // Indicates if the block is visible or hidden
    exclusive: boolean = true; // Indicates if other blocks should parse this line
    isRoot: boolean = false; // Indicates if this block is in the root block of the document

    constructor(isRoot: boolean = false) {
        this.isRoot = isRoot;
    }

    /**
     * The `parse` function is used to parse a document using a defined DocumentParser.
     *
     * @param {DocumentParser} docParser - An instance of a DocumentParser that will be used to parse the content.
     * @returns {boolean} - Returns true if the parsing was successful, false otherwise.
     */
    parse(docParser: DocumentParser) {
        // Check if line matches
        const currentIndex = docParser.lineIndex;

        let textLine = docParser.getNextLineTextUncomment();
        if (textLine === undefined || textLine.length === 0) {
            return false;
        }

        if (this.excludeTag && textLine.match(this.excludeTag)) {
            return false;
        }

        if (textLine.match(this.tag)) {
            gDebugLog.verbose(`New block ${this.name} (${this.tag.toString()} -> ${textLine})`);

            // Check if symbol is root definition
            if (this.isRoot && !docParser.isInRoot()) {
                return false;
            }

            const line = docParser.getLineAt(currentIndex);
            if (!line) {
                gDebugLog.error(`Wrong line: ${currentIndex} at ${docParser.document.fileName}`);
                return;
            }

            const range = new vscode.Range(line.range.start, new vscode.Position(docParser.document.lineCount, 0));
            const symbolFactory = new SymbolFactory();
            const location = new vscode.Location(docParser.document.uri, range);

            const symbol = symbolFactory.produceSymbol(this.type, textLine, location, docParser);

            if (!symbol) {
                return false;
            }

            docParser.addSymbol(symbol);
            docParser.pushSymbolStack(symbol);

            // look for block start
            if (this.start) {
                // read lines until start tag is found
                while (!textLine.match(this.start)) {

                    if (this.end && textLine.match(this.end)) {
                        docParser.popSymbolStack();
                        return true;
                    }

                    textLine = docParser.getNextLineTextUncomment();
                    if (textLine === undefined) {
                        docParser.popSymbolStack();
                        return true;
                    }
                }
            } else {
                if (this.end === undefined) {
                    docParser.popSymbolStack();
                    return true;
                }
            }

            // Parse block content
            while (docParser.hasPendingLines()) {
                // create a symbol
                textLine = docParser.getNextLineTextUncomment();

                if (textLine === undefined) {
                    gDebugLog.error("Wrong Line in parser");
                    return;
                }
                if (textLine.length === 0) {
                    continue;
                }

                // parse block
                const contextLength = this.context.length;
                for (let i = 0; i < contextLength; i++) {
                    const blockContext = this.context[i];
                    gDebugLog.verbose(`Parse block: ${blockContext.name}`);
                    // decrement line index as parser will get next line by default
                    docParser.decrementLineIndex();
                    const isSymbolAdded = blockContext.parse(docParser);
                    if (isSymbolAdded) {
                        gDebugLog.verbose("Added symbol");
                        if (blockContext.exclusive) {
                            break;
                        }
                    }
                }

                // Check the end tag
                if (this.end && textLine.match(this.end)) {
                    docParser.popSymbolStack();
                    return true;
                }
            }

            docParser.popSymbolStack();
            return true;
        }

        return false;
    }

    _debug() { }


}




export class DocumentParser {
    document: vscode.TextDocument; // The text document to parse
    lineIndex: number = 1; // Current line index for parsing

    commentStart: string = ""; // Start of a comment block
    commentEnd: string = ""; // End of a comment block
    commentLine: string[] = []; // Array to store individual lines of a comment
    inComment: boolean = false; // Flag to track if currently inside a comment block

    blockParsers: BlockParser[] = []; // Array of block parsers

    symbolsTree: EdkSymbol[] = []; // Tree structure to store parsed symbols
    symbolsList: EdkSymbol[] = []; // Flat list of parsed symbols
    symbolStack: EdkSymbol[] = []; // Stack to track the nesting of symbols

    defines: WorkspaceDefinitions = new WorkspaceDefinitions(); // Definitions for the workspace

    constructor(document: vscode.TextDocument) {
        this.document = document;
        this.lineIndex = 0;
    }

 /**
  * Checks if the current line is a comment.
  * 
  * @returns Returns true if the current line is a comment, otherwise false.
  */
 isLineComment() {
     // Get the text of the current line
     let line = this.document.lineAt(this.lineIndex - 1).text;
 
     // Remove any comment from the line
     line = this.removeComment(line);
 
     // If the line is empty after removing the comment, it is a comment line
     if (line === "") {
         return true;
     }
 
     // If the line is not empty after removing the comment, it is not a comment line
     return false;
 }

    /**
     * Method to retrieve a specific line from a document.
     *
     * @returns {string|undefined} The retrieved line from the document, or undefined if the current index exceeds the document's line count.
     */
    getLine() {
        // check if the line index is greater than or equal to the number of lines in the document
        if (this.lineIndex >= this.document.lineCount) {
            // if true, return undefined since no line exists at this index position
            return undefined;
        }

        // if the line index is less, get that line from the document using the lineAt() method
        let line = this.document.lineAt(this.lineIndex);
        // return the retrieved line.
        return line;
    }

    /**
     * This function is used to get the line at a specific index from a document.
     * It retrieves the line of text using the lineAt method of the document's object.
     * 
     * @param index - A number representing the index of the desired line in the document. 
     * Zero-based index numbers should be used, meaning the first line of the document is at index 0.
     * 
     * @returns - Returns a `line` object at the specified index. If the index is out of bounds of the document, it will return undefined.
     */
    getLineAt(index: number) {
        let line = this.document.lineAt(index);
        return line;
    }

/**
 * This function checks if there are any pending lines left in the document that have not been processed.
 *
 * @returns {boolean} It returns `true` if there is a pending line to be processed, `false` otherwise.
 */
    hasPendingLines(): boolean {
        return this.lineIndex < this.document.lineCount;
    }

    /**
     * Return the next line without comments.
     * Increment the line index to prepare for the next line.
     */
    getNextLineTextUncomment() {
        let line = this.getLineTextUncomment();
        this.incrementLineIndex();
        return line;
    }

    /**
     * Gets the text of the current line without comments.
     * If the line index is out of range, returns undefined.
     */
    getLineTextUncomment() {
        if (this.lineIndex >= this.document.lineCount) {
            return undefined;
        }

        let line = this.document.lineAt(this.lineIndex).text;
        line = this.removeComment(line);

        return line;
    }

    /**
     * Function to get the current line index.
     *
     * This function will return the index of the current line in the document
     * being processed. This is especially useful when needing to keep track 
     * of the current position within a document while processing it.
     *
     * @returns {number} The index of the current line in the document.
     */
    getLineIndex() {
        return this.lineIndex;
    }

 /**
  * The `incrementLineIndex` function increases the `lineIndex` property by one. 
  * This can be used to manually navigate through the lines of a document.
  */
    incrementLineIndex() {
        this.lineIndex++;
    }

    /**
     * Decreases the line index by one.
     * This allows you to move the line index pointer to the previous line in the document.
     */
    decrementLineIndex() {
        if(this.lineIndex === 0){
            gDebugLog.error("LineIndex already 0");
            return;
        }
        this.lineIndex--;
    }

    /**
     * Removes comment from the given line
     * @param line - The line of code to remove comments from
     * @returns The line of code without comments
     */
    removeComment(line: string) {
        // Iterate over each comment line and remove comments
        for (const comment of this.commentLine) {
            line = line.trim().split(comment)[0].trim(); // Remove comment substring
        }

        // Check if the line starts with the comment start marker
        if (line.startsWith(this.commentStart)) {
            this.inComment = true; // Set inComment flag to indicate line in a comment block
        }
        // Check if the line ends with the comment end marker
        if (line.endsWith(this.commentEnd)) {
            this.inComment = false; // Set inComment flag to indicate end of comment block
        }

        // Check if the line is inside a comment block
        if (this.inComment) {
            return ""; // Empty string indicates line is a comment
        }
        return line; // Return the line without comments
    }

    /**
     * This function adds a new symbol to the symbol stack.
     *
     * @param  {EdkSymbol} symbol - The input symbol to be added to the symbol stack
     * @returns {void}
     */
    pushSymbolStack(symbol: EdkSymbol) {
        this.symbolStack.push(symbol);
    }

    /**
     * This function checks if the symbol stack is empty.
     *
     * @returns A boolean indication whether the symbol stack is empty or not.
     * If it's empty, the function will return true, indicating the symbolStack is in the root.
     * If it's not empty, the function will return false.
     */
    isInRoot() {
        return this.symbolStack.length === 0;
    }

    /**
     * Remove the last symbol from the symbol stack and adjust its range based on its children range. 
     * @returns The last symbol from the symbol stack after adjusting its range, or undefined if the symbol stack is empty.
     */
    popSymbolStack() {
        // Retrieve the last symbol from the symbol stack
        let lastSymbol = this.symbolStack.pop();

        // Check if the symbol stack is empty
        if (lastSymbol === undefined) {
            // Print an error message and return undefined
            gDebugLog.error("Symbol stack is empty");
            return undefined;
        }

        // Adjust the range of the symbol based on its children range
        if (lastSymbol.children.length > 0) {
            // Get the end position of the symbol based on the range of the line before the current line index
            let end = lastSymbol.range.end;
            let line = this.getLineAt(this.lineIndex - 2);
            if (line) {
                end = line.range.end;
            }

            // Create a temporary range using the adjusted start and end positions
            let tempRange = new vscode.Range(lastSymbol.range.start, end);

            // Update the range of the last symbol
            lastSymbol.updateRange(tempRange);
        } else {
            // Get the end position of the symbol based on the range of the current line index
            let end = lastSymbol.range.end;
            let line = this.getLineAt(this.lineIndex - 1);
            if (line) {
                end = line.range.end;
            }

            // Create a temporary range using the adjusted start and end positions
            let tempRange = new vscode.Range(lastSymbol.range.start, end);

            // Update the range of the last symbol
            lastSymbol.updateRange(tempRange);
        }

        // Return the last symbol
        return lastSymbol;
    }

/**
 * This function adds a symbol to the tree structure. If the symbol stack is empty it means the symbol is a 
 * root. Otherwise, the symbol is a child of the last symbol that was pushed into the stack.
 *
 * @param symbol - The symbol to be added.
 */
addSymbol(symbol: EdkSymbol) {
    if (this.symbolStack.length === 0) {
        this.symbolsTree.push(symbol);
    } else {
        let lastSymbol = this.symbolStack[this.symbolStack.length - 1];
        lastSymbol.children.push(symbol);
        symbol.parent = lastSymbol;
    }
    this.symbolsList.push(symbol);
}


    /**
     * This function is responsible for parsing a file by iterating through its lines.
     * It skips lines that are comments, and calls the parseLine function for non-comment lines.
     * It keeps track of the progress using the lineIndex variable.
     * This function is asynchronous, indicating that it may involve additional operations that could delay its execution.
     */
    async parseFile() {
        // Log the start of the parsing process, including the file name
        gDebugLog.info(`Parse Start: ${this.document.fileName}`);

        // Reset the line index to the first line of the document
        this.lineIndex = 1;

        // Loop through each line of the document until reaching the line count
        while (this.lineIndex < this.document.lineCount) {
            // Check if the current line is not a line comment
            if (!this.isLineComment()) {
                // Parse the current non-comment line
                await this.parseLine();
            }

            // Increment the line index to proceed to the next line
            this.incrementLineIndex();
        }

        // Log the end of the parsing process, including the file name
        gDebugLog.info(`Parse End: ${this.document.fileName}`);
    }

    /**
     * Asynchronously parse a line of code.
     * This function iterates through all block parsers to parse the current line.
     * If a line parsed correctly and it's not the root, this function will reset the parse index and attempt
     * to perform additional parsing on the next line until no lines remain in the document.
     * If the current line is in the root of the document, this function will continue parsing without changing the parse index.
     * 
     * @async
     */
    async parseLine() {
        for (let parseIndex = 0; parseIndex < this.blockParsers.length; parseIndex++) {
            const block = this.blockParsers[parseIndex];
            this.decrementLineIndex();
            let parserResult = block.parse(this);
            if (parserResult) {
                if (block.isRoot || (block.start === undefined && block.end === undefined)) { continue; }
                parseIndex = -1; // reset index
                if (this.lineIndex >= this.document.lineCount) {
                    return;
                }
            }
        }
    }

    /**
     * Retrieves the symbol that contains the specified position.
     * @param position The position to check for symbol containment.
     * @returns The symbol that contains the position, or undefined if no symbol is found.
     */
    getSelectedSymbol(position: vscode.Position) {
        let selectedSymbol = undefined;
        for (const symbol of this.symbolsList) {
            if (symbol.range.contains(position)) {
                selectedSymbol = symbol;
            }
        }

        return selectedSymbol;
    }


    /**
     * Retrieves symbols of a specific type from the symbols list.
     *
     * @param type - The type of the symbols to retrieve.
     * @returns An array of symbols of the specified type.
     */
    getSymbolsType(type: Edk2SymbolType, filterContext: SectionProperties | undefined = undefined) {

        let symboList = Array.from(this.symbolsList.filter((x) => { return x.type === type; }));
        if(filterContext){
            // Just keep the libraries that matches the context properties
            symboList = symboList.filter((library)=>{
                if(library.sectionProperties.compareArchStr('common')){
                    return true;
                }

                if(filterContext){
                    return library.sectionProperties.compareArch(filterContext);
                }
                return false;

            });
        }
        return symboList;
    }
}



