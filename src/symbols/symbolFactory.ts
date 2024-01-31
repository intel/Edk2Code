import * as vscode from 'vscode';
import { gDebugLog } from "../extension";

import { EdkSymbolDscDefine, EdkSymbolDscInclude, EdkSymbolDscLibraryDefinition, EdkSymbolDscLine, EdkSymbolDscModuleDefinition, EdkSymbolDscPcdDefinition, EdkSymbolDscSection } from "./dscSymbols";
import { EdkSymbolFdfSection, EdkSymbolFdfInf, EdkSymbolFdfDefinition, EdkSymbolFdfFile, EdkSymbolFdfInclude } from './fdfSymbols';
import { EdkSymbolInfSectionLibraries, EdkSymbolInfSectionProtocols, EdkSymbolInfSectionPpis, EdkSymbolInfSectionGuids, EdkSymbolInfSectionPcds, EdkSymbolInfSection, EdkSymbolInfDefine, EdkSymbolInfSource, EdkSymbolInfLibrary, EdkSymbolInfPackage, EdkSymbolInfPpi, EdkSymbolInfProtocol, EdkSymbolInfPcd, EdkSymbolInfGuid, EdkSymbolInfDepex, EdkSymbolInfBinary, EdkSymbolInfFunction, EdkSymbolInfSectionSource, EdkSymbolSectionPackages, EdkSymbolinfSectionDepex } from './infSymbols';
import { EdkSymbolDecSection, EdkSymbolDecDefine, EdkSymbolDecLibrary, EdkSymbolDecPackage, EdkSymbolDecPpi, EdkSymbolDecProtocol, EdkSymbolDecPcd, EdkSymbolDecGuid, EdkSymbolDecIncludes } from './decSymbols';
import { EdkSymbolCondition, EdkSymbolUnknown } from './commonSymbols';
import { Edk2SymbolType } from './symbolsType';
import { DocumentParser } from '../edkParser/languageParser';
import { EdkSymbolVfrDefault, EdkSymbolVfrFormset, EdkSymbolVfrForm, EdkSymbolVfrOneof, EdkSymbolVfrCheckbox, EdkSymbolVfrString, EdkSymbolVfrPassword, EdkSymbolVfrNumeric, EdkSymbolVfrGoto } from './vfrSymbols';
import { EdkSymbolAslDefinitionBlock, EdkSymbolAslExternal, EdkSymbolAslScope, EdkSymbolAslDevice, EdkSymbolAslName, EdkSymbolAslMethod, EdkSymbolAslField, EdkSymbolAslOperationRegion } from './aslSymbols';



export class SymbolFactory {

