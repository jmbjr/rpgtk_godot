// Native history stores exact stops; controls stay inside this archive's trail.
export function createInspectorHistory(history) {
  let archive, current;
  let position = 0, length = 0;
  const selectionFor = state => archive && state?.rpgtkInspector?.archive === archive &&
    Number.isInteger(state.rpgtkInspector.position) && state.rpgtkInspector.position >= 0 &&
    state.rpgtkInspector.position < length ? state.rpgtkInspector.selection : undefined;
  const write = (method, selection) => history[method]({
    ...history.state, rpgtkInspector: { archive, selection, position },
  }, "");
  const canBack = () => Boolean(selectionFor(history.state)) && position > 0;
  const canForward = () => Boolean(selectionFor(history.state)) && position < length - 1;
  return {
    get canBack() { return canBack(); },
    get canForward() { return canForward(); },
    back() { if (canBack()) history.back(); },
    forward() { if (canForward()) history.forward(); },
    reset(archiveId, selection) {
      archive = archiveId; current = selection; position = 0; length = 1;
      write("replaceState", selection);
    },
    replace(selection) {
      if (!archive) return;
      current = selection;
      write("replaceState", selection);
    },
    visit(selection) {
      if (!archive || ["path", "folder", "tile", "line", "inlineSlot"].every(key => selection[key] === current[key])) return;
      // Back can reveal an older ZIP. Seed that position before branching
      // so the next selection still has a safe return stop.
      if (!selectionFor(history.state)) write("replaceState", current);
      position++; length = position + 1;
      write("pushState", selection); current = selection;
    },
    restore(state) {
      const selection = selectionFor(state);
      if (selection) { current = selection; position = state.rpgtkInspector.position; }
      return selection;
    },
  };
}
