import { resolveAsset } from "./model.mjs";

// Bounded source-owned CCmap menu clue projection. No arbitrary method,
// menu-screen, plugin, save/load or graphical cursor code is executed.
const issue = (path, line, message) => ({
  path, line, message, text: path + ":" + line + ": " + message,
});
const programSource = asset => asset?.type === "prg" &&
  asset.decodeStatus === "decoded" && !asset.error &&
  Array.isArray(asset.program?.rows) ?
    asset.program.rows.map(r => r.line).join("\n") : null;
function rowsOf(source) {
  return source.split(/\r\n?|\n/).map((raw, i) => {
    let text = "", quote = false, escaped = false;
    for (let j = 0; j < raw.length; j++) {
      const c = raw[j];
      if (!quote && c === "/" && raw[j + 1] === "/") break;
      text += c;
      if (quote && c === "\\" && !escaped) { escaped = true; continue; }
      if (c === '"' && !escaped) quote = !quote;
      escaped = false;
    }
    let depth = 0, inString = false, lastBackslash = false;
    for (const c of text) {
      if (c === '"' && !lastBackslash) inString = !inString;
      if (!inString && c === "{") depth++;
      if (!inString && c === "}") depth--;
      lastBackslash = c === "\\";
    }
    return { line: i + 1, text: text.trim(), depth };
  });
}
function menuMethod(source, name, path) {
  const rows = rowsOf(source);
  const begin = rows.findIndex(r => new RegExp(
    "^method\\s+" + name + "\\s*\\(\\s*\\)$", "i").test(r.text));
  if (begin < 0) throw issue(path, 1, "Included program lacks method " + name + "().");
  const open = rows.findIndex((r,i) => i > begin && r.text === "{");
  if (open < 0) throw issue(path, rows[begin].line, "Menu method missing {.");
  let depth = 0;
  for (let i = open; i < rows.length; i++) {
    depth += rows[i].depth;
    if (depth === 0) return rows.slice(open+1,i);
  }
  throw issue(path, rows[begin].line, "Menu method has unmatched braces.");
}
function casesInMethod(body, path) {
  const switchAt = body.findIndex(r => /^switch\s*\(\s*[A-Za-z_]\w*\s*\)$/i.test(r.text));
  if (switchAt < 0) throw issue(path, body[0]?.line ?? 1, "No source switch in menu method.");
  const open = body.findIndex((r,i)=>i>switchAt && r.text === "{");
  if (open < 0) throw issue(path, body[switchAt].line, "Missing source switch {.");
  const cases = [];
  let depth = 1, current = null;
  for (let i=open+1; i<body.length; i++) {
    const row = body[i];
    if (depth === 1 && /^case\s+-?\d+\s*:$/.test(row.text)) {
      if (current) cases.push(current);
      current = { index:Number(row.text.match(/-?\d+/)[0]),
        line:row.line, rows:[] };
    } else if (current) current.rows.push(row);
    depth += row.depth;
    if (depth === 0) { if(current) cases.push(current); break; }
  }
  return cases.filter(c=>c.index>=0);
}
function parseClueCase(item, path, constants) {
  const r = item.rows;
  const guards = r.filter(x => /^if\s*\(\s*checked\s*\[\s*[A-Za-z_]\w*\s*\]\s*==\s*0\s*\)$/i.test(x.text));
  if (guards.length === 0) return null;
  if (guards.length !== 1) throw issue(path,item.line,"Multiple source clue conditions.");
  const name = guards[0].text.match(/checked\s*\[\s*([A-Za-z_]\w*)\s*\]/i)[1].toLowerCase();
  const id = constants[name];
  if (!Number.isInteger(id) || id < 0 || id >= constants.maxclues)
    throw issue(path,guards[0].line,"Unknown source clue event " + name + ".");
  const increments = r.filter(x => /^clues\s*\+\+\s*;?$/i.test(x.text));
  const clues = r.filter(x => /^updateClues\s*\(/i.test(x.text));
  const visits = r.filter(x => new RegExp(
    "^checked\\s*\\[\\s*" + name + "\\s*\\]\\s*\\+\\+\\s*;?$","i").test(x.text));
  if (increments.length !== 1 || clues.length !== 1 || visits.length !== 1)
    throw issue(path,guards[0].line,
      "Expected exactly one source clue increment, updateClues and event visit increment.");
  const guardPos = r.indexOf(guards[0]);
  const opening = r.findIndex((x,i)=>i>guardPos && x.text === "{");
  let ending = -1, depth = 0;
  for (let i=opening;i<r.length && opening>=0;i++) {
    depth += r[i].depth;
    if (depth===0) {ending=i;break;}
  }
  if (ending < 0 || ![increments[0],clues[0]].every(x =>
      r.indexOf(x)>opening && r.indexOf(x)<ending))
    throw issue(path,guards[0].line,"Clue update is outside source first-visit branch.");
  const matched=clues[0].text.match(/^updateClues\s*\(\s*("(?:[^"\\]|\\.)*")\s*\)\s*;?$/i);
  let message=null;
  try { if(matched) message=JSON.parse(matched[1]); } catch { /* source error */ }
  if (typeof message !== "string")
    throw issue(path,clues[0].line,"Clue message requires a literal string.");
  const needsProfile=r.some(x=>/^if\s*\(\s*\w+\s*(?:~=|!=)\s*-1\s*\)$/i.test(x.text));
  if (needsProfile && !r.some(x=>/->setActiveWinID\s*\(\s*PROFMENU\s*\)/i.test(x.text)))
    throw issue(path,guards[0].line,"Profile-gated clue lacks a source profile cursor.");
  if (r.indexOf(visits[0])<r.indexOf(clues[0]))
    throw issue(path,visits[0].line,"Source visit counter occurs before clue.");
  return {index:item.index,sourceLine:item.line,event:name,eventIndex:id,
    clueText:message,clueLine:clues[0].line,visitLine:visits[0].line,needsProfile};
}
function menuLabelsAndProfiles(artifacts,definitions) {
  const labels=new Map(), profileNames=new Set(), profiles=new Map();
  for (const path of definitions.sourcePaths??[]) {
    const s=programSource(artifacts.get(path));
    if (!s) continue;
    for (const row of rowsOf(s)) {
      const graphic=row.text.match(/->setGraphic\s*\(\s*SIDEMENU\s*,\s*(\d+)\s*,\s*0\s*,\s*"mm([^"]+)_inactive\.[^"]+"\s*\)/i);
      const label=row.text.match(/->setText\s*\(\s*SIDEMENU\s*,\s*(\d+)\s*,\s*0\s*,\s*"([^"]+)"\s*\)/i);
      if (graphic) labels.set(Number(graphic[1]),graphic[2]);
      if (label) labels.set(Number(label[1]),label[2]);
      if (/->setGraphic\s*\(\s*PROFMENU\s*,/i.test(row.text)) {
        const member=row.text.match(/\b([A-Za-z_]\w*)\s*\[\s*\d+\s*\]/);
        if (member) profileNames.add(member[1].toLowerCase());
      }
    }
  }
  const startup=programSource(artifacts.get(definitions.startupPath));
  if (startup) for (const row of rowsOf(startup)) {
    const m=row.text.match(/^([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*=\s*("(?:[^"\\]|\\.)*")\s*;?$/i);
    if (!m || !profileNames.has(m[1].toLowerCase())) continue;
    let name=null;
    try {name=JSON.parse(m[3]);}catch{ /* source error */ }
    if (typeof name==="string" && name && name.toLowerCase()!=="blank")
      profiles.set(Number(m[2]),name);
  }
  return {labels,profiles:[...profiles].sort((a,b)=>a[0]-b[0])
    .map(([index,name])=>({index,name}))};
}
function finalFlag(artifacts,definitions) {
  for(const path of definitions.sourcePaths??[]) {
    const source=programSource(artifacts.get(path));
    const m=source?.match(/method\s+updateClues\s*\([^)]*\)[\s\S]*?if\s*\(\s*remainingclues\s*==\s*0\s*\)[\s\S]*?\b([A-Za-z_]\w*)\s*=\s*1\b/i);
    if(m)return m[1].toLowerCase();
  }
  return null;
}

// null: this is not the CCmap menu entry. {ok:false}: recognized entry,
// but source semantics are unverified and no actions will be emulated.
export function compileTk3SourceMenu(artifacts,scene,action,definitions) {
  if (action?.status!=="resolved") return null;
  const raw=programSource(artifacts.get(action.path));
  if(raw===null)return null;
  const entry=rowsOf(raw).filter(r=>r.text);
  const inc=entry.filter(r=>/^#include\s*\(/i.test(r.text));
  const calls=entry.filter(r=>/^[A-Za-z_]\w*\s*\(\s*\)\s*;?$/i.test(r.text));
  if(!inc.length || !calls.length)return null;
  try {
    if(inc.length!==1 || calls.length!==1 || entry.length!==2)
      throw issue(action.path,entry[0]?.line??1,"Menu entry needs one include and one method call.");
    const filename=inc[0].text.match(/^#include\s*\(\s*"([^"]+)"\s*\)\s*;?$/i)?.[1];
    const name=calls[0].text.match(/^([A-Za-z_]\w*)\s*\(/)[1];
    if(!filename || !/^[A-Za-z_]\w*\.prg$/i.test(filename))
      throw issue(action.path,inc[0].line,"Unsupported source include.");
    const root=action.path.match(/^(.*\/)Prg\/[^/]+\.prg$/i)?.[1]??null;
    const helper=resolveAsset([...artifacts.keys()],"Prg",filename,root);
    if(helper.status!=="resolved")
      throw issue(action.path,inc[0].line,"Menu helper " + filename + " is " + helper.status + ".");
    const src=programSource(artifacts.get(helper.path));
    if(src===null)throw issue(action.path,inc[0].line,"Menu helper cannot be decoded.");
    if(!definitions?.supported)throw issue(action.path,inc[0].line,
      "Source clue enum and limit were not resolved from startup includes.");
    const cases=casesInMethod(menuMethod(src,name,helper.path),helper.path);
    const choices=cases.map(c=>parseClueCase(c,helper.path,definitions.constants))
      .filter(Boolean);
    if(!choices.length)throw issue(helper.path,1,"No supported clue menu cases.");
    const {labels,profiles}=menuLabelsAndProfiles(artifacts,definitions);
    for(const choice of choices) {
      if(!labels.has(choice.index))throw issue(helper.path,choice.sourceLine,
        "Source menu item "+choice.index+" has no label.");
      choice.label=labels.get(choice.index);
      if(choice.needsProfile && !profiles.length)throw issue(helper.path,choice.sourceLine,
        "No source-defined player available for gated menu item.");
    }
    if(new Set(choices.map(c=>c.eventIndex)).size!==choices.length)
      throw issue(helper.path,1,"Menu clue event indices are not unique.");
    return {ok:true,path:helper.path,entryPath:action.path,method:name,
      choices,profiles,maxclues:definitions.constants.maxclues,
      awardFlag:finalFlag(artifacts,definitions)};
  } catch(e) {return {ok:false,diagnostic:e.path&&e.line?e:
    issue(action.path,1,e.message??String(e))};}
}

// Pure session mutations, shared with the placed-object dialogue state.
export function openTk3SourceMenu(state,plan) {
  if(!plan?.ok)return {status:"unsupported",state};
  if(state.menu||state.dialogue)return {status:"busy",state};
  return {status:"open",state:{...state,clueMessage:null,
    menu:{phase:"choices",selectedIndex:null,message:null}}};
}
export function selectTk3SourceMenu(state,plan,index) {
  if(!state?.menu||state.menu.phase!=="choices")return {status:"inactive",state};
  const choice=plan.choices.find(x=>x.index===index);
  if(!choice)return {status:"invalid-choice",state};
  if(choice.needsProfile)return {status:"choose-profile",
    state:{...state,menu:{phase:"profile",selectedIndex:index,message:null}}};
  return commit(state,plan,choice);
}
export function confirmTk3MenuProfile(state,plan,profile) {
  if(!state?.menu||state.menu.phase!=="profile")return {status:"inactive",state};
  if(!plan.profiles.some(p=>p.index===profile))
    return {status:"invalid-profile",state};
  const choice=plan.choices.find(c=>c.index===state.menu.selectedIndex);
  return choice?commit(state,plan,choice):{status:"invalid-choice",state};
}
function commit(state,plan,choice) {
  const vars={...state.variables};
  if(!Array.isArray(vars.checked)||vars.maxclues!==plan.maxclues)
    return {status:"error",state:{...state,diagnostic:issue(plan.path,
      choice.visitLine,"Source clue array not initialized.")}};
  const checked=[...vars.checked];
  const first=!(checked[choice.eventIndex]??0);
  checked[choice.eventIndex]=(checked[choice.eventIndex]??0)+1;
  vars.checked=checked;
  if(first) {
    vars.clues=(Number(vars.clues)||0)+1;
    vars.remainingclues=vars.maxclues-vars.clues;
    if(vars.remainingclues===0&&plan.awardFlag)vars[plan.awardFlag]=1;
  }
  const message=first?choice.clueText:
    choice.label+" already explored; no additional clue.";
  return {status:first?"clue":"repeat",clueGained:first,
    state:{...state,variables:vars,diagnostic:null,
      clueMessage:first?message:null,
      menu:{phase:"choices",selectedIndex:null,message}}};
}
export function cancelTk3SourceMenu(state) {
  if(!state?.menu)return {status:"inactive",state};
  if(state.menu.phase==="profile")return {status:"back",
    state:{...state,menu:{phase:"choices",selectedIndex:null,
      message:"Selection cancelled; no clue consumed."}}};
  return {status:"closed",state:{...state,menu:null}};
}
