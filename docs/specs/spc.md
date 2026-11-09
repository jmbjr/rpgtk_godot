# SPC · special move

Specification revision **1.0** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT SPLMOVE`.

After the header, read name, fight power, SMP cost, program filename,
target SMP removed, two use flags, status effect filename, effect
animation filename and description, one field per line.

The decoded record stores `name`, `fightPower`, `cost`, `program`,
`targetSpecialPower`, `storedUseFlags`, `battle`, `board`, `assets`
with `Status effect` and `Animation`, and `description`. The viewer's
editor mapping is first flag = board, second = battle. Preserve the
two stored values in their original order.

The byte-identical demo `attackall.spc` has flags `[0, 1]` and the
observed Toolkit 2 editor shows Board-Driven off and Battle-Driven on.
The later [compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonSpecialMove.bas#L101-L126)
names the slots differently. The display mapping describes the tested
editor and file, with legacy runtime semantics still unverified.
