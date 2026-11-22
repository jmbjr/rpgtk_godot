import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import JSZip from "../vendor/jszip.min.js";
import {buildBrowserGame} from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";

const baseline="e392e99f10754e9ad2612e76243f23753713161f";
const site=resolve(process.argv[2] ?? "site"), output=resolve(process.argv[3] ?? "dist/selected-asset-review");
await mkdir(output,{recursive:true});
const before=new Map(["index.html","style.css","app.mjs"].map(path=>[path,execFileSync("git",["show",baseline+":"+path])]));
const server=createServer(async(req,res)=>{
  let path=decodeURIComponent(new URL(req.url,"http://localhost").pathname),old=path.startsWith('/__before__/');
  if(old)path=path.slice('/__before__'.length);if(path==='/')path='/index.html';
  const file=resolve(site,'.'+path);
  try{if(!file.startsWith(site+sep))throw Error('Outside site');const bytes=old&&before.has(path.slice(1))?before.get(path.slice(1)):await readFile(file);
    res.writeHead(200,{'Content-Type':({html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',json:'application/json'})[path.split('.').at(-1)]??'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const legacy=await JSZip.loadAsync(await readFile(resolve(site,'tk2-legacy-game.zip')));
legacy.file('Game/TK2LegacyLab/Prg/inspection.prg','#Wav("tone.wav")\n#Wav("absent.wav")\n#Wav(soundName)\n#Wav("shared.wav")');
const shared=await legacy.file('Game/TK2LegacyLab/Media/tone.wav').async('nodebuffer');
legacy.file('Game/TK2LegacyLab/Media/shared.wav',shared);
legacy.file('Game/TK2LegacyLab/media/SHARED.wav',shared);
legacy.file('Game/TK2LegacyLab/Other/unknown.xyz','No decoder is claimed for this file.');
legacy.file('Game/TK2LegacyLab/Boards/unsupported.brd','RPGTLKIT BOARD\n9\n9\n');
const tk2=await legacy.generateAsync({type:'nodebuffer'}),tk3=await buildBrowserGame('harbor',{nativeEncounters:true});
const inputs=[{name:'selected-tk2.zip',bytes:tk2,board:'Game/TK2LegacyLab/Boards/room.brd',sound:'Game/TK2LegacyLab/Media/tone.wav',probe:'Game/TK2LegacyLab/Prg/inspection.prg',line:1,missing:'absent.wav'},
  {name:'selected-tk3.zip',bytes:tk3,board:'HarborLab/Boards/wharf.brd',sound:'HarborLab/Media/tick.wav',probe:'HarborLab/Prg/media_probe.prg',line:2,missing:'unavailable.wav'}];
const report={baseline,head:process.env.REVIEW_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),desktop:{width:1365,height:960},mobile:{width:390,height:844},inputs:[],results:[],screenshots:[]};
for(const input of inputs){await writeFile(resolve(output,input.name),input.bytes);report.inputs.push({name:input.name,bytes:input.bytes.length,sha256:createHash('sha256').update(input.bytes).digest('hex'),construction:input===inputs[0]?'Staged TK2 legacy generator plus source-reference, ambiguous-case and unsupported-file probes':'Native TK3 browser fixture generator, nativeEncounters:true'});}
let browser,page;const errors=[];const watchdog=setTimeout(()=>{console.error('Selected-asset browser timeout');process.exit(1);},120000);watchdog.unref();
try{
 browser=await chromium.launch({executablePath:process.env.TK3_CHROMIUM||undefined});report.browserVersion=browser.version();
 page=await browser.newPage({viewport:report.desktop});page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const shot=async name=>{
   // Let viewport/focus-driven layout finish painting before preserving evidence.
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   await page.screenshot({path:resolve(output,name),animations:'disabled'});report.screenshots.push(name);
 };
 const pathIs=async path=>page.locator('#source-path').filter({hasText:path}).waitFor();
 const file=async path=>{
   const folder=path.slice(0,path.lastIndexOf('/')+1);await page.locator(`#folder-list button[data-folder="${folder}"]`).click();
   await page.locator('#file-list button').filter({hasText:path.split('/').at(-1)}).click();await pathIs(path);};
 const upload=async input=>{await page.locator('#archive').setInputFiles({name:input.name,mimeType:'application/zip',buffer:input.bytes});await page.locator('#opened-archive').filter({hasText:input.name}).waitFor();};
 const clear=async()=>{const control=page.getByRole('button',{name:'Clear filters',exact:true});if(await control.isEnabled())await control.click();};
 const inspect=async label=>{
   for(;;){for(const node of await page.locator('#connections .connection-node').all()){
     await node.click();const evidence=page.locator('.connection-preview .edge-list').filter({hasText:label});if(await evidence.count())return evidence;
   }let more=false;for(const control of await page.locator('#connections .connection-more').filter({hasText:/^Show more/}).all())if(await control.isVisible()){await control.click();more=true;}
   if(!more)throw Error('No evidence '+label);}
 };
 // Actual baseline build, same exact archives/viewport/selection; no mockups.
 await page.goto(base+'/__before__/');await upload(inputs[0]);await file(inputs[0].board);await page.locator('#source canvas').first().waitFor();
 await page.locator('#workspace').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('before-board-desktop.png');
 await file('Game/TK2LegacyLab/Tiles/lab.tst');await page.locator('#graph [data-tile="3"]').click();await page.locator('#workspace').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('before-tiles-desktop.png');
 await page.setViewportSize(report.mobile);await page.locator('#file-title').scrollIntoViewIfNeeded();await shot('before-tiles-mobile.png');
 await page.setViewportSize(report.desktop);await page.goto(base);
 for(const input of inputs){
   await upload(input);await file(input.board);await page.locator('#source canvas').first().waitFor();
   assert.equal(await page.locator('#asset-kind').textContent(),'Board');assert.equal(await page.locator('#asset-name').innerText(),input.board.split('/').at(-1));
   assert.equal(await page.locator('#connections details.connection-map').count(),0);
   await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot(input===inputs[0]?'after-board-desktop.png':'after-native-board-desktop.png');
   // Export actual connected JSON, then follow the exact same board/tile fact in UI.
   if(!await page.locator('#archive-export').evaluate(e=>e.open))await page.locator('#archive-export > summary').click();
   const [downloaded]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download connected game JSON',exact:true}).click()]);
   const exported=JSON.parse(await readFile(await downloaded.path(),'utf8'));
   const record=Object.values(exported.artifacts).find(a=>a.path===input.board);const tileEdge=record.references.outgoing.find(e=>e.target?.tileIndex);
   assert.ok(tileEdge);const tile=tileEdge.target.tileIndex;
   const evidence=await inspect(tileEdge.evidence);await evidence.getByRole('button',{name:new RegExp(tileEdge.evidence.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
   assert.equal(await page.locator(`#graph [data-tile="${tile}"]`).getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#selection').innerText(),new RegExp('Tile '+tile));
   assert.equal(await page.locator(`#graph [data-tile="${tile}"]`).evaluate(e=>e===document.activeElement),true);
   await inspect(tileEdge.evidence);assert.match(await page.locator('.connection-preview').innerText(),new RegExp(input.board.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));if(input===inputs[0])await shot('after-tiles-desktop.png');
   await page.goBack();await pathIs(input.board);await page.goForward();await page.locator(`#graph [data-tile="${tile}"][aria-pressed="true"]`).waitFor();
   await file(input.sound);await clear();await page.getByRole('button',{name:'Play WAV',exact:true}).waitFor();
   const sound=Object.values(exported.artifacts).find(a=>a.path===input.sound);const call=sound.references.incoming.find(e=>e.line===input.line);assert.ok(call);
   const caller=await inspect(new RegExp('line '+input.line));await caller.getByRole('button').filter({hasText:new RegExp('line '+input.line)}).first().press('Enter');
   await pathIs(input.probe);await page.locator(`#source #line-${input.line}.active-line`).waitFor();
   assert.equal(await page.locator(`#line-${input.line}`).evaluate(e=>e===document.activeElement),true);
   await page.goBack();await pathIs(input.sound);await page.goForward();await page.locator(`#line-${input.line}.active-line`).waitFor();
   await clear();await page.getByLabel('Resolution',{exact:true}).selectOption('missing');await inspect(input.missing);
   assert.match(await page.locator('.connection-preview').innerText(),/No matching target was found/);
   const missing=Object.values(exported.artifacts).find(a=>a.path===input.probe).references.outgoing.find(e=>e.status==='missing');assert.equal(missing.value,input.missing);
   await page.locator('.connection-preview').scrollIntoViewIfNeeded();if(input===inputs[1])await shot('after-missing-desktop.png');
   await page.getByRole('button',{name:'View reference in source',exact:true}).click();await page.locator(`#line-${missing.line}.active-line`).waitFor();
   await page.getByLabel('Resolution',{exact:true}).selectOption('dynamic');await inspect(input===inputs[0]?'soundName':'sfxName');assert.match(await page.locator('.connection-preview').innerText(),/computed by the program/);
   if(input===inputs[0]){
     await page.getByLabel('Resolution',{exact:true}).selectOption('ambiguous');await inspect('shared.wav');
     assert.match(await page.locator('.connection-preview').innerText(),/More than one file/);
     const ambiguous=Object.values(exported.artifacts).find(a=>a.path===input.probe).references.outgoing.find(e=>e.status==='ambiguous');
     const candidates=page.locator('.connection-preview').getByRole('button').filter({hasText:/^Inspect candidate/});assert.equal(await candidates.count(),ambiguous.candidates.length);
     await candidates.first().click();await pathIs(ambiguous.candidates[0]);await page.goBack();await pathIs(input.probe);
   }
   if(input===inputs[1]){await page.getByLabel('Resolution',{exact:true}).selectOption('unindexed');await inspect('not-indexed.wav');assert.match(await page.locator('.connection-preview').innerText(),/does not establish that the file is missing/);}
   await clear();
   // The existing command catalog highlights legacy # syntax; native bare calls
   // remain source text with exact static-reference navigation in Connections.
   if(input===inputs[0]){
     await page.locator(`#source #line-${input.line} button`).first().press('Enter');
     assert.equal(await page.locator('#reference').evaluate(e=>e===document.activeElement),true);
     await page.locator('#reference').getByRole('button',{name:'Line '+input.line,exact:true}).click();await page.locator(`#line-${input.line}.active-line`).waitFor();
   }
   await page.getByRole('button',{name:'Technical details',exact:true}).press('Enter');assert.equal(await page.locator('#technical-title').evaluate(e=>e===document.activeElement),true);
   await page.locator('#asset-record summary').press('Enter');await page.getByLabel('Decoded artifact JSON',{exact:true}).filter({hasText:input.probe}).waitFor();
   await page.getByRole('button',{name:'Preview or source',exact:true}).press('Enter');assert.equal(await page.locator('#file-title').evaluate(e=>e===document.activeElement),true);
   report.results.push(input.name+': normal upload; board → exact numbered tile → incoming board use; connected JSON agreement; WAV → calling PRG/source line; Back/Forward; missing/dynamic evidence and source focus; section keyboard navigation; lazy decoded JSON passed.');
 }
 await page.setViewportSize(report.mobile);await file(inputs[1].board);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Board controls fit mobile');
 await file('HarborLab/Media/tick.wav');await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('after-audio-mobile.png');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-wide mobile overflow');
 await page.getByRole('button',{name:'Connections',exact:true}).press('Enter');assert.equal(await page.locator('#connections').evaluate(e=>e===document.activeElement),true);
 await inspect(/line 2/);await page.locator('.connection-preview .edge-list button').first().press('Enter');await page.locator('#line-2.active-line').waitFor();
 await page.setViewportSize(report.desktop);await upload(inputs[0]);await file('Game/TK2LegacyLab/Other/unknown.xyz');assert.match(await page.locator('#asset-support').innerText(),/No decoder or preview/);
 await file('Game/TK2LegacyLab/Boards/unsupported.brd');assert.match(await page.locator('#asset-support').innerText(),/could not be decoded|not verified as supported/);assert.ok((await page.locator('#asset-metadata').innerText()).length);
 await file('Game/TK2LegacyLab/Tiles/lab.tst');await page.locator('#graph [data-tile="3"]').click();await page.setViewportSize(report.mobile);await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('after-tiles-mobile.png');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);report.results.push('390px: no page-wide overflow, identity/preview/control access and exact caller navigation. Unsupported/unidentified records retain explanations and diagnostics. No page errors.');
 console.log('Selected-asset staged browser passed:',report.results.join('\n'));
}catch(error){report.failure={message:error.message,url:page?.url()};if(page)await page.screenshot({path:resolve(output,'failure.png')});throw error;
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.close(()=>clearTimeout(watchdog));}
