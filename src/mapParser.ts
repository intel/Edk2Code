import * as fs from 'fs';
import { gDebugLog } from './extension';
import { readEdkCodeFolderFile } from './edk2CodeFolder';


interface SymbolValue {
    segment: number;
    address: number;
    name: string;
    rvaBase: number;
    libObject: string;
}



export class MapFileData {
    moduleName:string = '';
    symbolData: Map<string,SymbolValue> = new Map();

    constructor(mapFilePath: string) {
        if (!fs.existsSync(mapFilePath)) {
            gDebugLog.error(`Map file not found at ${mapFilePath}`);
            return;
        }
        this.parseMapFile(mapFilePath);
    }

    public isSymbolUsed(symbolName: string): boolean {
        if (this.symbolData.has(symbolName)) {
            return true;
        }
        return false;
    }

    private parseMapFile(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        const moduleName = lines[0].trim();
        let isParseSymbols = false;

        for (let line of lines) {
            line = line.trim();
            if(line.length === 0){continue;}
            
            // Look for start of symbols
            if(!isParseSymbols){
                if(line.match(/Address\s*Publics by Value.*/gmi)){
                    isParseSymbols = true;
                }
                continue;
            }
            

            // Parse symbols
            let symbolMatch = /([a-f\d]+)\:([a-f\d]+)\s+_(.*?)\s+([a-f\d]+)\s+(.*)/gmi.exec(line);
            if(symbolMatch){
                const symbol: SymbolValue = {
                    segment: parseInt(symbolMatch[1].trim(),16),
                    address:  parseInt(symbolMatch[2].trim(),16),
                    name: symbolMatch[3].trim(),
                    rvaBase:  parseInt(symbolMatch[4].trim(),16),
                    libObject: symbolMatch[5].trim()
                };
                this.symbolData.set(symbol.name, symbol);
                continue;
            } 
        }

    }
}

export class MapFilesManager{
    mapFiles:Map<string, MapFileData> = new Map();

    constructor(){

    }

    load() {
        this.mapFiles = new Map();

        const mapData = readEdkCodeFolderFile("mapFiles.json");
        if(mapData){
            const mapFiles = JSON.parse(mapData);
            for(const mapFile of mapFiles){
                this.mapFiles.set(mapFile, new MapFileData(mapFile));
            }
        }
    }

    public isSymbolUsed(symbolName:string):boolean{
        for(const mapFile of this.mapFiles.values()){
            if(mapFile.isSymbolUsed(symbolName.split('(')[0].trim())){
                return true;
            }
        }
        return false;
    }
}