import * as fs from 'fs';
import { gDebugLog } from './extension';
import { readEdkCodeFolderFile } from './edk2CodeFolder';


interface PublicByValue {
    address: string;
    name: string;
}

interface Header {
    name: string;
    addressType:string;
    baseAddress: string;
    entryPoint: string;
    type: string;
    guid: string;
    textBaseAddress: string;
    dataBaseAddress: string;
    imagePath: string;
    publicData: Map<string, PublicByValue>;
}




export class MapFileData {
    modules: Header[] = [];

    constructor(mapFilePath: string) {
        if (!fs.existsSync(mapFilePath)) {
            gDebugLog.error(`Map file not found at ${mapFilePath}`);
            return;
        }
        this.parseMapFile(mapFilePath);
    }

    public isSymbolUsed(symbolName: string): boolean {
        for (const module of this.modules) {
            if (module.publicData.has(symbolName)) {
                return true;
            }
        }
        return false;
    }

    private parseMapFile(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        
        for (let line of lines) {
            line = line.trim();
            if(line.length === 0){continue;}
            
            let headerMatch = /([\w\d]*) \((.*?), BaseAddress=(0x[a-f\d]+), EntryPoint=(0x[a-f\d]+), Type=(\w*)\)/gmi.exec(line);
            if(headerMatch){
                let currentHeader = {
                    name: headerMatch[1].trim(),
                    addressType: headerMatch[2].trim(),
                    baseAddress: headerMatch[3].trim(),
                    entryPoint: headerMatch[4].trim(),
                    type: headerMatch[5].trim(),
                    guid: '',
                    textBaseAddress: '',
                    dataBaseAddress: '',
                    imagePath: '',
                    publicData: new Map()
                };
                this.modules.push(currentHeader);
                continue;
            }
            
            let currentHeader = this.modules[this.modules.length - 1];

            let guidMatch = /\(GUID=([A-F\d-]*) .textbaseaddress=(0x[a-f\d]+) .databaseaddress=(0x[a-f\d]+)\)/gmi.exec(line);
            if(guidMatch){
                if(this.modules[this.modules.length - 1]){
                    currentHeader.guid = guidMatch[1].trim();
                    currentHeader.textBaseAddress = guidMatch[2].trim();
                    currentHeader.dataBaseAddress = guidMatch[3].trim();
                }
                continue;
            }

            let imageMatch = /\(IMAGE=(.*?)\)\)/gmi.exec(line);
            if(imageMatch){
                if(currentHeader){
                    currentHeader.imagePath = imageMatch[1].trim();
                }
                continue;
            }

            let publicMatch = /(0x[a-f\d]+)\s*_(.*)$/gmi.exec(line);
            if(publicMatch){
                const publicByValue: PublicByValue = {
                    address: publicMatch[1].trim(),
                    name: publicMatch[2].trim()
                };
                if (currentHeader) {
                    currentHeader.publicData.set(publicByValue.name, publicByValue);
                }
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