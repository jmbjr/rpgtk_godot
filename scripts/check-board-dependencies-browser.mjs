import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { buildDependencyCases } from "../docs/specs/fixtures/dependency-fixtures.mjs";

const baseline = "cd1ecbebcc83262eaf5784d70e8e6a718db9e30b";
const site = resolve(process.argv[2] ?? "site"), output = resolve(process.argv[3] ?? "dist/board-dependencies-review");
await mkdir(output, { recursive:true });
const old = new Map(["index.html","style.css","app.mjs"].map(path => [path, execFileSync("git",["show",baseline+":"+path])]));
const server = createServer(async(req,res) => {
  let path = decodeURIComponent(new URL(req.url,"http://localhost").pathname), before = path.startsWith('/__before__/');
  if(before) path=path.slice('/__before__'.length); if(path==='/')path='/index.html';
  try { const file=resolve(site,'.'+path);if(!file.startsWith(site+sep))throw Error('Outside staged site');
    const bytes=before&&old.has(path.slice(1))?old.get(path.slice(1)):await readFile(file);
    res.writeHead(200,{'Content-Type':({html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',json:'application/json'})[path.split('.').at(-1)]??'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const inputs=await buildDependencyCases(await readFile(resolve(site,'tk2-legacy-game.zip')));
const report={baseline,head:process.env.REVIEW_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  build:JSON.parse(await readFile(resolve(site,'viewer-build.json'),'utf8')), viewports:{desktop:{width:1365,height:960},mobile:{width:390,height:844}},
  verifier:'Automated staged Chromium; screenshot inspection separate; owner acceptance pending',inputs:[],results:[],screenshots:[]};
for(const input of inputs){await writeFile(resolve(output,input.name),input.bytes);report.inputs.push({name:input.name,bytes:input.bytes.length,sha256:createHash('sha256').update(input.bytes).digest('hex'),board:input.board,program:input.program,
  construction:input.legacy?'Historical TK2 legacy records with authored inspection-only legacy source probes':'Flat native TK3 records with independently bound source probes'});}
let browser,page;const errors=[];const watchdog=setTimeout(()=>{console.error('Board dependencies timeout');process.exit(1);},180000);watchdog.unref();
const pathIs=async path=>page.locator('#source-path').filter({hasText:path}).waitFor();
const shot=async name=>{await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));await page.screenshot({path:resolve(output,name),animations:'disabled'});report.screenshots.push(name);};
const upload=async input=>{await page.locator('#archive').setInputFiles({name:input.name,mimeType:'application/zip',buffer:input.bytes});await page.locator('#opened-archive').filter({hasText:input.name}).waitFor();};
const file=async path=>{const folder=path.slice(0,path.lastIndexOf('/')+1);await page.locator(`#folder-list button[data-folder="${folder}"]`).click();await page.locator('#file-list button').filter({hasText:path.split('/').at(-1)}).click();await pathIs(path);};
const exportJSON=async()=>{if(!await page.locator('#archive-export').evaluate(e=>e.open))await page.locator('#archive-export > summary').click();const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-game-json').click()]);return JSON.parse(await readFile(await download.path(),'utf8'));};
const rows=()=>page.locator('#board-dependencies .dependency-row');
const findRow=(path,owner)=>rows().and(page.locator(`[data-path="${path}"]${owner?`[data-owner="${owner}"]`:''}`)).first();
const revealRow=async(path,owner)=>{
  const row=findRow(path,owner);
  for(let i=0;i<24&&!await row.count();i++){
    const more=page.locator('#board-dependencies button[data-more]').first();assert.ok(await more.count(),'Requested edge exists in visible/paged graph: '+path);await more.press('Enter');
  }
  assert.equal(await row.count(),1,path);return row;
};
const expand=async row=>row.locator(':scope > .task-buttons [data-expand]').press('Enter');
const inspect=async row=>{await row.locator(':scope > .task-buttons [data-evidence]').press('Enter');assert.equal(await page.locator('#dependency-evidence').evaluate(e=>e===document.activeElement),true);};
const artifact=(json,path)=>Object.values(json.artifacts).find(a=>a.path===path);
const targetPath=(json,edge)=>Object.values(json.artifacts).find(a=>a.$id===edge.target?.$ref.split('#')[0])?.path;
try{
  browser=await chromium.launch({executablePath:process.env.TK3_CHROMIUM||undefined});report.browserVersion=browser.version();
  page=await browser.newPage({viewport:report.viewports.desktop});page.setDefaultTimeout(10000);
  await page.goto(base+'/__before__/');await upload(inputs[0]);await file(inputs[0].board);await page.getByRole('button',{name:'Connections',exact:true}).press('Enter');await shot('before-direct-board-desktop.png');await page.close();
  for(const viewport of ['desktop','mobile'])for(const input of inputs){
    page=await browser.newPage({viewport:report.viewports[viewport]});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await upload(input);await file(input.board);const json=await exportJSON();
    const direct=artifact(json,input.board).references.outgoing;
    const programEdges=direct.filter(e=>targetPath(json,e)===input.program);assert.ok(programEdges.length);
    await page.locator('#investigate-board').press('Enter');assert.equal(await page.locator('#dependency-title').evaluate(e=>e===document.activeElement),true);
    assert.match(await page.locator('#dependency-root').innerText(),new RegExp(input.board.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(await page.locator('#board-dependencies').innerText(),/not a complete runtime/);
    let entry=await revealRow(input.program,input.board);assert.equal(await entry.getAttribute('data-asset-id'),artifact(json,input.program).$id);
    await inspect(entry);for(const edge of programEdges)assert.ok((await page.locator('#dependency-evidence').innerText()).includes(edge.evidence));
    await page.getByRole('button',{name:'Inspect owner fields',exact:true}).first().press('Enter');await pathIs(input.board);assert.equal(await page.locator('#technical-title').evaluate(e=>e===document.activeElement),true);
    await page.locator('#dependency-jump').press('Enter');await expand(entry);
    const branchPath=input.root+'Prg/branch.prg';const branch=await revealRow(branchPath,input.program);await expand(branch);
    const cycle=await revealRow(input.program,branchPath);assert.match(await cycle.locator(':scope > .dependency-marker').innerText(),/Cycle/);assert.equal(await cycle.locator(':scope > .task-buttons [data-expand]').count(),0);
    assert.ok(await rows().locator(':scope > .dependency-marker').filter({hasText:'Shared asset'}).count());
    // The selected branch's reason agrees with actual connected JSON source evidence.
    const call=artifact(json,input.program).references.outgoing.find(e=>targetPath(json,e)===branchPath);assert.ok(call.line);
    await inspect(branch);await page.getByRole('button',{name:'View source · line '+call.line,exact:true}).press('Enter');await pathIs(input.program);await page.locator(`#line-${call.line}.active-line`).waitFor();
    assert.equal(await page.locator(`#line-${call.line}`).evaluate(e=>e===document.activeElement),true);assert.equal(await cycle.count(),1,'Trail survives inspector remount');
    await page.locator('#selection-back').press('Enter');await pathIs(input.board);await page.locator('#selection-forward').press('Enter');await pathIs(input.program);await page.locator(`#line-${call.line}.active-line`).waitFor();
    // Collapsing changes only the investigation, not source/media/history.
    const historyLength=await page.evaluate(()=>history.length);await expand(branch);assert.equal(await cycle.count(),0);await expand(branch);assert.equal(await page.evaluate(()=>history.length),historyLength);
    // Repeated occurrences are grouped without losing source locations; evidence is bounded.
    const sound=await revealRow(input.sound,input.program);const soundEdges=artifact(json,input.program).references.outgoing.filter(e=>targetPath(json,e)===input.sound);assert.equal(soundEdges.length,66);
    await inspect(sound);assert.equal(await page.locator('#dependency-evidence .edge-list > li').count(),12);
    for(let i=0;i<4;i++)await page.getByRole('button',{name:/^Show more evidence/}).press('Enter');
    assert.equal(await page.locator('#dependency-evidence .edge-list > li').count(),60);assert.match(await page.locator('#dependency-evidence').innerText(),/60 of 66.*Evidence limit: 60/s);
    await page.getByRole('button',{name:'Back to dependency trail',exact:true}).press('Enter');assert.equal(await sound.locator(':scope > .task-buttons [data-evidence]').evaluate(e=>e===document.activeElement),true);
    for(const status of ['missing','dynamic','ambiguous']){
      const edge=artifact(json,input.program).references.outgoing.find(e=>e.status===status);assert.ok(edge,status);
      const row=rows().and(page.locator(`[data-owner="${input.program}"][data-path=""]`)).filter({hasText:edge.value}).first();
      for(let i=0;i<16&&!await row.count();i++)await page.locator('#board-dependencies button[data-more]').first().press('Enter');
      assert.equal(await row.locator(':scope > .task-buttons [data-expand]').count(),0);await inspect(row);
      assert.match(await page.locator('#dependency-evidence').innerText(),status==='missing'?/No matching target/:status==='dynamic'?/computed by the program/:/no target has been chosen/);
      if(status==='ambiguous'){
        assert.equal(await page.locator('#dependency-evidence').getByRole('button',{name:/^Inspect candidate/}).count(),edge.candidates.length);
        await page.locator('#dependency-evidence').getByRole('button',{name:'Inspect candidate · '+edge.candidates[0],exact:true}).press('Enter');await pathIs(edge.candidates[0]);
        assert.equal(await page.locator('#graph audio').count(),1);await page.locator('#selection-back').press('Enter');await pathIs(input.program);
      }else{
        await page.getByRole('button',{name:'View source · line '+edge.line,exact:true}).press('Enter');await page.locator(`#line-${edge.line}.active-line`).waitFor();
      }
    }
    // Actual depth bound and paging are visible, with a continuation route.
    for(let i=0;i<4;i++){const chain=await revealRow(input.root+'Prg/chain'+i+'.prg');await expand(chain);}
    assert.match(await page.locator('#board-dependencies').innerText(),/Hop limit reached \(6\)/);
    await page.locator('#dependency-jump').press('Enter');
    assert.ok(await page.locator('#dependency-title').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.selection-toolbar').getBoundingClientRect().bottom),'Investigation heading clears sticky toolbar');
    await shot('after-trail-'+(input.legacy?'tk2':'tk3')+'-'+viewport+'.png');
    const missing=artifact(json,input.program).references.outgoing.find(e=>e.status==='missing');const missingRow=rows().and(page.locator(`[data-owner="${input.program}"][data-path=""]`)).filter({hasText:missing.value}).first();await inspect(missingRow);
    if(!input.legacy)await shot('after-evidence-tk3-'+viewport+'.png');
    // Numbered tiles use the same exact target pointer as connected JSON.
    const tile=direct.find(e=>e.target?.tileIndex);assert.ok(tile);const tilePath=targetPath(json,tile);
    let tileRow=rows().and(page.locator(`[data-owner="${input.board}"][data-path="${tilePath}"][data-tile="${tile.target.tileIndex}"]`)).first();
    for(let i=0;i<16&&!await tileRow.count();i++)await page.locator('#board-dependencies button[data-more]').first().press('Enter');
    await inspect(tileRow);await page.getByRole('button',{name:'Open target · Tile '+tile.target.tileIndex+' · '+tilePath.split('/').at(-1),exact:true}).press('Enter');
    await pathIs(tilePath);await page.locator(`#graph [data-tile="${tile.target.tileIndex}"][aria-pressed="true"]`).waitFor();await page.locator('#selection-back').press('Enter');
    // Media is not remounted by investigation controls and section jumps.
    await inspect(await revealRow(input.sound,branchPath));await page.getByRole('button',{name:'Open target · '+input.sound.split('/').at(-1),exact:true}).press('Enter');await pathIs(input.sound);
    await page.waitForFunction(()=>document.querySelector('#graph .audio-controls button')?.disabled===false);
    await page.locator('#graph audio').evaluate(a=>{a.dataset.identity='original';a.addEventListener('playing',()=>a.dataset.played='yes',{once:true});});
    await page.getByRole('button',{name:'Play WAV',exact:true}).press('Enter');await page.locator('#graph audio[data-played="yes"]').waitFor({state:'attached'});
    const audioHistory=await page.evaluate(()=>history.length);await page.locator('#dependency-jump').press('Enter');await inspect(await revealRow(input.sound,branchPath));await page.getByRole('button',{name:'Back to dependency trail',exact:true}).press('Enter');
    assert.equal(await page.locator('#graph audio').getAttribute('data-identity'),'original');assert.equal(await page.evaluate(()=>history.length),audioHistory);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-wide mobile overflow');
    await page.getByRole('button',{name:'Return to board',exact:true}).press('Enter');await pathIs(input.board);assert.equal(await cycle.count(),1);
    await page.getByRole('button',{name:'Close investigation',exact:true}).press('Enter');assert.equal(await page.locator('#asset-name').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#board-dependencies').isVisible(),false);
    await page.locator('#investigate-board').press('Enter');await upload(inputs.find(other=>other!==input));assert.equal(await page.locator('#board-dependencies').isVisible(),false);assert.equal(await page.locator('#dependency-jump').isVisible(),false);
    report.results.push(viewport+' '+input.name+': normal upload, board/field/source/tile evidence agrees with JSON; multihop/cycles/shared/paging/hop/evidence bounds; candidate inspection/history; keyboard/media preservation; archive replacement passed.');await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Board dependencies staged Chromium passed: '+report.results.join('\n'));
}catch(error){report.failure=String(error.stack??error);if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});report.failureContext=await page.locator('body').innerText().then(t=>t.slice(-22000)).catch(()=>'');}throw error;
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.close(()=>clearTimeout(watchdog));}
