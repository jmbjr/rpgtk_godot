# STE · status effect

Specification revision **1.0** · [conventions](README.md). Text 2.0 and binary 2.2,
signature `RPGTLKIT STATUSE`.

| Order | Field | Binary type and interpretation |
| --- | --- | --- |
| 1 | Name | zstr |
| 2 | Rounds | i16, zero means until end of fight |
| 3 | Speed charge, slow charge, disable | Three i16 flags |
| 4 | Remove HP, HP amount | i16 flag and signed i16 amount |
| 5 | Remove SMP, SMP amount | i16 flag and signed i16 amount |
| 6 | Run RPGCode, program | i16 flag and zstr filename |

The text header contains the signature, major 2, and minor 0 on separate
lines. Read the same fields in the same order, one per line. Trim field
whitespace and interpret blank numeric fields as zero. A blank program
line represents an empty slot.

Positive amounts remove HP/SMP and negative amounts restore them.
Effects apply per round according to Toolkit 2 Help. Retain the amounts
and program filename even if their flags are disabled. A nonempty program
filename creates a reference.

Decoded fields are `version` (minor), `name`, `rounds`, `speed`,
`slow`, `disable`, `removeHp`, `hpAmount`, `removeSmp`, `smpAmount`,
`runProgram` and `program`.

Evidence includes the six text 2.0 DustBall status effects, the binary
editor fixture `test_status_eff.ste`, Toolkit
2 Help's Status Effects section, and the pinned
[compatibility reader and writer](https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonStatusEffect.bas#L100-L152).
