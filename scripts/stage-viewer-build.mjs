import {build} from "esbuild";
import {readFile,writeFile} from "node:fs/promises";
import {resolve,join,basename} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

// Root-level output preserves import.meta.url-relative media/worklet URLs.
// Bundle first-party code/chunks; leave pinned vendor modules at their paths.
const site=resolve(process.argv[2]??"site");
const tree=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const revision=process.env.REVIEW_SHA??tree;
if(!/^[a-f0-9]{40}$/.test(revision))throw Error("Expected a complete build revision");
const result=await build({entryPoints:[join(site,"app.mjs")],bundle:true,splitting:true,
  format:"esm",platform:"browser",outdir:site,entryNames:"viewer-[hash]",chunkNames:"viewer-chunk-[hash]",
  external:[join(site,"vendor","*")],metafile:true,write:true,logLevel:"silent"});
const entry=Object.entries(result.metafile.outputs).find(([,info])=>info.entryPoint===join(site,"app.mjs")||info.entryPoint?.endsWith("/app.mjs"));
if(!entry)throw Error("No viewer entry output");
const css=(await readFile(join(site,"style.css"),"utf8"))+"\n"+await readFile(join(site,"experiments/movement-sandbox/sandbox.css"),"utf8");
const cssName="viewer-"+createHash("sha256").update(css).digest("hex").slice(0,16)+".css";
await writeFile(join(site,cssName),css);
let html=await readFile(join(site,"index.html"),"utf8");
html=html.replace('href="./style.css"','href="./'+cssName+'"')
  .replace('  <link rel="stylesheet" href="./experiments/movement-sandbox/sandbox.css">\n',"")
  .replace('src="./app.mjs"','src="./'+basename(entry[0])+'"')
  .replace('<span id="build-version">Development build</span>','<a id="build-version" href="https://github.com/jmbjr/rpgtk_godot/commit/'+revision+'" title="'+revision+'">Build '+revision.slice(0,8)+"</a>");
await writeFile(join(site,"index.html"),html);
await writeFile(join(site,"viewer-build.json"),JSON.stringify({revision,integrationRevision:tree,entry:basename(entry[0]),stylesheet:cssName,outputs:Object.keys(result.metafile.outputs).map(path=>basename(path))},null,2));
console.log("Staged build "+revision+": "+basename(entry[0])+", "+cssName+"; first-party code/chunks and styles fingerprinted.");
