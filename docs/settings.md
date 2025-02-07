## EDK2Code Settings

In Visual Studio Code, settings allow you to customize various aspects of the editor to suit your workflow and preferences. These settings can be configured globally or at the workspace level, providing flexibility in how you manage your development environment.

### Accessing EDK2Code Extension Settings

1. Open the Command Palette by pressing F1 or Ctrl + Shift + P.
2. Type Preferences: Open Settings (UI) and select it.
3. In the search bar at the top, type `intel-corporation.edk2code` to filter the settings specific to the EDK2Code extension.
4. Browse through the filtered settings to customize the extension according to your preferences.

### Edk2Code Settings

#### `edk2code.logLevel`
- **Type**: `string`
- **Default**: `None`
- **Description**: Debug log level
- **Options**:
  - `None`
  - `Error`
  - `Warning`
  - `Info`
  - `Verbose`
  - `Debug`

#### `edk2code.generateIgnoreFile`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Generate `.ignore` file. This file reduces the scope of files consumed by VS Code commands such as `search` or `open file`.

#### `edk2code.delayToRefreshWorkspace`
- **Type**: `number`
- **Default**: `5000`
- **Description**: Delay to refresh the EDK2 workspace after a file change, in milliseconds.

#### `edk2code.warningAboutCppExtension`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show warning about the need for the C++ extension.

#### `edk2code.enableDiagnostics`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Experimental diagnostics for EDK2. It will show EDK2 errors in the VS Code Problem window.

#### `edk2code.useEdkCallHierarchy`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Use EDK2 call hierarchy (cscope) instead of VS Code's native one. (Requires reload of VS Code after setup)

#### `edk2code.ExpandCircularOrDuplicateLibraries`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Expand circular include or duplicated libraries in the Edk2 Map view.

#### `edk2code.cscopeOverwritePath`
- **Type**: `string`
- **Default**: ``
- **Description**: Overwrites the path to the cscope executable. (Requires reload of VS Code after setup)

#### `edk2code.extraIgnorePatterns`
- **Type**: `array`
- **Default**: 
  - `*.log`
  - `.ignore`
  - `.gitignore`
  - `.edkCode/**/*`
- **Description**: Patterns to append to the `.ignore` file.
- **Items**:
  - **Type**: `string`
