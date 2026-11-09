"""Resolve and export the two-tile Toolkit fixture as tabletop reference cards."""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from pypdf.generic import ContentStream
import reportlab
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

HERE = Path(__file__).resolve().parent
DODGE_REV = "9af5804719bc4dc421d1cd76d3587f5b678d3f81"
SCHEMA_HASHES = {
    "dodge": "270da57228139022d265082cad4d708aff1ba16a710d641a4f2144c7402a2ca9",
    "dodge-export-contract": "3e0159ce8ab4cf2f6f820c799364cf466b951afe4bf33ab0bbb6c82a7acb41f6",
    "dodge-target-manifest": "2e5e8c9fa4a93aab39e4301da692e84fdbd0247cc6dd65d6f1a1576468643e40",
}
VERSION = "0.2.1"
SCENE = "tile-review"
INSTANCE = "tileset-cards"
CARD_ARCHETYPE = "toolkit-tile-card"
TARGETS = ("pnp", "tts")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, document):
    path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def validate(schemas, name, document):
    path = schemas / f"{name}.schema.v{VERSION}.json"
    require(sha(path) == SCHEMA_HASHES[name], f"Use the pinned DODGE schema for {name}")
    Draft202012Validator(read(path)).validate(document)


def trace(kind, ref, path):
    return {"kind": kind, "ref": ref, "path": path}


def entry(content_id, source, provenance, quantity, component=None, parent=None):
    row = {
        "content_id": content_id, "source": source, "provenance": provenance,
        "canonical_quantity": quantity, "resolved_quantity": quantity,
        "inclusion": "included-inherited",
        "diagnostics": [
            {"field": "inclusion", "status": "inherited", "classification": "canonical",
             "canonical": True, "effective": True},
            {"field": "quantity", "status": "derived", "classification": "canonical",
             "canonical": quantity, "effective": quantity},
        ],
    }
    if parent:
        row["parent_content_id"] = parent
    if component:
        row.update(component_inherited=component, component_effective=component)
    return row


def project(catalog, sidecar_digest):
    # This scene describes a reference display, separate from the legacy game catalog.
    [(collection_id, collection)] = [
        (key, obj) for key, obj in catalog["objects"].items() if obj["kind"] == "collection"
    ]
    members = [member["object_ref"] for member in collection["members"]]
    require(collection["ordering"] == "declared" and "behaviors" not in collection,
            "Reference cards require the original declared order without gameplay behaviors")
    require(len(members) == len(set(members)) == 2, "Expected two distinct fixture tiles")
    tile_archetype = catalog["archetypes"]["toolkit-tile"]
    return {
        "dodge_version": VERSION, "document_id": "toolkit-tile-card-review",
        "game_id": catalog["game_id"],
        "sources": {"toolkit": {**catalog["sources"]["toolkit"], "sha256": sidecar_digest}},
        "sidecars": catalog["sidecars"],
        "archetypes": {
            CARD_ARCHETYPE: {**tile_archetype, "component": {
                "form": "card", "shape": "rectangle",
                "dimensions": {"unit": "in", "width": 2.5, "height": 3.5},
            }},
            "toolkit-tileset": catalog["archetypes"]["toolkit-tileset"],
        },
        "objects": {
            collection_id: collection,
            **{key: {**catalog["objects"][key], "archetype_ref": CARD_ARCHETYPE} for key in members},
        },
        "scenes": {SCENE: {"name": "Toolkit tileset reference display", "instances": [
            {"id": INSTANCE, "object_ref": collection_id},
        ]}},
    }


