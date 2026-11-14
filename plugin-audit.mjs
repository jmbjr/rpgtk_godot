import { mainFileBindings } from "./model.mjs";

// Cross-reference configured GAM filenames against packaged DLL entries.
// This is an archive inventory, not a plugin loader or a capability oracle.
export function auditProjectPlugins(artifacts, mainFile = null) {
  const paths = [...artifacts.keys()];
  const bindings = mainFile ? mainFileBindings(mainFile, paths) : [];
  const descriptions = new Map(bindings);
  const declarations = [];
  const config = mainFile?.configuration;
  if (config) {
    const add = (role, slot, filename, evidence) => {
      if (!filename || filename.toLowerCase() === "none") return;
      const binding = descriptions.get(evidence);
      declarations.push({
        role, slot, filename, evidence,
        status: binding?.status ?? "missing",
        path: binding?.path ?? null,
      });
    };
    add("menu", null, config.menuPlugin, "Menu system plugin");
    add("fight", null, config.fightPlugin, "Fight system plugin");
    for (const slot of config.pluginSlots)
      add("slot", slot.slot, slot.filename, "Declared plugin · slot " + slot.slot);
  }
  const bundled = paths.filter(path => /\.dll$/i.test(path)).sort()
    .map(path => {
      const declaredAs = declarations.filter(item => item.path === path)
        .map(item => item.evidence);
      return {
        path, filename: path.split("/").at(-1),
        declaredAs,
        pe: artifacts.get(path)?.pe ?? null,
      };
    });
  return {
    mainFile: mainFile?.filename ?? mainFile?.path ?? null,
    declarationScope: config ? "configured" : "unavailable",
    storedSlots: config?.pluginSlots.length ?? 0,
    declarations, bundled,
    summary: {
      declared: declarations.length, bundled: bundled.length,
      undeclaredBundled: bundled.filter(item => !item.declaredAs.length).length,
      unresolvedDeclarations: declarations.filter(item => item.status !== "resolved").length,
      comExportCandidates: bundled.filter(item => item.pe?.interfaceEvidence?.comRegistrationExports).length,
      legacyExportCandidates: bundled.filter(item => item.pe?.interfaceEvidence?.legacyTKPlugInitExport).length,
    },
    limitations: [
      "GAM declarations and PE export tables do not establish actual plugin activation or runtime reachability.",
      "DllRegisterServer/DllGetClassObject are COM entrypoint evidence, not proof of available RPGCode methods or successful registration.",
      "No DLL, COM server, plugin callback or game executable is loaded, registered or executed.",
    ],
  };
}
