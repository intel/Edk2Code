# Documentation
Before you start testing the functionality of the extension, please index [source code](https://github.com/intel/Edk2Code/wiki/Index-source-code).

## Configuration
You can check your workspace configuration with command:

```
> EDK2: Workspace configuration (UI)
```

This configuration will be automatically populated after you indexed your [source code](https://github.com/intel/Edk2Code/wiki/Index-source-code). 

- **DSC relative path** Are the main `DSC` files for your workspace
- **Build Defines** Build defines that were injected in your EDK2 build command
- **Package paths** are the paths set for the EDK2 Build command.

You can manually change this configuration. After any manual modification the user will be prompted to rescan the Index.

## Interface

### Status bar
When you open a file in the editor, you will see in the status bar a warning if the file you are looking has been compiled or not:

![Status bar](https://github.com/intel/Edk2Code/assets/62723455/893be801-0977-48cc-98b3-1f119d9f7679)

The following commands are expected to work only on files that have been used in compilation.

### Global commands
This commands are only accessible using the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) (⌨F1)

#### EDK2: Open library
Will show a list of all the libraries compiled.

![Open library](https://github.com/intel/Edk2Code/assets/62723455/396d9432-4cc8-4a11-ac76-c307b3409534)


#### EDK2: Open Module
Will show a list of all the modules compiled.


#### EDK2: Rebuild index database
This will clean up the current source index and will create a new one. [See](https://github.com/intel/Edk2Code/wiki/Index-source-code).

#### EDK2: Rescan index database
This will use the previous index configuration and will recreate the index without changing the workspace settings

## EDK2 language support
After you source code has been indexed you will see some of the features of using Edk2Code extension

> **⚠ IMPORTANT** Before continuing please index your code following this [instructions](https://github.com/intel/Edk2Code/wiki/Index-source-code) 


### INF files
#### Inf files will show syntax highlight:

![image](https://github.com/intel/Edk2Code/assets/62723455/bbe1fff6-6cd0-4d4c-9ca2-0e7455cc8a50)

#### Outline tree

![Outline tree](https://github.com/intel/Edk2Code/assets/62723455/845fe6b2-71a3-47bf-93cb-1b0d3ac48051)

#### Source goto definition
Right click on a source file name and then select `Go To Definition` (F12)

![Go to Definition](https://github.com/intel/Edk2Code/assets/62723455/5e12a914-cbac-4512-971a-554c589f6e42)

This will open the source file selected. This also works for `LibraryClasses`, `Pcd` and `Packages`:

![Goto Library](https://github.com/intel/Edk2Code/assets/62723455/278457ce-dea6-4235-a624-a3f856e4588c)

The results shown are based on your DSC parsing.

#### LibraryClasses Auto completion
Start typing on the `LibraryClasses` section will show suggestions of libraries that can be included in that INF file:

![Auto complete](https://github.com/intel/Edk2Code/assets/62723455/4fb165cf-9f0a-4903-b14c-12bf05dd374e)

This suggestions are based on DEC files in `Packages` section.

#### Goto DSC Declaration
Right click on an anywhere in an INF file and select `EDK2: Goto DSC Declaration`

![Go to DSC](https://github.com/intel/Edk2Code/assets/62723455/933014af-6f40-4349-9606-93030a4fe359)

This will open the DSC file where this INF file was declared.

#### Library usage
If the INF file is a library, right click and select `EDK2: Show Library usage`:

![image](https://github.com/intel/Edk2Code/assets/62723455/92a1543d-00a8-4ba7-b63a-799f523aae4d)

This will show what modules are using your library:

![Library usage](https://github.com/intel/Edk2Code/assets/62723455/9019f46a-b6ad-49d4-bec8-e7cd3d3ed133)

### DSC Files

#### Syntax highlight
[See](https://github.com/intel/Edk2Code/wiki/Functionality#inf-files-will-show-syntax-highlight)

#### Outline
[See](https://github.com/intel/Edk2Code/wiki/Functionality#outline-tree)

#### Variable defines resolution
DSC files will dim source that hasn't been compiled based on DEFINES.
You can see the value of the defines if you hover your mouse over.

This also works with `PCD` values

![Variable resolution](https://github.com/intel/Edk2Code/assets/62723455/e0c8d40f-9ae8-404a-9ca9-d799744bf8b5)


#### Goto Definition
Right click on a file path and select `Go to Definition` (F12) to open that file.

#### Goto DSC inclusion
Right click and select `Go to DSC Inclusion` to see if this DSC file was included (`!Include`) in other DSC file.

### DEC

#### Syntax highlight
[See](https://github.com/intel/Edk2Code/wiki/Functionality#inf-files-will-show-syntax-highlight)

#### Outline
[See](https://github.com/intel/Edk2Code/wiki/Functionality#outline-tree)

### C files
#### Call Hierarchy
Right on a function name and select `Show Call Hierarchy`:

![image](https://github.com/intel/Edk2Code/assets/62723455/686a95c2-a935-47bb-a4a2-7a12b6c3366c)

This will open the References view with the [call Hierarchy](https://devblogs.microsoft.com/cppblog/c-extension-in-vs-code-1-16-release-call-hierarchy-more/) of the selected function. Edk2Code extension will filter unused calls from the view.

![image](https://github.com/intel/Edk2Code/assets/62723455/7c5ed101-5926-41cb-9107-cd2da2350e63)

#### Go to INF
When you are on a C file, Right click and select `Go to INF`:

![image](https://github.com/intel/Edk2Code/assets/62723455/79b5c67a-7514-4f9f-8f16-27dcae38ae07)

This will open the .inf file that compiled that C file.

#### Go to Definition
Right click on a C symbol (function, variable, etc) and select `EDK2: Go To Definition` to open the symbol definition. This differs from regular `Go to Definition` command provided by VSCODE as this will uses CSCOPE and compiled files to query the definitions. Sometimes it gives better results.

### VFR

#### Syntax highlight
[See](https://github.com/intel/Edk2Code/wiki/Functionality#inf-files-will-show-syntax-highlight)

#### Outline
[See](https://github.com/intel/Edk2Code/wiki/Functionality#outline-tree)

### ACPI

#### Syntax highlight
[See](https://github.com/intel/Edk2Code/wiki/Functionality#inf-files-will-show-syntax-highlight)

#### Outline
[See](https://github.com/intel/Edk2Code/wiki/Functionality#outline-tree)

#### Help
Hover on keywords of your ASL code and you will see help extracted from ACPI specification (6.3)

![image](https://github.com/intel/Edk2Code/assets/62723455/441eb15f-3f9e-47f3-acb3-4ff26f021536)

#### Auto complete
Start typing anywhere in your *.asl files and you will see autocomplete suggestions of ASL specification.

![image](https://github.com/intel/Edk2Code/assets/62723455/2569cdfc-bf32-41f0-a9ce-aebd5aba5605)

