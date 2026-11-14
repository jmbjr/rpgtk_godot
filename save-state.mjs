// Read-only Toolkit 3.1 SAV binary 3.4 state record.
// Field order and widths are taken from the pinned native trans3 state.cpp.
// No gameplay, script threads, or save reconstruction is executed.
const text = new TextDecoder("windows-1252");

function reader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  const remaining = () => bytes.length - cursor;
  const requireBytes = count => {
    if (count < 0 || count > remaining()) throw new Error("Truncated Toolkit 3 save state.");
  };
  const numbers = {
    i16() { requireBytes(2); const n = view.getInt16(cursor, true); cursor += 2; return n; },
    i32() { requireBytes(4); const n = view.getInt32(cursor, true); cursor += 4; return n; },
    f64() {
      requireBytes(8);
      const n = view.getFloat64(cursor, true); cursor += 8;
      if (!Number.isFinite(n)) throw new Error("Non-finite Toolkit 3 saved number.");
      return n;
    },
    string() {
      const end = bytes.indexOf(0, cursor);
      if (end === -1) throw new Error("Unterminated Toolkit 3 save string.");
      if (end - cursor > 1_000_000) throw new Error("Implausibly long Toolkit 3 save string.");
      const value = text.decode(bytes.subarray(cursor, end));
      cursor = end + 1;
      return value;
    },
    remaining,
    count(label, max, minimumBytes = 1) {
      const count = numbers.i32();
      if (count < 0 || count > max || count * minimumBytes > remaining())
        throw new Error("Invalid Toolkit 3 save " + label + " count.");
      return count;
    },
  };
  return numbers;
}