def resolve(dodge, sidecar):
    """Validate the fixture's supported DODGE subset and resolve its ordered inventory."""
    [instance] = dodge["scenes"][SCENE]["instances"]
    collection_id = instance["object_ref"]
    collection = dodge["objects"][collection_id]
    require(collection["kind"] == dodge["archetypes"][collection["archetype_ref"]]["kind"] == "collection",
            "Invalid tileset collection archetype")
    require(instance.get("quantity", 1) == 1, "Expected one display copy of the collection")
    parent = f"scene/{SCENE}/instance/{instance['id']}"
    scene_path = f"/scenes/{SCENE}"
    instance_path = f"{scene_path}/instances/0"
    collection_path = f"/objects/{collection_id}"
    parent_trace = [
        trace("dodge-document", dodge["document_id"], "/"),
        trace("scene", SCENE, scene_path),
        trace("instance", instance["id"], instance_path),
        trace("object", collection_id, collection_path),
        trace("archetype", collection["archetype_ref"], f"/archetypes/{collection['archetype_ref']}"),
    ]
    contents = [entry(parent, trace("scene-instance", instance["id"], instance_path), parent_trace, 1)]
    bindings = {binding["objectId"]: binding for binding in sidecar["tileBindings"]}
    require(len(bindings) == len(sidecar["tileBindings"]), "Duplicate source binding")
    cards = {}
    for index, member in enumerate(collection["members"]):
        key = member["object_ref"]
        obj = dodge["objects"][key]
        archetype_id = obj["archetype_ref"]
        archetype = dodge["archetypes"][archetype_id]
        require(obj["kind"] == archetype["kind"] == "token" and obj["source_ref"] in dodge["sources"],
                f"Invalid card or source: {key}")
        require([face["slot"] for face in obj["faces"]] == [slot["id"] for slot in archetype["face_slots"]],
                f"Invalid card face slots: {key}")
        component = archetype["component"]
        require(component["form"] == "card" and component["shape"] == "rectangle"
                and component["dimensions"]["unit"] == "in", f"Unsupported card dimensions: {key}")
        binding = bindings[key]
        record_id, fragment = binding["toolkitRef"].split("#", 1)
        record = sidecar["records"][record_id]
        tile_number = index + 1
        require(record["format"] == "tst" and record["path"] == collection["name"]
                and binding["tileNumber"] == tile_number and fragment == f"/data/tiles/{index}",
                f"Card order or provenance differs from the source: {key}")
        data = record["data"]
        tile = data["tiles"][index]
        require(tile["number"] == tile_number and data["encoding"] == "base64 RGB24, column-major",
                f"Unsupported source tile data: {key}")
        pixels = base64.b64decode(tile["rgb"], validate=True)
        require(len(pixels) == data["width"] * data["height"] * 3, f"Invalid RGB length: {key}")
        require(member.get("quantity", 1) == 1, "Each reference card must occur once")
        member_path = f"{collection_path}/members/{index}"
        content_id = f"{parent}/member/{index}"
        contents.append(entry(content_id, trace("collection-member", key, member_path), parent_trace + [
            trace("collection-member", str(index), member_path),
            trace("object", key, f"/objects/{key}"),
            trace("archetype", archetype_id, f"/archetypes/{archetype_id}"),
        ], 1, component, parent))
        cards[key] = {
            "title": f"Tile {tile_number:02}", "source_name": Path(record["path"]).name,
            "toolkit_ref": binding["toolkitRef"], "tile_number": tile_number,
            "image": Image.frombytes("RGB", (data["height"], data["width"]), pixels)
                          .transpose(Image.Transpose.TRANSPOSE),
            "transparent_rgb": tuple(data["transparentRgb"]),
        }
    [placement] = sidecar["boardPlacements"]
    second = contents[2]["source"]["ref"]
    require(placement["status"] == "resolved" and placement["objectId"] == second
            and placement["toolkitRef"] == cards[second]["toolkit_ref"],
            "The fixture board must resolve to the same second tile")
    return contents, cards


