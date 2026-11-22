import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import JSZip from "../vendor/jszip.min.js";

// Matched before/after rendering uses this exact pre-milestone revision.
const baseline = "7265632fd80b12add39725e2fd94e2054f94c58f";
const site = resolve(process.argv[2] ?? "site");
const output = resolve(process.argv[3] ?? "dist/first-use-review");
await mkdir(output, {recursive:true});
const before = new Map(["index.html", "style.css", "app.mjs"].map(path =>
  [path, execFileSync("git", ["show", baseline + ":" + path])]));
const types = {html:"text/html",css:"text/css",mjs:"text/javascript",js:"text/javascript",json:"application/json"};
const server = createServer(async (request,response) => {
  let path = decodeURIComponent(new URL(request.url,"http://localhost").pathname);
  const old = path.startsWith("/__before__/");
  if(old)path=path.slice("/__before__".length);
  if(path==="/")path="/index.html";
  const file=resolve(site,"."+path);
  try {
    if(!file.startsWith(site+sep))throw Error("Outside staged site");
    const bytes=old && before.has(path.slice(1)) ? before.get(path.slice(1)) : await readFile(file);
    response.writeHead(200,{"Content-Type":types[path.split('.').at(-1)] ?? "application/octet-stream","Cache-Control":"no-store"}).end(bytes);
  }catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port;
const report={baseline,head:process.env.REVIEW_SHA ?? execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  browser:"Playwright Chromium",desktop:{width:1365,height:960},mobile:{width:390,height:844},inputs:[],results:[],screenshots:[]};
for(const name of ["tk2-legacy-game.zip","tk3-title-harbor.zip","tk3-living-grove.zip"]) {
  const bytes=await readFile(resolve(site,name));report.inputs.push({name,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
let browser, page;
const watchdog=setTimeout(()=>{console.error("First-use browser checks timed out");process.exit(1);},90000);watchdog.unref();
try {
  browser=await chromium.launch({executablePath:process.env.TK3_CHROMIUM || undefined});
  report.browserVersion=browser.version();
  page=await browser.newPage({viewport:report.desktop,hasTouch:true});page.setDefaultTimeout(7000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const shot=async name=>{await page.screenshot({path:resolve(output,name),fullPage:false});report.screenshots.push(name);};
  const ready=async name=>{
    await page.locator('#opened-archive').filter({hasText:name}).waitFor();
    await page.locator('#archive-overview').waitFor();
    assert.equal(await page.locator('#archive-status').getAttribute('class'),'archive-status');
  };
  const example=async (path)=>{
    if(!await page.locator('#example-choice').isVisible())await page.locator('#examples > summary').click();
    await page.locator('#example-choice').selectOption('./'+path);
    await page.getByRole('button',{name:'Open example',exact:true}).click();await ready(path);
  };
  // Preserve a rendered baseline, rather than a recreated design mockup.
  await page.goto(base+'/__before__/');await page.locator('#archive').waitFor();await shot('before-desktop.png');
  const legacy=await readFile(resolve(site,'tk2-legacy-game.zip'));
  await page.locator('#archive').setInputFiles({name:'tk2-legacy-game.zip',mimeType:'application/zip',buffer:legacy});
  await page.locator('#archive-status').filter({hasText:/146 files/}).waitFor();
  await page.locator('#archive-status').scrollIntoViewIfNeeded();await shot('before-imported-desktop.png');
  await page.setViewportSize(report.mobile);await page.goto(base+'/__before__/');await shot('before-mobile.png');

  await page.setViewportSize(report.desktop);await page.goto(base);
  await page.locator('#open-example').waitFor();await shot('after-desktop.png');
  assert.equal(await page.title(),'RPG Toolkit · Game Explorer');
  assert.equal(await page.locator('#example-choice option').count(),3);
  assert.equal(await page.locator('#regression-downloads').getAttribute('open'),null);
  assert.equal(await page.locator('#regression-downloads a[download]').count(),17);
  assert.equal(await page.locator('#more-import-options').getAttribute('open'),null);
  assert.equal(await page.locator('#archive-overview').isVisible(),false);
  // Keyboard reaches the primary input and can disclose secondary setup.
  await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');assert.equal(await page.locator('#archive').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#more-import-options').evaluate(e=>e.open),true);
  await page.keyboard.press('Enter');
  await page.locator('#example-choice').focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button',{name:'Open example',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');await ready('tk2-legacy-game.zip');
  assert.equal(await page.locator('#archive-heading').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#examples').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#archive-details').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#archive-export').evaluate(e=>e.open),false);
  await shot('after-imported-desktop.png');
  assert.equal(await page.locator('#play-gam-startup').isDisabled(),true);
  assert.match(await page.locator('#gam-startup-status').innerText(),/Play is unavailable.*explore/i);

  // Each starting action uses the shared inspector and selection history.
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button',{name:'Browse artwork',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');
  await page.locator('#graph .tile-grid canvas').first().waitFor();
  assert.ok(await page.locator('#graph .tile-grid canvas').first().evaluate(c=>c.getContext('2d').getImageData(0,0,32,32).data.some(v=>v!==0)));
  const artPath=await page.locator('#source-path').innerText();assert.match(artPath,/\.tst$/);
  await shot('after-artwork-desktop.png');
  await page.locator('#graph button[data-tile="1"]').press('Enter');
  await page.getByRole('button',{name:'Follow connections',exact:true}).press('Enter');
  assert.equal(await page.locator('#graph button[data-tile="1"]').getAttribute('aria-pressed'),'true','Opening connections preserves the selected tile');
  assert.equal(await page.locator('#connections .connection-map').isVisible(),true);
  await page.getByRole('button',{name:'Listen to audio',exact:true}).press('Enter');
  const audioPath=await page.locator('#source-path').innerText();assert.match(audioPath,/\.wav$/);
  await page.locator('#graph audio').evaluate(a=>a.addEventListener('playing',()=>a.dataset.played='true',{once:true}));
  await page.getByRole('button',{name:'Play WAV',exact:true}).press('Enter');
  await page.locator('#graph audio[data-played="true"]').waitFor({state:'attached'});
  await page.getByRole('button',{name:'Reset WAV to beginning',exact:true}).press('Enter');
  assert.equal(await page.locator('#graph audio').evaluate(a=>a.currentTime),0);
  await page.getByRole('button',{name:'Follow connections',exact:true}).press('Enter');
  assert.equal(await page.locator('#connections .connection-map').isVisible(),true);
  await page.locator('#connections .connection-map').getByLabel('File type',{exact:true}).selectOption('anm');
  const neighbor=page.locator('#connections .connection-node').filter({hasText:'effect.anm'});
  await neighbor.press('Enter');await page.locator('.connection-preview').filter({hasText:'Frame 1 sound'}).waitFor();
  await shot('after-relationship-desktop.png');
  await page.locator('.connection-preview').getByRole('button',{name:'Open in inspector',exact:true}).press('Enter');
  assert.match(await page.locator('#source-path').innerText(),/Misc\/effect.anm$/);
  await page.goBack();await page.locator('#source-path').filter({hasText:audioPath}).waitFor();
  await page.goBack();await page.locator('#source-path').filter({hasText:artPath}).waitFor();
  await page.goForward();await page.locator('#source-path').filter({hasText:audioPath}).waitFor();
  await page.locator('#archive-export > summary').click();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download connected game JSON',exact:true}).click();
  const exportFile=await (await downloaded).path();const connected=JSON.parse(await readFile(exportFile,'utf8'));assert.equal(connected.archive.fileCount,146);
  report.results.push('Desktop: keyboard opens example; original tile pixels, real WAV playback/reset, relationship field evidence, Back/Forward and connected JSON export passed.');

  // Remaining chooser experiences have distinct observable results and launch paths.
  await example('tk3-title-harbor.zip');await page.getByRole('button',{name:'Play game',exact:true}).click();
  await page.getByRole('button',{name:'Depart',exact:true}).waitFor();assert.match(await page.locator('#play-launch-mode').innerText(),/Game startup/);
  await page.locator('#play-close').click();
  await example('tk3-living-grove.zip');await page.getByRole('button',{name:'Play game',exact:true}).click();
  await page.getByRole('button',{name:'Wake',exact:true}).waitFor();await page.locator('#play-close').click();
  await page.locator('#play-board-diagnostics > summary').click();assert.match(await page.locator('#play-board-diagnostics').innerText(),/not normal Play/);
  await page.locator('#play-direct').click();await page.locator('#play-dialogue-text').filter({hasText:'grove entry 1'}).waitFor();
  assert.match(await page.locator('#play-launch-mode').innerText(),/Direct board diagnostic/);
  assert.doesNotMatch(await page.locator('#play-script-variables').textContent(),/startup_ready|startup_runs/);
  await page.locator('#play-close').click();report.results.push('Toolkit 3 title and moving-character examples open through the common loader. Normal startup reaches source choices; direct diagnostics bypasses startup but runs entry.');

  // Failed replacement keeps the previous archive and gives a usable recovery.
  await page.route('**/tk3-title-harbor.zip',route=>route.fulfill({status:503,body:'Unavailable for recovery check'}));
  if(!await page.locator('#example-choice').isVisible())await page.locator('#examples > summary').click();
  await page.locator('#example-choice').selectOption('./tk3-title-harbor.zip');await page.locator('#open-example').click();
  await page.locator('#archive-status.error').filter({hasText:/HTTP 503.*previous archive/}).waitFor();
  assert.equal(await page.locator('#open-example').isEnabled(),true);
  assert.equal(await page.locator('#explore-artwork').isEnabled(),true);
  assert.equal(await page.locator('#play-gam-startup').isEnabled(),true);
  assert.equal(await page.locator('#more-import-options').evaluate(e=>e.open),true);
  await page.unroute('**/tk3-title-harbor.zip');
  await page.locator('#archive').setInputFiles({name:'local-legacy.zip',mimeType:'',buffer:legacy});await ready('local-legacy.zip');
  report.results.push('Failed example fetch gives HTTP/fallback evidence and preserves the previous archive; normal local-file import recovers.');

  const notes=new JSZip();notes.file('notes.txt','A synthetic archive with no game assets.');
  const notesBytes=await notes.generateAsync({type:'nodebuffer'});
  report.inputs.push({name:'notes-only.zip',bytes:notesBytes.length,sha256:createHash('sha256').update(notesBytes).digest('hex')});
  await page.locator('#archive').setInputFiles({name:'notes-only.zip',mimeType:'application/zip',buffer:notesBytes});await ready('notes-only.zip');
  for(const id of ['explore-artwork','explore-audio','explore-connections'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  assert.match(await page.locator('#artwork-count').innerText(),/No supported.*browse every file/);
  assert.match(await page.locator('#audio-count').innerText(),/No supported.*browse every file/);
  assert.equal(await page.getByRole('button',{name:'notes.txt',exact:true}).isEnabled(),true);
  report.results.push('An archive without supported art/audio/relationships explains unavailable shortcuts and retains its complete file browser.');

  const mainOnly=await browser.newPage({viewport:report.desktop});mainOnly.setDefaultTimeout(7000);
  mainOnly.on('pageerror',e=>errors.push(e.message));await mainOnly.goto(base);
  await mainOnly.locator('#more-import-options > summary').click();
  const mainBytes=await (await JSZip.loadAsync(legacy)).file('Main/TK2LegacyLab.gam').async('nodebuffer');
  await mainOnly.locator('#main-file').setInputFiles({name:'standalone-inspection.gam',mimeType:'',buffer:mainBytes});
  await mainOnly.locator('#archive-heading').filter({hasText:'Main File inspection'}).waitFor();
  await mainOnly.locator('#bindings').filter({hasText:'room.brd'}).waitFor();
  assert.equal(await mainOnly.locator('#archive-details').evaluate(e=>e.open),true);
  assert.equal(await mainOnly.locator('#archive-actions').isVisible(),false);
  assert.equal(await mainOnly.locator('#archive-export').isVisible(),false);
  await mainOnly.locator('#archive').setInputFiles({name:'local-with-inspection.zip',mimeType:'',buffer:legacy});
  await mainOnly.locator('#archive-heading').filter({hasText:'Your archive is open'}).waitFor();
  assert.equal(await mainOnly.locator('#archive-actions').isVisible(),true);await mainOnly.close();
  report.results.push('A standalone optional GAM still exposes configuration/bindings without a ZIP; subsequent archive opening restores normal task actions.');

  await page.setViewportSize(report.mobile);await page.goto(base);await shot('after-mobile.png');
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-wide horizontal overflow at 390px');
  await noOverflow();await example('tk2-legacy-game.zip');await noOverflow();await shot('after-imported-mobile.png');
  await page.getByRole('button',{name:'Browse artwork',exact:true}).tap();await noOverflow();await page.locator('#graph .tile-grid canvas').first().waitFor();
  await page.getByRole('button',{name:'Listen to audio',exact:true}).tap();await noOverflow();
  await page.locator('#graph audio').evaluate(a=>a.addEventListener('playing',()=>a.dataset.played='true',{once:true}));
  await page.getByRole('button',{name:'Play WAV',exact:true}).tap();await page.locator('#graph audio[data-played="true"]').waitFor({state:'attached'});
  await page.getByRole('button',{name:'Follow connections',exact:true}).tap();await noOverflow();
  await page.locator('#connections .connection-map').getByLabel('File type',{exact:true}).selectOption('anm');
  await page.locator('#connections .connection-node').filter({hasText:'effect.anm'}).tap();
  await page.locator('.connection-preview').filter({hasText:'Frame 1 sound'}).waitFor();await shot('after-relationship-mobile.png');
  await page.locator('.connection-preview').getByRole('button',{name:'Open in inspector',exact:true}).tap();
  assert.match(await page.locator('#source-path').innerText(),/Misc\/effect.anm$/);
  report.results.push('390×844 touch viewport: chooser/import, artwork preview, actual WAV playback and relationship evidence/open-in-inspector passed without page-wide overflow.');
  assert.deepEqual(errors,[]);report.results.push('No uncaught page errors. Owner/deployed acceptance and private-ZIP/native parity remain unverified.');
  console.log('First-use staged Chromium passed: identity, chooser and local import/recovery, artwork/audio, connection evidence/history/export, normal vs direct Play, keyboard and narrow mobile.');
} catch(error) {
  report.failure=String(error.stack ?? error);
  if(page) {
    await page.screenshot({path:resolve(output,'failure.png'),fullPage:false}).catch(()=>{});
    report.visibleFailureContext=await page.locator('body').innerText().then(text=>text.slice(0,12000)).catch(()=>"");
  }
  throw error;
} finally {
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();server.close(()=>clearTimeout(watchdog));
}
