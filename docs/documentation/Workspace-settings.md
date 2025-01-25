Once you have created your [workspace index](https://github.com/intel/Edk2Code/wiki/Index-source-code#rebuild-index-database) You will see a `.edkCode` folder in your workspace.

This colder contains `edk2_workspace_properties.json` file with the configuration used to generate the index. 
You can modify this file using one of the following commands:
* `EDK2: Workspace configuration (UI)`
* `EDK2: Workspace configuration (JSON)`

```json
{
    "packagePaths": [],
    "dscPaths": [
        "OvmfPkg\\OvmfPkgX64.dsc"
    ],
    "buildDefines": [
        "ARCH=X64"
    ]
}
```

**dscPaths** Each entry should be the main DSC files use for compilation.

**buildDefines** These entries are definitions injected in your build command with `-D`. You can add or modify this list accoording to your needs.

> after modification of this file, you will see a message in vscode asking to reload your index.

You can also modify this file using 