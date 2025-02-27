import * as vscode from 'vscode';

import { gDebugLog } from '../extension';
import * as fs from 'fs';
import { infoMissingCppExtension } from '../ui/messages';
import { closeFileIfOpened, delay } from '../utils';
import { CppProvider } from './cppProvider';
import { MsCppProvider } from './msCpp';
import { ClangdProvider } from './clangd';



export function getCppProvider(): CppProvider|null {
    let provider:CppProvider;

    
    provider = new MsCppProvider();
    if (provider.isCpptoolsInstalled()){
        return provider;
    }

    provider = new ClangdProvider();
    if (provider.isCpptoolsInstalled()){
        return provider;
    }

    return null;
}


export async function checkCppConfiguration(){
    // Check if CPP extesion is installed

    const cppProvider = getCppProvider();

    if(cppProvider === null){
        infoMissingCppExtension();
        return;
    }

    await cppProvider.validateConfiguration();


}






