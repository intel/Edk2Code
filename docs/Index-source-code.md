# Quick start
Most of the extension functionality will work out of the box on any given EDK2 project. However it will have the full set of features enabled when the source code its compiled and the Index database is loaded.

## Rebuild Index Database
Once you source code its compiled you create your workspace index with the following command from the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette):

```
> EDK2: Rebuild index database
```
Vscode will ask you to select your build directory. After that it will detect the compilations inside your build directory, you can chose a single or multiple compilations to be loaded in your index:

![rebuildIndex](https://github.com/intel/Edk2Code/assets/62723455/fd0b5143-0d4e-4970-98a9-b3cfcf09f433)

## Enable compile information

You can use the [compile information](https://github.com/tianocore/edk2/commit/4ad7ea9c842289aed6ed519f9fce33cf37cfc2a9) build feature from EDK2 to provide more build information to the extension. This is optional but recommended

To enable the compile information you need to enable the [build report flag](https://tianocore-docs.github.io/edk2-BuildSpecification/release-1.28/13_build_reports/#13-build-reports) in the EDK2 `build` command and set `-Y COMPILE_INFO`. You can check more information about EDK build process [here](https://github.com/tianocore/tianocore.github.io/wiki/Windows-systems#build)

For example, if you want to build `EmulatorPkg` from EDK2 source, your build command will look like this:

```shell
build -p EmulatorPkg\EmulatorPkg.dsc -t VS2019 -a IA32 -Y COMPILE_INFO -y BuildReport.log
```

This will generate [compile information](https://github.com/tianocore/edk2/commit/4ad7ea9c842289aed6ed519f9fce33cf37cfc2a9) in your build folder.

`-Y COMPILE_INFO -y BuildReport.log` will add to your build folder the `CompileInfo` folder:

`x:\Edk2\Build\EmulatorIA32\DEBUG_VS2019\CompileInfo`

# Files produced after parsing

After parsing is completed, some files will be created in `.edkCode` folder on your workspace.

## .ignore
This is a list of all your the files in your source that were not used during compilation. The generation of this file can be disabled in the extension settings. This file is used by VSCODE to ignore unused files. You can toggle the use of .ignore file in search:

![Search ignore](https://github.com/intel/Edk2Code/assets/62723455/d0485a5e-d53e-4a09-b17d-34c056a382b9)

## compile_commands.json
This is the [compilation database](https://clang.llvm.org/docs/JSONCompilationDatabase.html) generated during build process. You can setup your [C/C++ VSCODE plugging](https://code.visualstudio.com/docs/cpp/faq-cpp#_how-do-i-get-intellisense-to-work-correctly) to use this compilation database to get better C parsing.

To setup compile commands in your workspace, open `C/C++: edit configurations (UI)` in command palette. Under **Advance Settings** look for **Compile commands** property. Set the path for `${workspaceFolder}\.edkCode\compile_commands.json` as shown in the following image:


![Compile commands](https://github.com/intel/Edk2Code/assets/62723455/b7e65859-f1ce-4409-badf-7efd5b6b96c2)

The EDK2Code extension will detect if `compile_commands.json` exists and will prompt the user to update the configuration

## cscope.files
This is the list of all your files used in compilation. This file is used by [Cscope](https://cscope.sourceforge.net) to help provide C definitions.

