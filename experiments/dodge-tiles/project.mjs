const source = "toolkit";
const sidecarFile = "toolkit-sidecar.json";
export async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Project decoded Toolkit records from a single archive into a definition catalog.
export async function projectTiles(records) {
  const objects = {};
  const tileBindings = [];
  const tileByRef = new Map();

  function addTile(objectId, toolkitRef, name, tileNumber) {
    objects[objectId] = {
      kind: "token", archetype_ref: "toolkit-tile", name, source_ref: source,
      faces: [{ slot: "front", text: name }],
    };
    tileBindings.push({
      objectId, toolkitRef, ...(tileNumber === undefined ? {} : { tileNumber }),
    });
    tileByRef.set(toolkitRef, objectId);
    return { object_ref: objectId };
  }

  for (const record of records) {
    if (record.decode.status !== "decoded" || !["gph", "tst"].includes(record.format)) continue;
    const key = await sha256Text(record.$id);
    if (record.format === "gph") {
      addTile(`tile-${key}`, record.$id, record.path);
    }
    if (record.format === "tst") {
      const members = record.data.tiles.map(({ number }, index) => addTile(
        `tile-${key}-${number}`, `${record.$id}#/data/tiles/${index}`, `${record.path} · Tile ${number}`, number,
      ));
      objects[`tileset-${key}`] = {
        kind: "collection", archetype_ref: "toolkit-tileset", name: record.path,
        source_ref: source, ordering: "declared", members,
      };
    }
  }

  const boardPlacements = [];
  for (const record of records) {
    if (record.format !== "brd" || !record.data.runs) continue;
    for (const run of record.data.runs) {
      const { value, reference } = record.data.tileLookup[run.lookupIndex];
      if (!value) continue;
      const toolkitRef = reference?.target?.$ref;
      const objectId = tileByRef.get(toolkitRef);
      boardPlacements.push({
        boardRef: record.$id, ...run, value,
        status: reference?.status === "resolved" && !objectId ? "outside-pilot" : reference?.status ?? "unindexed",
        ...(toolkitRef ? { toolkitRef } : {}),
        ...(objectId ? { objectId } : {}),
      });
    }
  }

  return {
    dodge: {
      dodge_version: "0.2.1",
      document_id: "toolkit-tile-pilot",
      game_id: "toolkit-fixture",
      sources: { [source]: { kind: "sidecar", uri: sidecarFile, version: "1", authority: "reference" } },
      archetypes: {
        "toolkit-tile": {
          kind: "token", component: { form: "tile" }, face_slots: [{ id: "front", role: "front" }],
        },
        "toolkit-tileset": { kind: "collection" },
      },
      objects,
      scenes: {},
      sidecars: [{ source_ref: source, purpose: "Toolkit tile data and board references", promotion_status: "experimental" }],
    },
    sidecar: {
      schemaVersion: 1,
      records: Object.fromEntries(records.map(record => [record.$id, record])),
      tileBindings,
      boardPlacements,
    },
  };
}