const fileName = name => name.replaceAll("\\", "/").split("/").at(-1);
const nonempty = name => name && name.toLowerCase() !== "none";
export function readSaveState(bytes) {
  const r = reader(bytes);
  if (r.string() !== "RPGTLKIT SAVE" || r.i16() !== 3 || r.i16() !== 4) {
    throw new Error("Only native RPGTLKIT SAVE binary 3.4 is supported.");
  }
  const refs = [];
  const add = (name, evidence) => {
    if (nonempty(name)) refs.push({ value: fileName(name), evidence });
  };
  const readGlobals = (label, literal) =>
    Array.from({ length: r.count(label, 100_000, literal ? 2 : 9) }, () => ({
      name: r.string(), value: literal ? r.string() : r.f64(),
    }));
  const globals = {
    numeric: readGlobals("numeric global", false),
    objects: readGlobals("object global", false),
    literals: readGlobals("literal global", true),
    redirects: readGlobals("redirect", true),
  };

  const playerCount = r.count("party", 64, 2);
  const party = Array.from({ length: playerCount }, (_, slot) => {
    const name = r.string();
    const filename = r.string();
    add(filename, "Saved party member · slot " + slot);
    return { slot, name, filename };
  });
  const inventoryCount = r.i16();
  if (inventoryCount < 0 || inventoryCount > 5000 ||
      inventoryCount * 6 > r.remaining()) throw new Error("Invalid save inventory count.");
  const inventory = Array.from({ length: inventoryCount }, (_, slot) => {
    const filename = r.string();
    const handle = r.string();
    const quantity = r.i32();
    add(filename, "Saved inventory · slot " + slot);
    return { slot, filename, handle, quantity };
  });
  // Equipment is always sixteen 1-based slots per saved player.
  const equipment = [];
  for (let slot = 1; slot <= 16; slot++) for (let player = 0; player < playerCount; player++) {
    const filename = r.string(), handle = r.string();
    add(filename, "Saved equipment · player " + player + " slot " + slot);
    equipment.push({ player, slot, filename, handle });
  }
  const equipmentModifiers = Array.from({ length: playerCount }, (_, player) => ({
    player, hp: r.i32(), specialPower: r.i32(), defense: r.i32(), fight: r.i32(),
  }));
  const misc = {
    menuColor: r.i32(),
    selectedPlayer: r.i32(),
    gold: r.i32(),
    messageWindowColor: r.i32(),
    messageWindowBackground: r.string(),
    debug: r.i32(),
    fontColor: r.i32(),
    fontFace: r.string(),
    fontSize: r.i32(),
    bold: r.i32(),
    underline: r.i32(),
    italic: r.i32(),
    gameTimeSeconds: r.i32(),
    stepsTakenTiles: r.i32(),
    mainFile: r.string(),
    board: r.string(),
  };
  add(misc.messageWindowBackground, "Saved message-window background");
  add(misc.mainFile, "Saved Main File");
  add(misc.board, "Saved current board");

  const positions = Array.from({ length: playerCount }, (_, player) => ({
    player,
    x: r.f64(), y: r.f64(), layer: r.i32(), active: r.i32(),
    boardPath: { vectorIndex: r.i32(), cycles: r.i32(),
      nextNode: r.i32(), attributes: r.i32() },
  }));
  const levelProgress = Array.from({ length: playerCount }, (_, player) => ({
    player, nextLevel: r.i32(), progression: r.i32(),
  }));
  const formerPlayers = Array.from({ length: 26 }, (_, slot) => {
    const filename = r.string(), handle = r.string();
    add(filename, "Former player · slot " + slot);
    return { slot, filename, handle };
  });
  const presentation = {
    menuGraphic: r.string(), fightMenuGraphic: r.string(),
    messageWindowWidth: r.i32(), swappedPlayerName: r.string(),
  };
  add(presentation.menuGraphic, "Saved menu graphic");
  add(presentation.fightMenuGraphic, "Saved fight menu graphic");

  // All board items, including empty slots. Native C++ stores the
  // activate/activationType fields as i16, unlike the i32 path fields.
  const worldItems = Array.from({ length: r.count("world item", 20_000) }, (_, slot) => {
    const filename = r.string();
    if (!filename) return { slot, filename };
    const activationProgram = r.string(), multitaskProgram = r.string();
    const initialVariable = r.string(), initialValue = r.string();
    const finalVariable = r.string(), finalValue = r.string();
    const activate = r.i16(), activationType = r.i16();
    const position = { x: r.f64(), y: r.f64(), layer: r.i32() };
    const active = r.i32();
    const boardPath = { vectorIndex: r.i32(), cycles: r.i32(),
      nextNode: r.i32(), attributes: r.i32() };
    add(filename, "Saved board item · slot " + slot);
    add(activationProgram, "Saved item activation program · slot " + slot);
    add(multitaskProgram, "Saved item multitask program · slot " + slot);
    return { slot, filename, activationProgram, multitaskProgram,
      initialVariable, initialValue, finalVariable, finalValue,
      activate, activationType, position, active, boardPath };
  });

  // Threads are saved with an inclusive maximum index, unlike the
  // other count-prefixed arrays. The native reconstructState() consumes
  // a separate nested program state for populated thread filenames.
  const maxThread = r.i32();
  if (maxThread < -1 || maxThread > 10_000 || maxThread + 1 > r.remaining())
    throw new Error("Invalid save thread maximum index.");
  const threads = [];
  for (let slot = 0; slot <= maxThread; slot++) {
    const filename = r.string();
    const persistent = r.i32();
    const isItemThread = persistent ? r.i32() : 0;
    const itemSlot = isItemThread ? r.i32() : null;
    const sleeping = r.i32(), duration = r.f64();
    add(filename, "Saved RPGCode thread · slot " + slot);
    threads.push({ slot, filename, persistent, isItemThread, itemSlot, sleeping, duration });
    if (filename) {
      // Never guess at an active CProgram frame/stack format. Preserve the
      // known prefix and explicitly mark remaining bytes unparsed.
      return { globals, party, inventory, equipment, equipmentModifiers, misc,
        positions, levelProgress, formerPlayers, presentation, worldItems, threads,
        completion: "active-thread-state-unparsed", unparsedTailBytes: r.remaining(), refs };
    }
  }
  const movementSize = r.f64();
  const objectClasses = Array.from({ length: r.count("object class", 100_000, 5) },
    (_, slot) => ({ slot, index: r.i32(), className: r.string() }));
  const loopOffset = r.i32();
  if (r.remaining()) throw new Error("Unexpected trailing Toolkit 3 SAV 3.4 bytes.");
  return {
    globals, party, inventory, equipment, equipmentModifiers, misc, positions,
    levelProgress, formerPlayers, presentation, worldItems, threads,
    movementSize, objectClasses, loopOffset, completion: "complete",
    unparsedTailBytes: 0, refs,
  };
}
