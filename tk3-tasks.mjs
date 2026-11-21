import { boardTaskBindings } from "./tk3-behavior-bindings.mjs";
export { boardTaskBindings } from "./tk3-behavior-bindings.mjs";
import { resolveAsset } from "./model.mjs";
import { startTk3Script, initialTk3ScriptState, resumeTk3Task } from "./tk3-script-slice.mjs";

export const taskCommands = new Set(["thread","killthread","getthreadid","threadsleep","threadwake"]);
export function createTk3TaskScheduler(artifacts, projectRoot) {
  const tasks=new Map(); let nextId=1, boardPath=null, destroyed=false, now=0, cursor=0;
  const create=(binding,persistent=false,variables={})=>{
    if(destroyed) throw Error("Task session closed.");
    if(tasks.size>=32) throw Error("Background task limit (32) exceeded.");
    const id=nextId++, path=binding.path ?? projectRoot+"Prg/"+binding.value;
    const program=artifacts.get(path);
    const t={...binding,id,path,persistent,boardPath,status:"ready",wakeAt:0,result:null};
    if(binding.status!=="resolved" || !program?.program?.rows || program.error) {
      t.status="error"; t.error=path+":1: Background program is "+binding.status+".";
    } else {
      const response=startTk3Script({...initialTk3ScriptState(),variables},program.program.rows.map(r=>r.line).join("\n"),path,
        {artifacts,projectRoot,cooperative:true,defer:true,taskId:id,sourceBoardPath:boardPath,sourceItemSlot:binding.entitySlot});
      t.state=response.state;
      if(response.status==="error"){t.status="error";t.error=response.state.diagnostic.text;}
    }
    tasks.set(id,t); return id;
  };
  const task = id => { const t=tasks.get(Number(id)); if(!t) throw Error("Invalid thread ID: "+id);return t; };
  const api={
    enter(scene,state) {
      for(const [id,t] of tasks) if(!t.persistent) tasks.delete(id);
      boardPath=scene.boardPath;
      for(const binding of boardTaskBindings(scene,artifacts)) {
        const id=create(binding,false,state.variables);
        const t=tasks.get(id);
        t.enabled=!binding.loadingVariable || String(state.variables[binding.loadingVariable.toLowerCase()] ?? 0)===binding.loadingValue;
        if(binding.role==="Board thread") state.variables["threads["+binding.slot+"]"]=id;
      }
    },
    handle(effect,currentId=null,variables={}) {
      const {name,args}=effect; let value=0;
      if(name==="thread") {
        const binding={...resolveAsset(artifacts,"Prg",String(args[0]),projectRoot),value:String(args[0]),owner:effect.path,role:"Thread()",slot:null,line:effect.line};
        if(binding.status!=="resolved") throw Error("Thread program is "+binding.status+".");
        value=create(binding, typeof args[1]==="string" ? args[1].toLowerCase()!=="off" : Boolean(args[1]),variables);
      } else if(name==="getthreadid") {
        if(currentId===null) throw Error("GetThreadID is invalid outside a task."); value=currentId;
      } else if(name==="killthread") {task(args[0]); tasks.delete(Number(args[0]));}
      else if(name==="threadsleep") {
        const seconds=Number(args[1]); if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw Error("Invalid thread sleep duration.");
        task(args[0]).wakeAt=seconds===0?Infinity:now+seconds*1000;
      } else if(name==="threadwake") task(args[0]).wakeAt=0;
      else throw Error("Unsupported task service: "+name);
      const index=name==="thread" && args.length===3?2:name==="getthreadid" && args.length===1?0:null;
      return {value,outputs:index===null?[]:[{index,value}]};
    },
    tick(state,timestamp,paused=false,service=null) {
      now=timestamp;
      if(destroyed || paused) return state;
      const batch=[...tasks.values()], begin=performance.now();
      for(let count=0;count<batch.length;count++) {
        if(count && performance.now()-begin>=8)break;
        const t=batch[cursor++ % batch.length];
        if(!tasks.has(t.id)||t.status==="error"||t.status==="completed")continue;
        if(t.entitySlot!==null && t.entitySlot!==undefined &&
          (state.erasedItems?.[t.boardPath] ?? []).includes(t.entitySlot)){t.status="paused-erased";continue;}
        if(t.enabled===false){t.status="paused-inactive";continue;}
        if(t.wakeAt>now){t.status="sleeping";continue;}
        try {
          const response=resumeTk3Task({...t.state,variables:state.variables},t.result);
          t.result=null; t.state=response.state;
          state={...state,variables:response.state.variables};
          if(response.status==="effect" && taskCommands.has(response.effect.name)) {
            t.result=api.handle(response.effect,t.id,state.variables);t.status="ready";
          } else if(response.status==="effect" && service) {
            t.result=service(response.effect,t);t.status="ready";
          } else if(response.status==="yielded") t.status="ready";
          else if(response.status==="completed") t.status="completed";
          else throw Error(response.state.diagnostic?.text ?? "Background program cannot own foreground/modal effect: "+response.status);
          if(response.state.screen?.active || response.state.message)throw Error("Background drawing/dialogue requires foreground ownership.");
        } catch(error) {const fault=t.state?.diagnostic ?? t.state?.execution?.pendingService ?? t.state?.execution?.instructions[t.state.execution.pc-1];t.status="error";t.error=t.state?.diagnostic?.text ?? (fault?.path ?? t.path)+":"+(fault?.line ?? 1)+": "+error.message;}
      }
      cursor%=Math.max(1,tasks.size);
      return state;
    },
    get records(){return [...tasks.values()].map(t=>{
      const current=t.state?.execution?.pendingService ?? t.state?.execution?.instructions[Math.max(0,t.state.execution.pc-1)];
      return {id:t.id,path:current?.path ?? t.path,owner:t.owner,role:t.role,slot:t.slot,
        entitySlot:t.entitySlot,status:t.status,ownerLine:t.line,line:current?.line ?? 1,error:t.error ?? ""};
    });},
    destroy(){destroyed=true;tasks.clear();},
  };
  return api;
}
