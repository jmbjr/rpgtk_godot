// Store inspector stops in the current document's native browser history.
export function createInspectorHistory(history) {
  let archive;
  let current;

  const selectionFor = state => archive && state?.rpgtkInspector?.archive === archive
    ? state.rpgtkInspector.selection : undefined;
  const write = (method, selection) => history[method]({
    ...history.state, rpgtkInspector: { archive, selection },
  }, "");

  return {
    reset(archiveId, selection) {
      archive = archiveId;
      current = selection;
      write("replaceState", selection);
    },
    replace(selection) {
      if (!archive) return;
      current = selection;
      write("replaceState", selection);
    },
    visit(selection) {
      if (!archive || ["path", "folder", "tile", "line"].every(key => selection[key] === current[key])) return;
      // An older ZIP's stop may be underneath the current inspector after Back.
      // Seed this position before branching so Back can still undo the next click.
      if (!selectionFor(history.state)) write("replaceState", current);
      write("pushState", selection);
      current = selection;
    },
    restore(state) {
      const selection = selectionFor(state);
      if (selection) current = selection;
      return selection;
    },
  };
}
