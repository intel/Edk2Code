[Defines]
  PLATFORM_NAME           = TestOperations
  PLATFORM_GUID           = 12345678-1234-1234-1234-123456789abc
  PLATFORM_VERSION        = 1.0
  DSC_SPECIFICATION       = 0x00010017

 DEFINE VAR1 = TRUE
 DEFINE VAR2 = TRUE
 DEFINE VAR3 = FALSE
 DEFINE VAR4 = TRUE
 DEFINE VAR5 = 5
 DEFINE VAR6 = 10
 DEFINE VAR7 = 15
 DEFINE VAR8 = 10
 DEFINE VAR9 = 5
 DEFINE VAR10 = 5
 DEFINE VAR11 = 10
 DEFINE VAR12 = 10
 DEFINE VAR13 = 3
 DEFINE VAR14 = 2
 DEFINE VAR15 = 5
 DEFINE VAR16 = 0
 DEFINE VAR17 = 6
 DEFINE VAR18 = 1
 DEFINE VAR19 = 6
 DEFINE VAR20 = 1
 DEFINE VAR21 = 10
 DEFINE VAR22 = 2
 DEFINE VAR23 = 0xFF
 DEFINE VAR24 = 0x00
 DEFINE VAR25 = 2
 DEFINE VAR26 = 4
 DEFINE VAR27 = 1
 DEFINE VAR29 = TRUE
 DEFINE VAR30 = FALSE
 DEFINE VAR31 = TRUE
 DEFINE VAR32 = "TEST"
 DEFINE VAR33 = TEST


[Components]
!if $(VAR33) == TEST
  # !error "VAR33 is equal to TEST"
!else
  !error "VAR33 is not equal to TEST"
!endif

!if $(VAR33) == "TEST"
  # !error "VAR33 is equal to string TEST"
!else
  !error "VAR33 is not equal to string TEST"
!endif

!if $(VAR32) == TEST
  # !error "VAR32 is equal to TEST"
!else
  !error "VAR32 is not equal to TEST"
!endif

!if $(VAR32) == "TEST"
  # !error "VAR32 is equal to string TEST"
!else
  !error "VAR32 is not equal to string TEST"
!endif

!if TEST == "TEST"
  # !error "Literal TEST is equal to string TEST"
!else
  !error "Literal TEST is not equal to string TEST"
!endif

!if "2" in "2 3 4 5"
  # !error "String '2' is found in '2 3 4 5'"
!else
  !error "String '2' is not found in '2 3 4 5'"
!endif

!if FALSE ^ 5
  # !error "Bitwise XOR between FALSE and 5 is non-zero"
!else
  !error "Bitwise XOR between FALSE and 5 is zero"
!endif

!if $(VAR13) + $(VAR14) == $(VAR15) - $(VAR16)
  # !error "Addition and subtraction result in equality"
!else
  !error "Addition and subtraction do not result in equality"
!endif

!if $(UNDEFINED_VAR) == FALSE
  # !error "UNDEFINED_VAR is equal to FALSE"
!else
  !error "UNDEFINED_VAR is not equal to FALSE"
!endif

!if $(VAR1) == $(VAR2) && $(VAR3) != $(VAR4)
  # !error "VAR1 equals VAR2 and VAR3 does not equal VAR4"
!else
  !error "VAR1 does not equal VAR2 or VAR3 equals VAR4"
!endif

!if $(VAR5) < $(VAR6) || $(VAR7) > $(VAR8)
  # !error "VAR5 is less than VAR6 or VAR7 is greater than VAR8"
!else
  !error "VAR5 is not less than VAR6 and VAR7 is not greater than VAR8"
!endif

!if $(VAR9) <= $(VAR10) && $(VAR11) >= $(VAR12)
  # !error "VAR9 is less than or equal to VAR10 and VAR11 is greater than or equal to VAR12"
!else
  !error "VAR9 is not less than or equal to VAR10 or VAR11 is not greater than or equal to VAR12"
!endif

!if $(VAR17) * $(VAR18) == $(VAR19) / $(VAR20)
  # !error "Multiplication and division result in equality"
!else
  !error "Multiplication and division do not result in equality"
!endif

!if $(VAR21) % $(VAR22) == 0
  # !error "VAR21 is divisible by VAR22"
!else
  !error "VAR21 is not divisible by VAR22"
!endif

!if ~$(VAR23) == $(VAR24)
  !error "Bitwise NOT of VAR23 equals VAR24"
!else
  # !error "Bitwise NOT of VAR23 does not equal VAR24"
!endif

!if $(VAR25) << 1 == $(VAR26) >> 1
  !error "Left shift of VAR25 equals right shift of VAR26"
!else
  # !error "Left shift of VAR25 does not equal right shift of VAR26"
!endif

!error "ALL Test Passed"