// Original file from: https://github.com/WalonLi/edk2-vscode

import * as vscode from 'vscode';
import { gEdkDatabase } from '../extension';
import { EdkCompletionProvider, EdkDeclarationProvider, EdkDefinitionProvider } from '../edkParser/edkSymbols';
import { DictHoverProvider, EdkSymbolProvider, HelpHoverProvider, JsonCompletionItemLabel, JsonCompletionProvider } from './generalSymbolProvider';
import { getStaticPath } from '../utils';
import * as fs from 'fs';



export function initLanguages() {
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_dsc' }, new EdkSymbolProvider(gEdkDatabase));
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_dsc' }, new EdkDefinitionProvider(gEdkDatabase)); 
  vscode.languages.registerHoverProvider({ scheme: 'file', language: 'edk2_dsc' }, new DictHoverProvider(gEdkDatabase));
  
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_inf' }, new EdkSymbolProvider(gEdkDatabase));
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_inf' }, new EdkDefinitionProvider(gEdkDatabase));
  vscode.languages.registerCompletionItemProvider ({ scheme: 'file', language: 'edk2_inf' }, new EdkCompletionProvider(gEdkDatabase));
  vscode.languages.registerDeclarationProvider ({ scheme: 'file', language: 'edk2_inf' }, new EdkDeclarationProvider(gEdkDatabase));

  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_dec' }, new EdkSymbolProvider(gEdkDatabase));
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_dec' }, new EdkDefinitionProvider(gEdkDatabase));
  
  // vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_fdf' }, new GeneralDefinitionProvider(fdfSymbolsRules));
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_fdf' }, new EdkSymbolProvider(gEdkDatabase));
  
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_vfr' }, new EdkSymbolProvider(gEdkDatabase));
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'asl' }, new EdkSymbolProvider(gEdkDatabase));

  // // vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_build_report' }, new MatchSymbolProvider(buildReportSymbolsRules));
  // // vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_build_report' }, new GeneralDefinitionProvider(buildReportSymbolsRules));

  // // ASL support
  vscode.languages.registerCompletionItemProvider ({ scheme: 'file', language: 'asl' }, new JsonCompletionProvider("acpiHelp.json",
                                                   (x:any)=>{return new JsonCompletionItemLabel(x.title.split(" ")[0], x.description);}));

  vscode.languages.registerHoverProvider({ scheme: 'file', language: 'asl' }, new HelpHoverProvider("acpiHelp.json",
                                        (x:string, entrie:any)=>{return entrie.title.startsWith(x);},
                                        [{fieldname:"title", pre:"# ", pos:"\n\n"},
                                        {fieldname:"syntax", pre:"`", pos:"`\n\n"},
                                        {fieldname:"arguments", pre:"> ", pos:"\n\n"},
                                        {fieldname:"description", pre:"", pos:"\n\n *ACPI 6.3*"}])                                      
    );


  // vscode.languages.registerHoverProvider({ scheme: 'file', language: 'edk2_vfr' }, new DefinitionHoverProvider(getStringDefinition));
  //vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_vfr' }, new FunctionDefinitionProvider(gotoStringDefinition));
    

}


