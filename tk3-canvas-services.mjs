// Native RPGCode canvas/input services. Handles are scoped to a play session.
export const canvasLimits = Object.freeze({
  dimension: 4096,
  surfaces: 64,
  images: 64,
  keyedImages: 32,
  pixels: 16777216,
  textRecords: 2048,
});
const integer = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n))
    throw Error("A finite canvas coordinate is required.");
  return Math.trunc(n);
};
const dimensions = (w, h) => {
  const width = integer(w),
    height = integer(h);
  if (
    width < 1 ||
    height < 1 ||
    width > canvasLimits.dimension ||
    height > canvasLimits.dimension
  )
    throw Error("Canvas dimensions must be 1–4096 pixels.");
  return { width, height };
};
const keyName = (key) =>
  ({
    ESCAPE: "ESC",
    ARROWUP: "UP",
    ARROWDOWN: "DOWN",
    ARROWLEFT: "LEFT",
    ARROWRIGHT: "RIGHT",
    " ": "SPACE",
    RETURN: "ENTER",
  })[String(key).toUpperCase()] ?? String(key).toUpperCase();

export function createTk3CanvasServices({ readImage }) {
  const canvases = new Map(),
    images = new Map(),
    keyed = new Map(),
    pendingFrames = new Map();
  const keys = new Set(),
    pulses = new Set();
  let nextId = 1,
    pixels = 0,
    screen = null,
    view = null,
    board = null,
    destroyed = false,
    revision = 0;
  let program = null,
    epoch = null,
    painted = 0,
    listeners = null;
  const mouse = { x: 0, y: 0, left: 0, right: 0 };
  function allocate(width, height, alpha = false) {
    const size = dimensions(width, height);
    if (pixels + size.width * size.height > canvasLimits.pixels)
      throw Error("Canvas pixel storage budget exceeded.");
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { alpha, willReadFrequently: true });
    if (!ctx) throw Error("A 2D canvas is required for RPGCode graphics.");
    pixels += canvas.width * canvas.height;
    ctx.imageSmoothingEnabled = false;
    if (!alpha) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { canvas, ctx, texts: [] };
  }
  function release(surface) {
    pixels -= surface.canvas.width * surface.canvas.height;
    surface.canvas.width = surface.canvas.height = 0;
  }
  function current() {
    if (!screen) throw Error("The RPGCode display is unavailable.");
    return screen;
  }
  function target(id) {
    if (id === undefined) return current();
    const value = canvases.get(integer(id));
    if (!value) throw Error("Canvas handle is unavailable: " + id);
    return value;
  }
  function removeText(surface, x, y, w, h) {
    surface.texts = surface.texts.filter(
      (t) => t.x < x || t.y < y || t.x >= x + w || t.y >= y + h,
    );
  }
  function recordText(surface, text) {
    surface.texts = surface.texts.filter(
      (t) => t.x !== text.x || t.y !== text.y,
    );
    if (surface.texts.length >= canvasLimits.textRecords) surface.texts.shift();
    surface.texts.push(text);
  }
  function text(surface, item) {
    surface.ctx.font =
      (item.bold ? "bold " : "") + item.fontSize + "px Arial, sans-serif";
    surface.ctx.textBaseline = "top";
    surface.ctx.fillStyle = "rgb(" + item.color.join(",") + ")";
    surface.ctx.fillText(item.text, item.x, item.y);
    recordText(surface, item);
  }
  function setSurface(display, boardCanvas) {
    if (destroyed) throw Error("Play session was closed.");
    view = display;
    board = boardCanvas;
    if (
      !screen ||
      screen.canvas.width !== display.width ||
      screen.canvas.height !== display.height
    ) {
      if (screen) release(screen);
      screen = allocate(display.width, display.height);
      program = null;
    }
    if (listeners) return;
    listeners = new AbortController();
    const options = { signal: listeners.signal, capture: true };
    const editable = (e) =>
      /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? "") ||
      e.target?.isContentEditable;
    document.addEventListener(
      "keydown",
      (e) => {
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !editable(e))
          keys.add(keyName(e.key));
      },
      options,
    );
    document.addEventListener(
      "keyup",
      (e) => keys.delete(keyName(e.key)),
      options,
    );
    const clear = () => {
      keys.clear();
      pulses.clear();
      mouse.left = mouse.right = 0;
    };
    window.addEventListener("blur", clear, options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) clear();
      },
      options,
    );
    const position = (e) => {
      if (!view || !view.contains(e.target)) return false;
      const bounds = view.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return false;
      mouse.x = Math.max(
        0,
        Math.min(
          view.width - 1,
          Math.floor(((e.clientX - bounds.left) * view.width) / bounds.width),
        ),
      );
      mouse.y = Math.max(
        0,
        Math.min(
          view.height - 1,
          Math.floor(((e.clientY - bounds.top) * view.height) / bounds.height),
        ),
      );
      return true;
    };
    document.addEventListener(
      "pointermove",
      (e) => {
        position(e);
      },
      options,
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!position(e)) return;
        if (e.button === 0) mouse.left = 1;
        if (e.button === 2) mouse.right = 1;
        if (e.pointerType === "touch") {
          e.preventDefault();
          view.setPointerCapture(e.pointerId);
        }
      },
      options,
    );
    const up = (e) => {
      if (e.button === 0 || e.type === "pointercancel") mouse.left = 0;
      if (e.button === 2 || e.type === "pointercancel") mouse.right = 0;
    };
    document.addEventListener("pointerup", up, options);
    document.addEventListener("pointercancel", up, options);
    document.addEventListener(
      "contextmenu",
      (e) => {
        if (view?.contains(e.target)) e.preventDefault();
      },
      options,
    );
  }
  function sync(state) {
    if (!screen || !state) return;
    if (program !== state.programId) {
      program = state.programId;
      epoch = state.paintEpoch;
      painted = 0;
      screen.texts = [];
      screen.ctx.fillStyle = "black";
      screen.ctx.fillRect(0, 0, screen.canvas.width, screen.canvas.height);
      if (!state.cleared && board)
        screen.ctx.drawImage(
          board,
          0,
          0,
          screen.canvas.width,
          screen.canvas.height,
        );
      revision++;
    } else if (epoch !== state.paintEpoch) {
      epoch = state.paintEpoch;
      painted = 0;
      screen.texts = [];
      screen.ctx.fillStyle = "black";
      screen.ctx.fillRect(0, 0, screen.canvas.width, screen.canvas.height);
      revision++;
    }
    for (const item of (state.texts ?? []).slice(painted)) {
      text(screen, item);
      revision++;
    }
    painted = state.texts?.length ?? 0;
  }
  async function image(file) {
    if (images.has(file)) return images.get(file);
    if (images.size >= canvasLimits.images)
      throw Error("Decoded image budget exceeded.");
    const source = await readImage(file);
    if (destroyed) {
      source.close?.();
      throw Error("Play session was closed.");
    }
    const size = dimensions(source.width, source.height);
    if (pixels + size.width * size.height > canvasLimits.pixels) {
      source.close?.();
      throw Error("Canvas pixel storage budget exceeded.");
    }
    pixels += size.width * size.height;
    images.set(file, source);
    return source;
  }
  function frame() {
    return new Promise((resolve, reject) => {
      const id = requestAnimationFrame(() => {
        pendingFrames.delete(id);
        if (destroyed) reject(Error("Play session was closed."));
        else resolve();
      });
      pendingFrames.set(id, reject);
    });
  }
  return {
    setSurface,
    sync,
    get revision() {
      return revision;
    },
    get texts() {
      return screen?.texts ?? [];
    },
    get stats() {
      return {
        canvases: canvases.size,
        images: images.size,
        pixels,
        pendingFrames: pendingFrames.size,
      };
    },
    paint(ctx) {
      if (screen) ctx.drawImage(screen.canvas, 0, 0);
    },
    pressKey(key) {
      pulses.add(keyName(key));
    },
    async apply(effect) {
      if (destroyed) throw Error("Play session was closed.");
      const {
        name,
        args: a,
        style = { fontSize: 20, bold: false, color: [255, 255, 255] },
      } = effect;
      let output = { value: 0, outputs: [] },
        dest = null;
      if (name === "createcanvas") {
        if (canvases.size >= canvasLimits.surfaces)
          throw Error("Canvas handle budget exceeded.");
        const surface = allocate(a[0], a[1]),
          id = nextId++;
        canvases.set(id, surface);
        output.value = id;
        if (a.length === 3) output.outputs = [{ index: 2, value: id }];
        return output;
      }
      if (name === "killcanvas") {
        const surface = target(a[0]);
        release(surface);
        canvases.delete(integer(a[0]));
        return output;
      }
      if (name === "mousestatus") {
        const kind = integer(a[0]);
        if (kind < 0 || kind > 3)
          throw Error("MouseStatus supports selectors 0–3.");
        output.value = [mouse.x, mouse.y, mouse.left, mouse.right][kind];
        return output;
      }
      if (name === "keydown") {
        const names = a.map(keyName);
        output.value = Number(
          names.every(
            (key) =>
              keys.has(key) ||
              pulses.has(key) ||
              (key === "\x01" && mouse.left) ||
              (key === "\x02" && mouse.right),
          ),
        );
        if (output.value) for (const key of names) pulses.delete(key);
        return output;
      }
      if (name === "getpixel") {
        const surface = target(a[5]),
          x = integer(a[0]),
          y = integer(a[1]);
        if (
          x < 0 ||
          y < 0 ||
          x >= surface.canvas.width ||
          y >= surface.canvas.height
        )
          throw Error("GetPixel coordinates are outside the canvas.");
        const pixel = surface.ctx.getImageData(x, y, 1, 1).data;
        output.outputs = [0, 1, 2].map((i) => ({
          index: i + 2,
          value: pixel[i],
        }));
        return output;
      }
      if (name === "clear") {
        dest = target(a[0]);
        dest.ctx.fillStyle = "black";
        dest.ctx.fillRect(0, 0, dest.canvas.width, dest.canvas.height);
        dest.texts = [];
      } else if (name === "text" || name === "pixeltext") {
        dest = target(a[3]);
        const factor = name === "text" ? style.fontSize : 1,
          subtract = name === "text" ? style.fontSize : 0;
        text(dest, {
          ...style,
          x: integer(a[0] * factor - subtract),
          y: integer(a[1] * factor - subtract),
          text: String(a[2] ?? ""),
        });
      } else if (name === "fillrect" || name === "setpixel") {
        dest = target(name === "fillrect" ? a[4] : a[2]);
        dest.ctx.fillStyle = "rgb(" + style.color.join(",") + ")";
        const x = integer(a[0]),
          y = integer(a[1]);
        const width = name === "fillrect" ? integer(a[2]) - x : 1,
          height = name === "fillrect" ? integer(a[3]) - y : 1;
        dest.ctx.fillRect(x, y, width, height);
        removeText(dest, x, y, width, height);
      } else if (name === "setimage" || name === "setimagetransparent") {
        const transparent = name === "setimagetransparent";
        dest = target(transparent ? a[8] : a[5]);
        const source = await image(String(a[0])),
          size = dimensions(a[3], a[4]);
        const x = integer(a[1]),
          y = integer(a[2]);
        let drawn = source;
        if (transparent) {
          const key = [a[0], size.width, size.height, ...a.slice(5, 8)].join(
            "|",
          );
          if (!keyed.has(key)) {
            if (keyed.size >= canvasLimits.keyedImages)
              throw Error("Transparent image cache budget exceeded.");
            const intermediate = allocate(size.width, size.height, true);
            intermediate.ctx.drawImage(source, 0, 0, size.width, size.height);
            const pixels = intermediate.ctx.getImageData(
              0,
              0,
              size.width,
              size.height,
            );
            const keyColor = a.slice(5, 8).map(integer);
            for (let i = 0; i < pixels.data.length; i += 4)
              if (keyColor.every((v, c) => pixels.data[i + c] === v))
                pixels.data[i + 3] = 0;
            intermediate.ctx.putImageData(pixels, 0, 0);
            keyed.set(key, intermediate);
          }
          drawn = keyed.get(key).canvas;
        }
        dest.ctx.drawImage(drawn, x, y, size.width, size.height);
        removeText(dest, x, y, size.width, size.height);
      } else if (name === "drawcanvas") {
        const source = target(a[0]);
        dest = target(a[5]);
        const x = integer(a[1]),
          y = integer(a[2]);
        const size = a.length >= 5 ? dimensions(a[3], a[4]) : source.canvas;
        dest.ctx.drawImage(source.canvas, x, y, size.width, size.height);
        removeText(dest, x, y, size.width, size.height);
        for (const item of [...source.texts])
          recordText(dest, {
            ...item,
            x: x + (item.x * size.width) / source.canvas.width,
            y: y + (item.y * size.height) / source.canvas.height,
          });
      } else throw Error("Unsupported canvas service: " + name);
      if (dest === screen) {
        revision++;
        output.presented = true;
        // A displayed frame yields to real browser input. Pure loops and
        // service-only loops retain their instruction budgets.
        await frame();
        output.frameYielded = true;
      }
      return output;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners?.abort();
      for (const [id, reject] of pendingFrames) {
        cancelAnimationFrame(id);
        reject(Error("Play session was closed."));
      }
      pendingFrames.clear();
      for (const surface of canvases.values()) release(surface);
      canvases.clear();
      for (const source of images.values()) {
        pixels -= source.width * source.height;
        source.close?.();
      }
      images.clear();
      for (const surface of keyed.values()) release(surface);
      keyed.clear();
      if (screen) release(screen);
      screen = null;
      keys.clear();
      pulses.clear();
    },
  };
}
