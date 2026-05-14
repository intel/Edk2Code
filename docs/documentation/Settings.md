# Extension settings

### Edk2code: Log Level

Used to debug the extension development. Its recommended to keep on None unless you are debugging the Edk2Code extension.

----

### Edk2code: Generate Ignore File

Generates `.ignore` file as part of [source index process](https://github.com/intel/Edk2Code/wiki/Index-source-code)

----

### Edk2code: Use Cscope

Enable or disable cscope integration. When disabled, the cscope database will not be built or queried, and features that depend on it (call hierarchy, cscope-based `Go to definition`) will be unavailable.

A reload of VS Code is required after changing this setting.

----

### Edk2code: Mcp Server Port

Port number used by the MCP SSE server started with `EDK2: Start MCP SSE Server`.

Default: `3100`.

----

### Edk2code: Cscope Overwrite Path

Overwrites the path used to invoke the `cscope` executable. Leave empty to use the one available on `PATH`.

A reload of VS Code is required after changing this setting.

----