    produceSymbol(type: Edk2SymbolType, textLine: string, location: vscode.Location, parser:DocumentParser) {
        
        switch (type) {
            case Edk2SymbolType.dscSection:
                return new EdkSymbolDscSection(textLine, location, true, true, parser);
            case Edk2SymbolType.dscDefine:
                return new EdkSymbolDscDefine(textLine, location, true, true, parser);
            case Edk2SymbolType.dscLibraryDefinition:
                return new EdkSymbolDscLibraryDefinition(textLine, location, true, true, parser);
            case Edk2SymbolType.dscModuleDefinition:
                return new EdkSymbolDscModuleDefinition(textLine, location, true, true, parser);
            case Edk2SymbolType.dscPcdDefinition:
                return new EdkSymbolDscPcdDefinition(textLine, location, true, true, parser);
            case Edk2SymbolType.dscInclude:
                return new EdkSymbolDscInclude(textLine, location, true, true, parser);
            case Edk2SymbolType.dscLine:
                return new EdkSymbolDscLine(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionSource:
                return new EdkSymbolInfSectionSource(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionPackages:
                return new EdkSymbolSectionPackages(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionLibraries:
                return new EdkSymbolInfSectionLibraries(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionProtocols:
                return new EdkSymbolInfSectionProtocols(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionPpis:
                return new EdkSymbolInfSectionPpis(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionGuids:
                return new EdkSymbolInfSectionGuids(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionDepex:
                return new EdkSymbolinfSectionDepex(textLine, location, true, true, parser);
            case Edk2SymbolType.infSectionPcds:
                return new EdkSymbolInfSectionPcds(textLine, location, true, true, parser);
            case Edk2SymbolType.infSection:
                return new EdkSymbolInfSection(textLine, location, true, true, parser);
            case Edk2SymbolType.infDefine:
                return new EdkSymbolInfDefine(textLine, location, true, true, parser);
            case Edk2SymbolType.infSource:
                return new EdkSymbolInfSource(textLine, location, true, true, parser);
            case Edk2SymbolType.infLibrary:
                return new EdkSymbolInfLibrary(textLine, location, true, true, parser);
            case Edk2SymbolType.infPackage:
                return new EdkSymbolInfPackage(textLine, location, true, true, parser);
            case Edk2SymbolType.infPpi:
                return new EdkSymbolInfPpi(textLine, location, true, true, parser);
            case Edk2SymbolType.infProtocol:
                return new EdkSymbolInfProtocol(textLine, location, true, true, parser);
            case Edk2SymbolType.infPcd:
                return new EdkSymbolInfPcd(textLine, location, true, true, parser);
            case Edk2SymbolType.infGuid:
                return new EdkSymbolInfGuid(textLine, location, true, true, parser);
            case Edk2SymbolType.infDepex:
                return new EdkSymbolInfDepex(textLine, location, true, true, parser);
            case Edk2SymbolType.infBinary:
                return new EdkSymbolInfBinary(textLine, location, true, true, parser);
            case Edk2SymbolType.infFunction:
                return new EdkSymbolInfFunction(textLine, location, true, true, parser);



            case Edk2SymbolType.decSection:
                return new EdkSymbolDecSection(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decDefine:
                return new EdkSymbolDecDefine(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decLibrary:
                return new EdkSymbolDecLibrary(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decPackage:
                return new EdkSymbolDecPackage(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decPpi:
                return new EdkSymbolDecPpi(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decProtocol:
                return new EdkSymbolDecProtocol(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decPcd:
                return new EdkSymbolDecPcd(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decGuid:
                return new EdkSymbolDecGuid(textLine, location, true, true, parser);
                
            case Edk2SymbolType.decInclude:
                return new EdkSymbolDecIncludes(textLine, location, true, true, parser);
                
            case Edk2SymbolType.aslDefinitionBlock:
                return new EdkSymbolAslDefinitionBlock(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslExternal:
                return new EdkSymbolAslExternal(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslScope:
                return new EdkSymbolAslScope(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslDevice:
                return new EdkSymbolAslDevice(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslName:
                return new EdkSymbolAslName(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslMethod:
                return new EdkSymbolAslMethod(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslField:
                return new EdkSymbolAslField(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslOpRegion:
                return new EdkSymbolAslOperationRegion(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.aslDefault:
                break;
            case Edk2SymbolType.vfrDefault:
                return new EdkSymbolVfrDefault(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrFormset:
                return new EdkSymbolVfrFormset(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrForm:
                return new EdkSymbolVfrForm(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrOneof:
                return new EdkSymbolVfrOneof(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrCheckbox:
                return new EdkSymbolVfrCheckbox(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrString:
                return new EdkSymbolVfrString(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrPassword:
                return new EdkSymbolVfrPassword(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrNumeric:
                return new EdkSymbolVfrNumeric(textLine, location, true, true, parser);
                break;
            case Edk2SymbolType.vfrGoto:
                return new EdkSymbolVfrGoto(textLine, location, true, true, parser);
                break;

            case Edk2SymbolType.fdfSection:
                return new EdkSymbolFdfSection(textLine, location, true, true, parser);

            case Edk2SymbolType.fdfInf:
                return new EdkSymbolFdfInf(textLine, location, true, true, parser);

            case Edk2SymbolType.fdfDefinition:
                return new EdkSymbolFdfDefinition(textLine, location, true, true, parser);

            case Edk2SymbolType.fdfFile:
                return new EdkSymbolFdfFile(textLine, location, true, true, parser);

            case Edk2SymbolType.fdfInclude:
                return new EdkSymbolFdfInclude(textLine, location, true, true, parser);



            case Edk2SymbolType.condition:
                return new EdkSymbolCondition(textLine, location, true, true, parser);
                
            case Edk2SymbolType.unknown:
                return new EdkSymbolUnknown(textLine, location, true, true, parser);
               
            default:
                gDebugLog.error(`Symbol factory doesnt support: ${type}`);
                return undefined;
        }
    }
}