const sceneId = "tile-review";
const cardArchetype = "toolkit-tile-card";

export function projectTileCards(catalog, tilesetPath, sidecarDigest) {
  const match = Object.entries(catalog.objects).find(([, object]) =>
    object.kind === "collection" && object.name === tilesetPath);
  if (!match || !match[1].members.length) throw new Error("Choose a tileset with at least one tile.");
  const [collectionId, collection] = match;
  const cards = collection.members.map(({ object_ref: id }) => [
    id, { ...catalog.objects[id], archetype_ref: cardArchetype },
  ]);
  const source = catalog.sources.toolkit;
  return {
    dodge_version: catalog.dodge_version,
    document_id: "toolkit-tile-card-review",
    game_id: catalog.game_id,
    sources: { toolkit: { ...source, sha256: sidecarDigest } },
    sidecars: catalog.sidecars,
    archetypes: {
      [cardArchetype]: {
        ...catalog.archetypes["toolkit-tile"],
        component: {
          form: "card", shape: "rectangle",
          dimensions: { unit: "in", width: 2.5, height: 3.5 },
        },
      },
      "toolkit-tileset": catalog.archetypes["toolkit-tileset"],
    },
    objects: { [collectionId]: collection, ...Object.fromEntries(cards) },
    scenes: {
      [sceneId]: {
        name: "Toolkit tileset reference display",
        instances: [{ id: "tileset-cards", object_ref: collectionId }],
      },
    },
  };
}

export function orderedTileCards(scene, tileBindings) {
  const [instance] = scene.scenes[sceneId].instances;
  const collection = scene.objects[instance.object_ref];
  const bindings = new Map(tileBindings.map(binding => [binding.objectId, binding]));
  return collection.members.map(({ object_ref: id }) => {
    const { tileNumber } = bindings.get(id);
    const { dimensions } = scene.archetypes[scene.objects[id].archetype_ref].component;
    return { tileNumber, dimensions };
  });
}
