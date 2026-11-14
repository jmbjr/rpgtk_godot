// Native Toolkit 3 binary BRD 2.4 records following the light/vector blocks.
// Field order: pinned 3.1 CommonBoard.bas (the >2.3 vector-board branch).
// This reads data only; it does not execute programs or simulate activation.
export function readNativeBoardTail(reader, layers) {
  // All counts are signed, inclusive maximum indices; -1 is no records.
  const maximum = (label, limit, minimumBytes = 0) => {
    const value = reader.short();
    if (value < -1 || value > limit ||
        (value + 1) * minimumBytes > reader.remaining()) {
      throw new Error("Invalid native board " + label + " maximum index.");
    }
    return value + 1;
  };
  const refs = [];
  const add = (value, evidence, position) => {
    if (value && value.toLowerCase() !== "none") {
      refs.push({ value, evidence, ...(position ? { position } : {}) });
    }
  };
  const points = label => Array.from(
    { length: maximum(label + " point", 4095, 8) },
    () => ({ x: reader.long(), y: reader.long() }),
  );
  const nativePrograms = Array.from(
    { length: maximum("program", 2000, 19) }, (_, slot) => {
      const filename = reader.string();
      const graphic = reader.string();
      const initialVariable = reader.string();
      const initialValue = reader.string();
      const finalVariable = reader.string();
      const finalValue = reader.string();
      const activate = reader.short();
      const activationType = reader.short();
      const distanceRepeat = reader.short();
      const layer = reader.short();
      const basePoints = points("program vector");
      const closed = reader.short();
      const handle = reader.string();
      const position = basePoints[0] ? { ...basePoints[0], layer } : undefined;
      add(filename, "Native board program · slot " + slot, position);
      add(graphic, "Native program graphic · slot " + slot, position);
      return {
        slot, filename, graphic, initialVariable, initialValue,
        finalVariable, finalValue, activate, activationType,
        distanceRepeat, layer, vectorBase: { points: basePoints, closed, handle },
      };
    });
  const sprites = Array.from({ length: maximum("sprite", 4000, 21) }, (_, slot) => {
    const filename = reader.string();
    const activationProgram = reader.string();
    const multitaskProgram = reader.string();
    const initialVariable = reader.string();
    const initialValue = reader.string();
    const finalVariable = reader.string();
    const finalValue = reader.string();
    const loadingVariable = reader.string();
    const loadingValue = reader.string();
    const activate = reader.short();
    const activationType = reader.short();
    const position = { x: reader.short(), y: reader.short(), layer: reader.short() };
    const associatedVector = reader.short(); // Native waypoint index, often -1.
    add(filename, "Native board sprite · slot " + slot, position);
    add(activationProgram, "Native sprite activation program · slot " + slot, position);
    add(multitaskProgram, "Native sprite multitask program · slot " + slot, position);
    return {
      slot, filename, activationProgram, multitaskProgram,
      initialVariable, initialValue, finalVariable, finalValue,
      loadingVariable, loadingValue, activate, activationType,
      position, associatedVector,
    };
  });
  const images = Array.from({ length: maximum("image", 4000, 19) }, (_, slot) => {
    const filename = reader.string();
    const position = { x: reader.long(), y: reader.long() };
    const layer = reader.short();
    const drawType = reader.short();
    const transparentColor = reader.long();
    const translucencyReserved = reader.short();
    add(filename, "Native board image · slot " + slot, { ...position, layer });
    return { slot, filename, position, layer, drawType, transparentColor, translucencyReserved };
  });
  const threads = Array.from({ length: maximum("thread", 4000, 1) },
    (_, slot) => {
      const filename = reader.string();
      add(filename, "Board thread · slot " + slot);
      return filename;
    });
  const constants = Array.from({ length: maximum("constant", 4000, 1) },
    () => reader.string());
  // The source saves sizeL + 1 entries, including layer index 0.
  const storedLayerTitles = Array.from({ length: layers + 1 }, () => reader.string());
  // Keep the existing nine-entry board inspector convention as a view.
  const layerTitles = Array.from({ length: 9 }, (_, i) =>
    storedLayerTitles[i] || (i ? "Layer " + i : ""));
  const directionalLinks = ["North", "South", "East", "West"].map(direction => {
    const filename = reader.string();
    add(filename, direction + " board link");
    return { direction, filename };
  });
  const backgroundImage = reader.string();
  const backgroundDrawType = reader.long();
  const background = reader.long();
  const boardMusic = reader.string();
  add(backgroundImage, "Board background image");
  add(boardMusic, "Board music");
  const entryProgram = reader.string();
  const battleBackground = reader.string();
  add(entryProgram, "Board entry program");
  add(battleBackground, "Battle background");
  const battleSkill = reader.short();
  const allowBattles = reader.short();
  const saveDisabled = reader.short();
  const ambient = [reader.short(), reader.short(), reader.short()];
  const start = { x: reader.short(), y: reader.short(), layer: reader.short() };
  if (reader.remaining()) throw new Error("Unexpected native BRD 2.4 trailing bytes.");
  return {
    nativePrograms, sprites, images, threads, constants,
    storedLayerTitles, layerTitles, directionalLinks,
    backgroundImage, backgroundDrawType, background, boardMusic,
    entryProgram, battleBackground, battleSkill, allowBattles,
    saveDisabled, ambient, start, refs,
  };
}