def make_manifest(target, dodge, document_hash, contents, schemas, out):
    contract_path = HERE / f"{target}.dodge-export.json"
    contract = read(contract_path)
    validate(schemas, "dodge-export-contract", contract)
    (out / contract_path.name).write_bytes(contract_path.read_bytes())
    capabilities = contract["accepts"]
    require(contract["target"] == target and VERSION in capabilities["dodge_versions"]
            and {obj["kind"] for obj in dodge["objects"].values()} <= set(capabilities["object_kinds"])
            and {row["component_effective"]["form"] for row in contents if "component_effective" in row}
            <= set(capabilities["component_forms"]), f"Unsupported content for {target}")
    manifest = {
        "manifest_version": VERSION, "manifest_id": contract["contract_id"], "target": target,
        "dodge_identity": {
            "dodge_version": VERSION, "document_id": dodge["document_id"], "sha256": document_hash,
        },
        "contract_identity": {
            "contract_version": VERSION, "contract_id": contract["contract_id"], "sha256": sha(contract_path),
        },
        "resolution_scope": {"scene_ref": SCENE},
        "validation_evidence": {
            "core": {"profile_id": "dodge-core", "version": VERSION, "stage": "core", "status": "pass",
                     "validated_sha256": document_hash, "validator_sha256": sha(Path(__file__))},
            "required_profiles": [], "resolved_game": [],
        },
        "contents": contents,
    }
    validate(schemas, "dodge-target-manifest", manifest)
    write(out / f"{target}-manifest.json", manifest)
    return manifest


def ordered_cards(manifest, cards):
    for row in manifest["contents"]:
        if row["source"]["kind"] == "collection-member" and row["inclusion"] != "excluded-override":
            key = row["source"]["ref"]
            for _ in range(row["resolved_quantity"]):
                yield key, cards[key], row["component_effective"]["dimensions"]


