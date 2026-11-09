"""Bind a downloaded TTS save to the local assets bundled with it."""
import argparse
import json
from pathlib import Path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("save", type=Path, help="Path to tile-cards.tts.json in the extracted build")
    parser.add_argument("destination", type=Path, help="Output .json file in your TTS Saves folder")
    args = parser.parse_args()
    save = json.loads(args.save.read_text(encoding="utf-8"))
    for card in save["ObjectStates"]:
        for deck in card["CustomDeck"].values():
            for field in ("FaceURL", "BackURL"):
                relative = Path(deck[field])
                if relative.parent != Path("assets") or relative.suffix != ".png":
                    parser.error(f"Expected a bundled PNG path, got {relative}")
                asset = (args.save.parent / relative).resolve(strict=True)
                deck[field] = str(asset)
    with args.destination.open("x", encoding="utf-8") as output:
        json.dump(save, output, indent=2)
        output.write("\n")
