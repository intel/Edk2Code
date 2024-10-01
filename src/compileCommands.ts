

import path = require("path");
import { gWorkspacePath } from "./extension";
import * as fs from 'fs';
import { readEdkCodeFolderFile } from "./edk2CodeFolder";
import { normalizePath } from "./utils";

interface CompileCommandsEntryJson{
    command: string;
    directory: string;
    file: string;
}

export class CompileCommandsEntry{
    command: string;
    directory: string;
    file: string;

    constructor(command: string, directory: string, file: string){
        this.command = command;
        this.directory = directory;
        this.file = file;
    }

    getDefines(): string[]{
        const defines: string[] = [];
        // Combine patterns for gcc (-D) and msbuild (/D)
        const match = this.command.match(/(-D\s*[^ ]+)|(\/D\s*[^ ]+)/g);
        if (match) {
            match.forEach((define) => {
                // Remove leading -D or /D and trim whitespace
                defines.push(define.replace(/^-D\s*|\/D\s*/g, '').trim());
            });
        }
        return defines;
    }

    getIncludePaths(): string[] {
        const includePaths: string[] = [];
        // Combine patterns for gcc (-I) and msbuild (/I)
        const match = this.command.match(/(-I\s*[^ ]+)|(\/I\s*[^ ]+)/g);
        if (match) {
            match.forEach((includePath) => {
                // Remove leading -I or /I and trim whitespace
                includePaths.push(includePath.replace(/^-I\s*|\/I\s*/g, '').trim());
            });
        }
        return includePaths;
    }

}

export class CompileCommands{
    compileCommands: Map<string, CompileCommandsEntry> = new Map();



    load(){
        const compileCommandsText = readEdkCodeFolderFile("compile_commands.json");
        if(compileCommandsText){
            const compileCommandsObject = JSON.parse(compileCommandsText);
            // Populate compileCommands Map based on the file name
            compileCommandsObject.forEach((entry: CompileCommandsEntryJson) => {
                // Normalize the file path
                const filePath = normalizePath(entry.file);
                this.compileCommands.set(filePath, new CompileCommandsEntry(entry.command, entry.directory, entry.file));
            });
        }
    }

    getCompileCommandForFile(file: string): CompileCommandsEntry|undefined{
        const filePath = normalizePath(file);
        return this.compileCommands.get(filePath);
    }
}