def card_face(card, dimensions):
    width = round(dimensions["width"] * 252)
    height = round(dimensions["height"] * 252)
    image = Image.new("RGB", (width, height), "#fbf6e9")
    draw = ImageDraw.Draw(image)
    ink = "#1c302c"
    draw.rectangle((0, 0, width, 22), fill=ink)
    draw.text((48, 54), "RPG TOOLKIT 2  /  TILE REFERENCE", font=ImageFont.load_default(22), fill=ink)
    draw.text((48, 98), card["title"], font=ImageFont.load_default(60), fill=ink)
    tile = card["image"]
    scale = (width - 120) // max(tile.size)
    rgba = tile.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", tile.size, bytes(
        0 if pixel == card["transparent_rgb"] else 255 for pixel in tile.get_flattened_data()
    )))
    art = rgba.resize((tile.width * scale, tile.height * scale), Image.Resampling.NEAREST)
    x, y = (width - art.width) // 2, 233
    draw.rectangle((x - 5, y - 5, x + art.width + 4, y + art.height + 4), fill=ink)
    for row in range(0, art.height, 16):
        for col in range(0, art.width, 16):
            color = "#efebdf" if (row // 16 + col // 16) % 2 else "#faf7ef"
            draw.rectangle((x + col, y + row, x + min(col + 15, art.width - 1),
                            y + min(row + 15, art.height - 1)), fill=color)
    image.paste(art, (x, y), art)
    draw.text((48, height - 90), card["source_name"], font=ImageFont.load_default(30), fill=ink)
    draw.text((48, height - 48), "SYNTHETIC FIXTURE", font=ImageFont.load_default(18), fill=ink)
    return image


def print_pdf(path, manifest, cards, faces, source_sha):
    fonts = Path(reportlab.__file__).with_name("fonts")
    pdfmetrics.registerFont(TTFont("Review Sans", str(fonts / "Vera.ttf")))
    pdfmetrics.registerFont(TTFont("Review Sans Bold", str(fonts / "VeraBd.ttf")))
    page = Canvas(str(path), pagesize=letter, invariant=True)
    page.setTitle("Toolkit tile reference cards")
    page.setFillColor("#1c302c")
    page.setFont("Review Sans Bold", 22)
    page.drawString(48, 730, "Toolkit tile reference cards")
    page.setFont("Review Sans", 11)
    page.drawString(48, 706, "US Letter  /  Actual size (100%)  /  Trim at the crop marks")
    page.drawString(48, 48, f"DODGE {VERSION} draft  /  Review build {source_sha[:12]}")
    for index, (key, _, dimensions) in enumerate(ordered_cards(manifest, cards)):
        width, height = dimensions["width"] * 72, dimensions["height"] * 72
        x, y = 48 + index * (width + 24), 662 - height
        page.drawImage(ImageReader(faces[key]), x, y, width, height)
        page.setLineWidth(0.4)
        for cx, dx in ((x, -1), (x + width, 1)):
            for cy, dy in ((y, -1), (y + height, 1)):
                page.line(cx + dx * 2, cy, cx + dx * 9, cy)
                page.line(cx, cy + dy * 2, cx, cy + dy * 9)
    page.showPage()
    page.save()


def tts_save(out, manifest, cards, faces, source_sha):
    assets = out / "assets"
    assets.mkdir(exist_ok=True)
    objects = []
    for index, (key, card, _) in enumerate(ordered_cards(manifest, cards)):
        face = faces[key]
        filename = f"tile-{card['tile_number']:02}.png"
        face.save(assets / filename)
        if index == 0:
            back = Image.new("RGB", face.size, "#1c302c")
            draw = ImageDraw.Draw(back)
            draw.text((face.width // 2, face.height // 2), "TOOLKIT TILE", anchor="mm",
                      font=ImageFont.load_default(43), fill="#fbf6e9")
            back.save(assets / "card-back.png")
        deck_id = index + 10
        objects.append({
            "GUID": hashlib.sha256(key.encode()).hexdigest()[:6],
            "Name": "CardCustom", "Nickname": card["title"],
            "Description": card["toolkit_ref"], "GMNotes": key, "CardID": deck_id * 100,
            "Transform": {
                "posX": 3 * index - 1.5, "posY": 1.2, "posZ": 0,
                "rotX": 0, "rotY": 180, "rotZ": 0,
                "scaleX": 1, "scaleY": 1, "scaleZ": 1,
            },
            "CustomDeck": {str(deck_id): {
                "FaceURL": f"assets/{filename}", "BackURL": "assets/card-back.png",
                "NumWidth": 1, "NumHeight": 1, "BackIsHidden": True, "UniqueBack": False, "Type": 0,
            }},
        })
    write(out / "tile-cards.tts.json", {
        "SaveName": "Toolkit tile reference cards", "GameMode": "None",
        "Table": "Table_Rectangle", "Sky": "Sky_Forest",
        "Note": f"DODGE {VERSION} draft review build {source_sha}",
        "ObjectStates": objects,
    })


def verify(out, manifests, cards, faces):
    pnp, tts = (read(out / f"{target}-manifest.json") for target in TARGETS)
    require(pnp == manifests["pnp"] and tts == manifests["tts"], "Manifest serialization changed")
    require(all(pnp[field] == tts[field] for field in ("dodge_identity", "resolution_scope", "contents")),
            "Target manifests disagree about shared content")
    reader = PdfReader(out / "tile-cards.pdf")
    [page] = reader.pages
    require(tuple(page.mediabox) == (0, 0, *letter), "Unexpected PDF page size")
    operations = ContentStream(page.get_contents(), reader).operations
    require(sum(operator == b"l" for _, operator in operations) == 16, "Unexpected PDF crop mark count")
    image_names = [str(operands[0]).lstrip("/") for operands, operator in operations if operator == b"Do"]
    matrices = [tuple(operands) for operands, operator in operations if operator == b"cm" and operands[0] > 1]
    pdf_images = {image.name.removesuffix(".png"): image.image.convert("RGB") for image in page.images}
    save = read(out / "tile-cards.tts.json")
    objects = save["ObjectStates"]
    inventory = list(ordered_cards(pnp, cards))
    require(len(image_names) == len(matrices) == len(objects) == len(inventory), "Target card counts differ")
    require(len({obj["GUID"] for obj in objects}) == len(objects), "Duplicate TTS GUID")
    require(len({obj["CardID"] for obj in objects}) == len(objects), "Duplicate TTS CardID")
    for index, (key, card, dimensions) in enumerate(inventory):
        width, height = dimensions["width"] * 72, dimensions["height"] * 72
        x, y = 48 + index * (width + 24), 662 - height
        require(matrices[index] == (width, 0, 0, height, x, y)
                and 9 < x < x + width < letter[0] - 9 and 9 < y < y + height < letter[1] - 9,
                f"PDF card bounds or print size are incorrect: {key}")
        require(pdf_images[image_names[index]].tobytes() == faces[key].tobytes(),
                f"PDF artwork differs from source face: {key}")
        obj = objects[index]
        require(obj["Name"] == "CardCustom" and obj["GMNotes"] == key
                and obj["Nickname"] == card["title"] and obj["Description"] == card["toolkit_ref"]
                and obj["Transform"]["posX"] == 3 * index - 1.5 and obj["CardID"] % 100 == 0,
                f"TTS card identity or position differs from manifest: {key}")
        [deck] = obj["CustomDeck"].values()
        require(str(obj["CardID"] // 100) in obj["CustomDeck"] and deck["NumWidth"] == deck["NumHeight"] == 1,
                f"TTS image binding is invalid: {key}")
        with Image.open(out / deck["FaceURL"]) as face, Image.open(out / deck["BackURL"]) as back:
            require(face.size == back.size == faces[key].size and face.tobytes() == faces[key].tobytes(),
                    f"TTS artwork differs from source face: {key}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("schemas", type=Path)
    parser.add_argument("source", type=Path, help="Output directory from check.mjs")
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()
    require(re.fullmatch("[0-9a-f]{40}", args.source_sha), "Provide the full source commit SHA")
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    sidecar_path = args.source / "toolkit-sidecar.json"
    sidecar = read(sidecar_path)
    sidecar_digest = sha(sidecar_path)
    dodge = project(read(args.source / "dodge.json"), sidecar_digest)
    validate(args.schemas, "dodge", dodge)
    contents, cards = resolve(dodge, sidecar)
    document_path = out / "dodge.json"
    write(document_path, dodge)
    (out / "toolkit-sidecar.json").write_bytes(sidecar_path.read_bytes())
    document_hash = sha(document_path)
    manifests = {
        target: make_manifest(target, dodge, document_hash, contents, args.schemas, out)
        for target in TARGETS
    }
    faces = {
        key: card_face(card, dimensions)
        for key, card, dimensions in ordered_cards(manifests["pnp"], cards)
    }
    print_pdf(out / "tile-cards.pdf", manifests["pnp"], cards, faces, args.source_sha)
    tts_save(out, manifests["tts"], cards, faces, args.source_sha)
    verify(out, manifests, cards, faces)

    coverage = {}
    for record_id, record in sidecar["records"].items():
        matches = [key for key, card in cards.items() if card["toolkit_ref"].split("#")[0] == record_id]
        status = {"object_ids": matches} if matches else {"reason": {
            "brd": "board-representation-deferred",
            "gph": "standalone-graphics-out-of-scope",
        }[record["format"]]}
        coverage[record_id] = {target: status for target in TARGETS}
    write(out / "build.json", {
        "source_sha": args.source_sha, "dodge_revision": DODGE_REV,
        "dodge_sha256": document_hash, "toolkit_sidecar_sha256": sidecar_digest,
        "board_trace": sidecar["boardPlacements"][0], "coverage": coverage,
        "targets": {
            "pnp": {"manifest": "pnp-manifest.json", "pdf": "tile-cards.pdf"},
            "tts": {"manifest": "tts-manifest.json", "save": "tile-cards.tts.json",
                    "assets": {p.name: sha(p) for p in sorted((out / "assets").glob("*.png"))}},
        },
    })
    print("Verified both target manifests, two PDF card faces, crop marks, and two TTS cards and assets.")


if __name__ == "__main__":
    main()
