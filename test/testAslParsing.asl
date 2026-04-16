// Corner-case ASL file for parser tests.

DefinitionBlock ("test.aml", "DSDT", 2, "TEST", "TESTDSDT", 0x00000001)
{
    External (\_SB.PCI0, DeviceObj)
    External (\_SB.PCI0.LPCB, DeviceObj)

    Scope (\_SB)
    {
        Name (TVAR, 0x1234)

        Device (TPM0)
        {
            Name (_HID, "MSFT0101")
            Name (_STR, Unicode("TPM 2.0 Device"))

            OperationRegion (TPMR, SystemMemory, 0xFED40000, 0x5000)
            Field (TPMR, AnyAcc, NoLock, Preserve)
            {
                ACC0, 8,
            }

            Method (_STA, 0, Serialized)
            {
                Return (0x0F)
            }

            Method (_CRS, 0, Serialized)
            {
                Name (RBUF, ResourceTemplate ()
                {
                    Memory32Fixed (ReadWrite, 0xFED40000, 0x5000)
                })
                Return (RBUF)
            }
        }

        Device (EC0)
        {
            Name (_HID, "PNP0C09")

            OperationRegion (ECOR, EmbeddedControl, 0x00, 0xFF)
            Field (ECOR, ByteAcc, Lock, Preserve)
            {
                TEMP, 8,
                FAN0, 8,
            }

            Method (RFAN, 0, NotSerialized)
            {
                Return (FAN0)
            }
        }
    }

    Scope (\_SB.PCI0)
    {
        Name (PVAR, "PCI")
    }
}
