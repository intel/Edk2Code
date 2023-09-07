// Original file from: https://github.com/WalonLi/edk2-vscode

import * as vscode from 'vscode';
import { DictHoverProvider, DictHoverProviderDb, EdkSymbolProvider, HelpHoverProvider, JsonCompletionItemLabel, JsonCompletionProvider } from './symbolProvider';
import { getEdkCodeFolderFilePath, getStaticPath } from '../utils';
import * as fs from 'fs';
import { EdkDefinitionProvider } from './definitionProvider';
import { EdkDeclarationProvider } from './declarationProvider';
import { EdkCompletionProvider } from './completionProvider';



export function initLanguages() {
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_dsc' }, new EdkSymbolProvider());
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_dsc' }, new EdkDefinitionProvider()); 
  vscode.languages.registerHoverProvider({ scheme: 'file', language: 'edk2_dsc' }, new DictHoverProviderDb());
  
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_inf' }, new EdkSymbolProvider());
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_inf' }, new EdkDefinitionProvider());
  vscode.languages.registerCompletionItemProvider ({ scheme: 'file', language: 'edk2_inf' }, new EdkCompletionProvider());
  vscode.languages.registerDeclarationProvider ({ scheme: 'file', language: 'edk2_inf' }, new EdkDeclarationProvider());

  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_dec' }, new EdkSymbolProvider());
  // vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_dec' }, new EdkDefinitionProvider());
  
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_fdf' }, new EdkSymbolProvider());
  vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'edk2_fdf' }, new EdkDefinitionProvider()); 
  vscode.languages.registerHoverProvider({ scheme: 'file', language: 'edk2_fdf' }, new DictHoverProviderDb());

  
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'edk2_vfr' }, new EdkSymbolProvider());
  vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'asl' }, new EdkSymbolProvider());

  // // ASL support
  vscode.languages.registerCompletionItemProvider ({ scheme: 'file', language: 'asl' }, new JsonCompletionProvider("acpiHelp.json",
                                                   (x:any)=>{return new JsonCompletionItemLabel(x.title.split(" ")[0], x.description);}));

  vscode.languages.registerHoverProvider({ scheme: 'file', language: 'asl' }, new HelpHoverProvider(getStaticPath("acpiHelp.json"),
                                        (x:string, entrie:any)=>{return entrie.title.startsWith(x);},
                                        [{fieldname:"title", pre:"# ", pos:"\n\n"},
                                        {fieldname:"syntax", pre:"`", pos:"`\n\n"},
                                        {fieldname:"arguments", pre:"> ", pos:"\n\n"},
                                        {fieldname:"description", pre:"", pos:"\n\n *ACPI 6.3*"}])                                      
    );


}


