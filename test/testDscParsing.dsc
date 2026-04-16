## Corner-case DSC file used by the parser unit tests.
## Every section exercises a different parsing path.

[Defines]
  PLATFORM_NAME           = TestParsing
  PLATFORM_GUID           = AABBCCDD-1122-3344-5566-778899AABBCC
  PLATFORM_VERSION        = 0.1
  DSC_SPECIFICATION       = 0x00010017
  OUTPUT_DIRECTORY        = Build/TestParsing
  SUPPORTED_ARCHITECTURES = IA32|X64|AARCH64
  BUILD_TARGETS           = DEBUG|RELEASE
  DEFINE MY_VAR           = SomeValue
  DEFINE EMPTY_VAR        =

# Root-level define (outside any section)
DEFINE ROOT_DEFINE = OutsideSection

[SkuIds]
  0|DEFAULT

[LibraryClasses]
  BaseLib | MdePkg/Library/BaseLib/BaseLib.inf
  DebugLib|MdePkg/Library/DebugLib/DebugLib.inf
  # Library with spaces around pipe
  PrintLib  |  MdePkg/Library/PrintLib/PrintLib.inf

[LibraryClasses.X64]
  TimerLib|MdePkg/Library/TimerLib/TimerLib.inf

[Components]
  MdePkg/Test/SimpleModule.inf
  MdePkg/Test/AnotherModule.inf

[Components.X64]
  # Module with sub-sections
  MdePkg/Test/ComplexModule.inf {
    <LibraryClasses>
      BaseLib | MdePkg/Library/OverrideLib/Override.inf
    <PcdsFixedAtBuild>
      gTokenSpace.PcdFoo|0x1
    <BuildOptions>
      MSFT:*_*_*_CC_FLAGS = /DTEST
  }

  # Module without braces
  MdePkg/Test/PlainModule.inf

[PcdsFixedAtBuild]
  gEfiMdePkgTokenSpaceGuid.PcdDebugPropertyMask|0x2F
  gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x80000040

[PcdsDynamicDefault]
  gEfiMdePkgTokenSpaceGuid.PcdPlatformBootTimeOut|5

[BuildOptions]
  GCC:*_*_*_CC_FLAGS = -DMDEPKG_NDEBUG
  MSFT:*_*_*_CC_FLAGS = /DMDEPKG_NDEBUG
  # Comment inside build options

!include TestInclude.dsc.inc

/* Block comment test */
# End of file
