# STE · status effect

Specification revision **1.0** · [conventions](README.md). Binary 2.2,
signature `RPGTLKIT STATUSE`.

| Order | Field | Type and interpretation |
| --- | --- | --- |
| 1 | Name | zstr |
| 2 | Rounds | i16, zero means until end of fight |
| 3 | Speed charge, slow charge, disable | Three i16 flags |
| 4 | Remove HP, HP amount | i16 flag and signed i16 amount |
| 5 | Remove SMP, SMP amount | i16 flag and signed i16 amount |
| 6 | Run RPGCode, program | i16 flag and zstr filename |

Positive amounts remove HP/SMP and negative amounts restore them.
Effects apply per round according to Toolkit 2 Help. Retain the amounts
and program filename even if their flags are disabled. A nonempty program
filename creates a reference.

Decoded fields are `version` (minor), `name`, `rounds`, `speed`,
`slow`, `disable`, `removeHp`, `hpAmount`, `removeSmp`, `smpAmount`,
`runProgram` and `program`. The older text profile is outside the
current decoder.

Evidence includes the binary editor fixture `test_status_eff.ste`, Toolkit
2 Help's Status Effects section, and the pinned
[compatibility reader and writer](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonStatusEffect.bas).
