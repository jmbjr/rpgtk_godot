import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve, relative, dirname, join} from 'node:path';
import {createHash} from 'node:crypto';
import {validatePlan} from '../planning/planner.mjs';
const root=resolve('.'), site=resolve(process.argv[2] || 'site');
const registry=JSON.parse(await readFile('docs/planning/index.json','utf8'));
const sourcePath=(base,path) => {
  const absolute=resolve(base,path), rel=relative(root,absolute);
  if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||/^\w+:/.test(path))throw Error('Planning source escapes repository.');
  return absolute;
};
const outputPath=path => join(site,'docs/planning/records',relative(root,path));
async function copy(path) {const out=outputPath(path);await mkdir(dirname(out),{recursive:true});await copyFile(path,out);}
for(const entry of registry.projects) {
  const path=sourcePath(resolve('docs/planning'),entry.path), manifest=JSON.parse(await readFile(path,'utf8'));
  const plan={};
  for(const [key,ref] of Object.entries(manifest.records)) {
    const recordPath=sourcePath(dirname(path),ref.path), bytes=await readFile(recordPath);
    if(createHash('sha256').update(bytes).digest('hex')!==ref.sha256)throw Error(`Stale manifest digest: ${key}`);
    const record=JSON.parse(bytes);
    if(record.id!==ref.id||(key==='project'?record.planningRevision:record.revision)!==ref.revision)throw Error(`Stale manifest revision: ${key}`);
    plan[key]=record;await copy(recordPath);
    if(key==='intake'&&record.narrativePath)await copy(sourcePath(dirname(recordPath),record.narrativePath));
  }
  validatePlan(plan);await copy(path);
  entry.path='./records/'+relative(root,path).replaceAll('\\','/');
}
await mkdir(join(site,'docs/planning'),{recursive:true});
await writeFile(join(site,'docs/planning/index.json'),JSON.stringify(registry,null,2)+'\n');
await mkdir(join(site,'planning'),{recursive:true});
for(const name of ['index.html','director.css','director.mjs','load-plan.mjs','planner.mjs'])await copyFile(join(root,'planning',name),join(site,'planning',name));
console.log('Staged generic director runtime and validated inert planning records; source topology and exact bytes preserved.');
