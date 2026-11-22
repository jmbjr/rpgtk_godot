import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chromium} from "playwright";

const baseline="ff0f2fb288c05e27b1911920d0f7b9a9d79c99f6";
const site=resolve(process.argv[2]??"site"),output=resolve(process.argv[3]??"dist/complete-journeys-review");
await mkdir(output,{recursive:true});
const oldPaths=["index.html","style.css","app.mjs","inspector-history.mjs",
  "experiments/movement-sandbox/authored-play.mjs","experiments/movement-sandbox/playtest-guidance.mjs"];
const before=new Map(oldPaths.map(path=>[path,execFileSync("git",["show",baseline+":"+path])]));
const server=createServer(async(req,res)=>{
  let path=decodeURIComponent(new URL(req.url,"http://localhost").pathname),old=path.startsWith('/__before__/');
  if(old)path=path.slice('/__before__'.length);if(path==='/')path='/index.html';
  const file=resolve(site,'.'+path);
  try{
    if(!file.startsWith(site+sep))throw Error('Outside staged site');
    const bytes=old&&before.has(path.slice(1))?before.get(path.slice(1)):await readFile(file);
    res.writeHead(200,{'Content-Type':({html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',json:'application/json'})[path.split('.').at(-1)]??'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const build=JSON.parse(await readFile(resolve(site,'viewer-build.json'),'utf8'));
const report={baseline,head:process.env.REVIEW_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build,
  verifier:'Automated Playwright journeys; implementer walkthrough recorded separately; human acceptance pending',
  viewports:{desktop:{width:1365,height:960},mobile:{width:390,height:844}},inputs:[],results:[],screenshots:[]};
const inputs=[{name:'tk2-legacy-game.zip',board:'Game/TK2LegacyLab/Boards/room.brd',native:false},
  {name:'tk3-title-harbor.zip',board:'HarborLab/Boards/wharf.brd',native:true}];
for(const input of inputs){input.bytes=await readFile(resolve(site,input.name));await writeFile(resolve(output,input.name),input.bytes);
  report.inputs.push({name:input.name,bytes:input.bytes.length,sha256:createHash('sha256').update(input.bytes).digest('hex')});}
let browser,page;const errors=[];
const watchdog=setTimeout(()=>{console.error('Complete journeys timed out');process.exit(1);},180000);watchdog.unref();
const pathIs=async path=>page.locator('#source-path').filter({hasText:path}).waitFor();
const shot=async name=>{await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await page.screenshot({path:resolve(output,name),animations:'disabled'});report.screenshots.push(name);};
const example=async input=>{
  if(!await page.locator('#example-choice').isVisible())await page.locator('#examples > summary').click();
  await page.locator('#example-choice').selectOption('./'+input.name);
  await page.locator('#open-example').press('Enter');
  await page.locator('#opened-archive').filter({hasText:input.name}).waitFor();
};
const file=async path=>{const folder=path.slice(0,path.lastIndexOf('/')+1);
  await page.locator(`#folder-list button[data-folder="${folder}"]`).click();
  await page.locator('#file-list button').filter({hasText:path.split('/').at(-1)}).click();await pathIs(path);};
const exportJSON=async shortcut=>{
  if(shortcut)await page.locator('#selection-export').press('Enter');
  else if(!await page.locator('#archive-export').evaluate(e=>e.open))await page.locator('#archive-export > summary').click();
  if(shortcut)assert.equal(await page.locator('#export-game-json').evaluate(e=>e===document.activeElement),true);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-game-json').press('Enter')]);
  return JSON.parse(await readFile(await download.path(),'utf8'));
};
const inspect=async edge=>{
  for(;;){
    for(const node of await page.locator('#connections .connection-node').all()){
      await node.press('Enter');
      const evidence=page.locator('.connection-preview .edge-list').filter({hasText:edge.evidence}).filter({hasText:edge.value});
      if(await evidence.count())return evidence;
    }
    let expanded=false;
    for(const control of await page.locator('#connections .connection-more').filter({hasText:/^Show more/}).all())
      if(await control.isVisible()){await control.click();expanded=true;}
    if(!expanded)throw Error('No evidence: '+JSON.stringify(edge));
  }
};
const follow=async edge=>{const evidence=await inspect(edge);
  const control=evidence.getByRole('button').filter({hasText:edge.evidence}).filter({hasText:edge.value}).first();
  await control.press('Enter');};
const record=(connected,path)=>Object.values(connected.artifacts).find(a=>a.path===path);
const targetPath=(connected,ref)=>Object.values(connected.artifacts).find(a=>a.$id===ref.$ref.split('#')[0])?.path;
const clear=async()=>{const control=page.getByRole('button',{name:'Clear filters',exact:true});if(await control.isEnabled())await control.press('Enter');};
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-wide viewport overflow');
try{
 browser=await chromium.launch({executablePath:process.env.TK3_CHROMIUM||undefined});report.browserVersion=browser.version();
 // An independent, fresh client observes public Pages. This is automation,
 // not owner acceptance. A deployment/cache problem is reported separately.
 page=await browser.newPage({viewport:report.viewports.desktop});page.setDefaultTimeout(12000);
 report.production={url:'https://jmbjr.github.io/rpgtk_godot/',expectedRevision:baseline};
 try{
   report.production.responses=[];
   for(const name of ['index.html','app.mjs','style.css']){
     const response=await page.request.get(report.production.url+name,{timeout:15000});const bytes=await response.body();
     const source=execFileSync('git',['show',baseline+':'+name]);
     report.production.responses.push({name,status:response.status(),sha256:createHash('sha256').update(bytes).digest('hex'),matchesBaseline:bytes.equals(source)});
   }
   await page.goto(report.production.url);await example(inputs[0]);await page.locator('#explore-artwork').click();
   report.production.assetName=await page.locator('#asset-name').innerText();
   report.production.coherentSelection=report.production.assetName==='lab.tst';
   await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('production-before-artwork.png');
 }catch(error){report.production.failure=error.message;}
 await page.close();
 // Matched baseline UI uses the exact main source, with current identical
 // synthetic inputs. Changed runtime presentation modules are overlaid too.
 page=await browser.newPage({viewport:report.viewports.desktop});page.setDefaultTimeout(8000);
 await page.goto(base+'/__before__/');await example(inputs[0]);await file(inputs[0].board);
 await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('before-board-desktop.png');
 await page.getByRole('button',{name:'Technical details',exact:true}).click();await shot('before-technical-desktop.png');
 await page.setViewportSize(report.viewports.mobile);await page.getByRole('button',{name:'Connections',exact:true}).click();await shot('before-connections-mobile.png');
 await page.setViewportSize(report.viewports.desktop);await example(inputs[1]);await page.locator('#play-gam-startup').click();
 await page.getByRole('button',{name:'Depart',exact:true}).waitFor();await page.locator('#play-stage').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('before-title-desktop.png');await page.close();
 for(const viewport of ['desktop','mobile'])for(const input of inputs){
   page=await browser.newPage({viewport:report.viewports[viewport]});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
   const requests=[];page.on('request',request=>requests.push(new URL(request.url()).pathname));
   // Deliberately retain old first-party unversioned assets in this client.
   await page.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:before.get('app.mjs')}));
   await page.route('**/style.css',route=>route.fulfill({contentType:'text/css',body:before.get('style.css')}));
   await page.goto(base);assert.equal(await page.locator('#build-version').getAttribute('title'),report.head);
   assert.ok(requests.some(path=>path.endsWith('/'+build.entry)));assert.ok(!requests.includes('/app.mjs'));
   await example(input);assert.equal(await page.locator('#selection-back').isDisabled(),true,'New archive boundary');
   const connected=await exportJSON(false);assert.equal(connected.archive.fileCount,Object.keys(connected.artifacts).length);
   await page.locator('#explore-boards').press('Enter');await pathIs(input.board);
   assert.equal(await page.locator('#asset-name').evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Tab');assert.equal(await page.locator('#selection-back').evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Tab');assert.equal(await page.locator('[data-section="file-title"]').evaluate(e=>e===document.activeElement),true,'Disabled Forward is skipped');
   await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#selection-back').evaluate(e=>e===document.activeElement),true);
   if(viewport==='desktop'&&!input.native){await page.locator('.selected-asset').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('after-board-desktop.png');}
   const board=record(connected,input.board);const tileEdge=board.references.outgoing.find(edge=>edge.target?.tileIndex);
   assert.ok(tileEdge);await follow(tileEdge);const tilePath=targetPath(connected,tileEdge.target),tile=tileEdge.target.tileIndex;
   await pathIs(tilePath);await page.locator(`#graph [data-tile="${tile}"][aria-pressed="true"]`).waitFor();
   assert.match(await page.locator('#selection-context').innerText(),new RegExp('Tile '+tile));
   if(viewport==='desktop'&&!input.native){
     const [pdf]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download print-and-play PDF',exact:true}).press('Enter')]);
     const bytes=await readFile(await pdf.path());assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.ok(bytes.length>1000);
     report.pdf={name:pdf.suggestedFilename(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
   }
   assert.ok(await page.locator('#file-list').evaluate(list=>{const row=list.querySelector('[aria-pressed="true"]'),a=row.getBoundingClientRect(),b=list.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1;}),'Selected row revealed inside list');
   await inspect(tileEdge);assert.equal(await page.locator('.connection-preview').evaluate(e=>e===document.activeElement),true);
   await page.getByRole('button',{name:'Back to connection list',exact:true}).press('Enter');assert.equal(await page.locator('.connection-node[aria-pressed="true"]').evaluate(e=>e===document.activeElement),true);
   await follow(tileEdge);await pathIs(input.board);
   await page.locator('#selection-back').press('Enter');await pathIs(tilePath);await page.locator(`#graph [data-tile="${tile}"][aria-pressed="true"]`).waitFor();
   await page.locator('#selection-forward').press('Enter');await pathIs(input.board);
   // Jumping between sections is not another selection/history stop.
   const historyLength=await page.evaluate(()=>history.length);
   await page.getByRole('button',{name:'Archive actions',exact:true}).press('Enter');assert.equal(await page.locator('#archive-heading').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.evaluate(()=>history.length),historyLength,'Section jump adds no history stop');
   await page.locator('#explore-audio').press('Enter');const soundPath=await page.locator('#source-path').innerText(),sound=record(connected,soundPath);
   const caller=sound.references.incoming.find(edge=>edge.line&&targetPath(connected,edge.source)?.toLowerCase().endsWith('.prg'));assert.ok(caller,'Audio shortcut has an indexed program caller');
   if(sound.type==='wav'){
     await page.locator('#graph audio').waitFor({state:'attached'});await page.locator('#graph audio').evaluate(a=>a.addEventListener('playing',()=>a.dataset.played='yes',{once:true}));
     await page.waitForFunction(()=>document.querySelector('#graph .audio-controls button')?.disabled===false);
     await page.getByRole('button',{name:'Play WAV',exact:true}).press('Enter');await page.locator('#graph audio[data-played="yes"]').waitFor({state:'attached'});
     await page.getByRole('button',{name:'Reset WAV to beginning',exact:true}).press('Enter');
   }else{
     await page.locator('#graph').evaluate(graph=>{new MutationObserver(()=>{if(graph.textContent.includes('Playing with GeneralUser'))graph.dataset.played='yes';}).observe(graph,{childList:true,subtree:true,characterData:true});});
     await page.getByRole('button',{name:'Play MIDI',exact:true}).press('Enter');await page.locator('#graph[data-played="yes"]').waitFor({state:'attached'});
   }
   await page.getByRole('button',{name:'Connections',exact:true}).press('Enter');await page.getByLabel('File type',{exact:true}).selectOption('prg');await page.getByLabel('Direction',{exact:true}).selectOption('incoming');
   await follow(caller);const callerPath=targetPath(connected,caller.source);await pathIs(callerPath);await page.locator(`#line-${caller.line}.active-line`).waitFor();
   assert.equal(await page.getByLabel('File type',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Direction',{exact:true}).inputValue(),'');
   await page.locator('#selection-back').press('Enter');await pathIs(soundPath);await page.locator('#selection-forward').press('Enter');await page.locator(`#line-${caller.line}.active-line`).waitFor();
   let probe=Object.values(connected.artifacts).find(a=>a.type==='prg'&&a.references.outgoing.some(e=>e.status==='dynamic')&&a.references.outgoing.some(e=>e.status==='missing'));
   assert.ok(probe,'Example contains explicit missing/computed source evidence');
   if(probe.path!==callerPath){const included=record(connected,callerPath).references.outgoing.find(e=>e.target&&targetPath(connected,e.target)===probe.path);assert.ok(included);await follow(included);await pathIs(probe.path);}
   for(const resolution of ['missing','dynamic']){
     await clear();await page.getByLabel('Resolution',{exact:true}).selectOption(resolution);
     const edge=probe.references.outgoing.find(e=>e.status===resolution);await inspect(edge);
     assert.match(await page.locator('.connection-preview').innerText(),resolution==='missing'?/No matching target/:/computed by the program/);
     if(resolution==='missing'&&viewport==='desktop'&&!input.native)await shot('after-missing-desktop.png');
     await page.getByRole('button',{name:'View reference in source',exact:true}).press('Enter');await page.locator(`#line-${edge.line}.active-line`).waitFor();
     assert.equal(await page.locator(`#line-${edge.line}`).evaluate(e=>e===document.activeElement),true);
   }
   await page.getByRole('button',{name:'Technical details',exact:true}).press('Enter');
   assert.equal(await page.locator('#technical-title').evaluate(e=>e===document.activeElement),true);
   assert.ok(await page.locator('.selection-toolbar').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=-1&&r.bottom<innerHeight/2;}),'Compact sticky context remains visible');
   await noOverflow();if(!input.native)await shot('after-technical-'+viewport+'.png');
   await page.locator('#asset-record > summary').press('Enter');await page.getByLabel('Decoded artifact JSON',{exact:true}).filter({hasText:probe.path}).waitFor();
   const beforeExport=await page.evaluate(()=>history.length);
   const exported=await exportJSON(true);assert.equal(exported.archive.fileCount,connected.archive.fileCount);assert.ok(record(exported,probe.path).references.outgoing.some(e=>e.status==='dynamic'));
   assert.equal(await page.evaluate(()=>history.length),beforeExport,'Export shortcut adds no history stop');
   if(input.native){
     await page.locator('#play-gam-startup').press('Enter');await page.getByRole('button',{name:'Depart',exact:true}).waitFor();
     assert.match(await page.locator('#play-target-hint').innerText(),/Choose an option/);assert.match(await page.locator('#play-launch-mode').innerText(),/Game startup/);assert.equal(await page.locator('#play-reset').innerText(),'Restart game');
     assert.equal(await page.locator('.play-placements').evaluate(e=>e.open),false);await page.locator('#play-stage').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('after-title-'+viewport+'.png');
     await page.getByRole('button',{name:'Depart',exact:true}).press('Enter');await page.locator('#play-dialogue-text').filter({hasText:'Harbor ready'}).waitFor();
     await page.locator('#play-talk').press('Enter');await page.locator('#play-close').press('Enter');await pathIs(probe.path);
     if(!await page.locator('#play-board-diagnostics').evaluate(e=>e.open))await page.locator('#play-board-diagnostics > summary').click();
     await page.locator('#play-direct').press('Enter');assert.match(await page.locator('#play-launch-mode').innerText(),/Direct board diagnostic/);assert.equal(await page.locator('#play-reset').innerText(),'Reset board diagnostic');
     assert.equal(await page.getByRole('button',{name:'Depart',exact:true}).count(),0);assert.doesNotMatch(await page.locator('#play-script-variables').textContent(),/startup_runs/);
     assert.match(await page.locator('#play-fight-test').textContent(),/Simulate victory \(test only\)/);await page.locator('#play-close').press('Enter');
   }
   report.results.push(viewport+' '+input.name+': complete board/tile/incoming/history, actual audio/caller line/return, missing/computed/source evidence, technical/JSON export, keyboard focus and overflow passed'+(input.native?'; normal title/choice/wait versus direct launch and preserved test-combat labeling passed.':'.'));
   await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Complete staged journeys passed: '+report.results.join('\n'));
}catch(error){report.failure=String(error.stack??error);if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});report.failureContext=await page.locator('body').innerText().then(t=>t.slice(-18000)).catch(()=>'');}throw error;
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.close(()=>clearTimeout(watchdog));}
