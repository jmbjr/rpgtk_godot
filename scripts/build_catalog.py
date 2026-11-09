"""Build the browser command index from the reviewed baseline and optional REF files."""

import argparse
import json
import re
from pathlib import Path

CATEGORY_FEATURE = {
    "Control": "SCR-03",
    "Display": "SCR-08",
    "Fight": "BAT-09",
    "Info": "SCR-06",
    "Input": "SCR-07",
    "Items": "ITM-05",
    "Player": "EVT-06",
    "Text": "SCR-07",
    "Variable Manipulation": "SCR-03",
}
FEATURE_COMMANDS = {
    "PRJ-05": "parallax",
    "SCR-03": "if while for branch fbranch",
    "SCR-04": "include method returnmethod redirect killredirect killallredirects run",
    "SCR-06": "getres getboardtile getboardtiletype getcorner",
    "SCR-07": "fontsize bold color wingraphic mouseclick checkbutton setbutton italics text colorrgb wait",
    "SCR-08": "bordercolor fade clear bitmap drawline animatedtiles",
    "SCR-09": "mediaplay mediarest dos godos wav wavstop start midiplay midirest mp3 mp3pause playavi playavismall",
    "SCR-10": "dirsav load save end over win reset mainfile",
    "EVT-05": "mwin mwincls prompt",
    "EVT-06": "itemwalkspeed walkspeed characterspeed smartstep pathfind itemstep playerstep",
    "MAP-05": "send",
    "BAT-02": "fight fightenemy",
    "BAT-09": "attackall drainall sourcehandle targethandle sourcelocation targetlocation",
    "ACT-04": "giveexp",
}
OVERRIDES = {command: feature for feature, names in FEATURE_COMMANDS.items() for command in names.split()}
COMMAND_ROW = re.compile(r"^\| `#(\w+)` \| (.+?) \| (.+?) \| (.+?) \|$", re.M)
REF_ENTRY = re.compile(r"^:COMMAND\n(#(\w+)[^\n]*)\n:DESCR$", re.M)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("baseline", type=Path)
parser.add_argument("references", type=Path, nargs="*", help="Optional REF sources in version order")
parser.add_argument("--output", type=Path, default=Path("catalog.json"))
args = parser.parse_args()

baseline = args.baseline.read_text(encoding="utf-8")
features = dict(re.findall(r"^\| ([A-Z]+-\d+) (.+?) \|", baseline, re.M))
signatures = {}
for reference in args.references:
    for signature, name in REF_ENTRY.findall(reference.read_text(encoding="cp1252")):
        signatures[name.lower()] = signature.strip()

catalog = {}
for name, summary, sources, category in COMMAND_ROW.findall(baseline):
    key = name.lower()
    feature = OVERRIDES.get(key, CATEGORY_FEATURE.get(category, "SCR-01"))
    catalog[key] = {
        "name": name,
        "summary": summary,
        "signature": signatures.get(key),
        "sources": sources.split(", "),
        "feature": feature,
        "featureTitle": features[feature],
    }
if not catalog:
    parser.error("No command rows were found in the baseline.")
args.output.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
