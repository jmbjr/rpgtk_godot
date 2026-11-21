import { resolveAsset } from "./model.mjs";

export function boardEntryBinding(board, artifacts, projectRoot) {
  const value = board.entryProgram ?? "";
  const found = resolveAsset(artifacts, "Prg", value, projectRoot);
  return { owner:board.path, slot:null, role:"Board entry program", value,
    path:found.path ?? null, line:1, status:found.status,
    ...(found.candidates ? {candidates:found.candidates} : {}) };
}

export function boardTaskBindings(scene, artifacts) {
  const board=artifacts.get(scene.boardPath), root=scene.projectRoot;
  const binding=(value,owner,role,slot,entitySlot=null) => ({value,owner,role,slot,entitySlot,line:1,
    ...resolveAsset(artifacts,"Prg",value,root)});
  const tasks=(board.threads ?? []).flatMap((file,slot)=>file && !/^none$/i.test(file) ?
    [binding(file,board.path,"Board thread",slot)] : []);
  for(const sprite of board.sprites ?? []) {
    const ref=resolveAsset(artifacts,"Item",sprite.filename,root), item=artifacts.get(ref.path);
    const override=sprite.multitaskProgram;
    const value=override || item?.programs?.["On-board program"];
    if(value && !/^none$/i.test(value)) tasks.push({...binding(value,override?board.path:item.path,
      override?"Native sprite multitask program":"On-board program",sprite.slot,sprite.slot),
      loadingVariable:sprite.loadingVariable, loadingValue:sprite.loadingValue});
  }
  return tasks;
}

export function exportBehaviorBindings(artifacts, inventory) {
  return [...artifacts.values()].filter(b=>b.type==="brd" && !b.error && b.entryProgram!==undefined).flatMap(board=> {
    const scene={boardPath:board.path,projectRoot:inventory.ownerOf(board.path)};
    return [boardEntryBinding(board,artifacts,scene.projectRoot),...boardTaskBindings(scene,artifacts)].map(binding=>({
      owner:binding.owner,board:board.path,slot:binding.slot,role:binding.role,value:binding.value,
      target:binding.path ?? null,line:binding.line,status:binding.status,entitySlot:binding.entitySlot ?? null,
      ...(binding.candidates?{candidates:binding.candidates}:{}),
    }));
  });
}
