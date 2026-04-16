[Defines]
  PLATFORM_NAME           = TestProcess
  PLATFORM_GUID           = 11111111-2222-3333-4444-555555555555
  PLATFORM_VERSION        = 2.0
  DSC_SPECIFICATION       = 0x00010017
  DEFINE MY_FLAG          = TRUE
  DEFINE MY_PATH          = SomePath
  DEFINE EMPTY_DEF        =

# Root-level define
DEFINE ROOT_DEF = RootValue

# Test that comments are stripped
# This line is a comment and should not appear

[SkuIds]
  0|DEFAULT

[LibraryClasses]
  BaseLib|MdePkg/Library/BaseLib/BaseLib.inf
  DebugLib|MdePkg/Library/DebugLib/DebugLib.inf

[LibraryClasses.X64]
  TimerLib|MdePkg/Library/TimerLib/TimerLib.inf

[Components]
  MdePkg/Test/ModuleA.inf
  MdePkg/Test/ModuleB.inf

[Components.X64]
  MdePkg/Test/ModuleC.inf

[PcdsFixedAtBuild]
  gTestPkg.PcdTestMask|0x2F
  gTestPkg.PcdTestLevel|0x80000040

[PcdsDynamicDefault]
  gTestPkg.PcdBootTimeout|5

[BuildOptions]
  GCC:*_*_*_CC_FLAGS = -DTEST
  MSFT:*_*_*_CC_FLAGS = /DTEST

# Conditional block test: TRUE branch taken
DEFINE COND_A = BeforeIf
!if TRUE
  DEFINE COND_TAKEN = IfTrueValue
!else
  DEFINE COND_TAKEN = IfFalseValue
!endif

# Conditional block test: FALSE branch -> else taken
!if FALSE
  DEFINE COND_FALSE_IF = ShouldNotExist
!else
  DEFINE COND_ELSE = ElseValue
!endif

# Nested conditional
!if TRUE
  DEFINE OUTER_TRUE = OuterOk
  !if FALSE
    DEFINE INNER_FALSE = ShouldNotExist
  !else
    DEFINE INNER_ELSE = InnerElseOk
  !endif
!endif

# !ifdef test
DEFINE EXISTING_VAR = Exists
!ifdef EXISTING_VAR
  DEFINE IFDEF_TAKEN = yes
!endif

# !ifndef test on undefined variable
!ifndef TOTALLY_UNDEFINED_XYZ
  DEFINE IFNDEF_TAKEN = yes
!endif

# Define with variable reference
DEFINE BASE = Hello
DEFINE DERIVED = $(BASE)World

# PCD in string value
  gTestPkg.PcdStringVal|L"TestString"
