import { circleBlocked } from "./experiments/movement-sandbox/engine.mjs";
import { compileBoardVectorCollision } from "./vector-collision.mjs";

export const entityCommands = new Set(["pushitem", "itemlocation", "itemspeed"]);
const directions = {
  n:[0,-1,"north"], north:[0,-1,"north"], s:[0,1,"south"], south:[0,1,"south"],
  e:[1,0,"east"], east:[1,0,"east"], w:[-1,0,"west"], west:[-1,0,"west"],
  ne:[1,-1,"northeast"], northeast:[1,-1,"northeast"], nw:[-1,-1,"northwest"], northwest:[-1,-1,"northwest"],
  se:[1,1,"southeast"], southeast:[1,1,"southeast"], sw:[-1,1,"southwest"], southwest:[-1,1,"southwest"],
};
// Session-owned identities. A board open replaces entities; every consumer reads
// the same position and erasure records. Browser collision uses a 9px circle.
export function createTk3Entities(artifacts) {
  let scene=null, entities=[], generation=0, destroyed=false, actor=null;
  const waiters=new Set(), worlds=new Map();
  const cancel=()=>{generation++;for(const w of waiters)w.reject(Error("Item movement owner was closed."));waiters.clear();};
  const api={
    enter(next,state) {
      cancel();scene=next;actor=null;worlds.clear();
      entities=(scene.placements ?? []).map(p=>({...p,position:{...p.position},queue:[],facing:"south",moving:false,blocked:false,animationMs:0,
        seconds:artifacts.get(p.itemPath)?.speed || 0.0625,
        waitOwner:0, erased:(state.erasedItems?.[scene.boardPath] ?? []).includes(p.slot), enabled:!p.activation.loadingVariable ||
          String(state.variables[p.activation.loadingVariable.toLowerCase()] ?? 0)===p.activation.loadingValue}));
    },
    get all(){return entities;},
    get visible(){return entities.filter(e=>!e.erased && e.enabled);},
    setActor(value){actor=value;},
    resolve(handle,effect={}) {
      if(destroyed || !scene)throw Error("Item board owner is unavailable.");
      let slot=handle;
      if(typeof handle==="string") {
        if(!["source","target"].includes(handle.toLowerCase()) || effect.sourceBoardPath!==scene.boardPath)
          throw Error("Item handle must be a current-board slot or bound source/target.");
        slot=effect.sourceItemSlot;
      }
      const entity=entities.find(e=>Number.isInteger(slot) && e.slot===slot);
      if(!entity || entity.itemStatus!=="resolved" || entity.positionStatus!=="valid")throw Error("Item not found on current board: "+handle);
      return entity;
    },
    erase(effect,state) {
      const e=api.resolve(effect.alias,effect);e.erased=true;e.queue=[];e.moving=false;
      const erased=new Set(state.erasedItems?.[scene.boardPath] ?? []);erased.add(e.slot);
      return {...state,erasedItems:{...state.erasedItems,[scene.boardPath]:[...erased]}};
    },
    handle(effect,task=null) {
      const {name,args}=effect,e=api.resolve(args[0],effect);
      if(name==="itemlocation")return {value:0,outputs:[1,2,3].map((index,i)=>({index,value:Math.trunc([e.position.x,e.position.y,e.position.layer][i])}))};
      if(name==="itemspeed") {
        const seconds=Number(args[1]);if(!Number.isFinite(seconds)||seconds<=0||seconds>60)throw Error("ItemSpeed must be >0 and <=60 seconds per step.");
        e.seconds=seconds;return {value:0};
      }
      if(e.erased || !e.enabled)throw Error("Item is erased or inactive.");
      if(name!=="pushitem")throw Error("Unsupported entity service: "+name);
      const steps=String(args[1]).toLowerCase().replaceAll(" ","").split(","),flags=Number(args[2] ?? 0);
      if(!Number.isInteger(flags)||flags<0||flags>3)throw Error("Unsupported movement flags; supported: PAUSE_THREAD=1, CLEAR_QUEUE=2.");
      if(steps.length>128 || steps.some(s=>!directions[s]))throw Error("Invalid or excessive PushItem directions.");
      if(flags&2)e.queue=[];
      if(e.queue.length+steps.length>128)throw Error("Item movement queue limit (128) exceeded.");
      const mode=artifacts.get(scene.mainPath)?.configuration?.cursor?.pixelMovement;
      // Verified GAM movement mode: 2 = pixel push (8px), 0/1 = tile push (32px).
      const step=mode===2?8:[0,1].includes(mode)?32:null;
      if(step===null)throw Error("Unsupported or missing GAM push movement mode.");
      const end=e.queue.at(-1) ?? e.position;
      let x=end.x,y=end.y;
      for(const s of steps){const [dx,dy,facing]=directions[s];x+=dx*step;y+=dy*step;e.queue.push({x,y,facing});}
      const token=generation,owner=task && (flags&1)?++e.waitOwner:null;
      const ready=()=>destroyed || token!==generation || (owner!==null && owner!==e.waitOwner) || e.erased || !e.queue.length;
      const result={value:0};
      if(task)return {...result,...(flags&1?{ready}: {})};
      return new Promise((resolve,reject)=>waiters.add({ready,resolve:()=>resolve(result),reject}));
    },
    tick(seconds,modal=false) {
      if(destroyed || !scene)return;
      for(const e of entities) {
        e.moving=false;
        if(e.erased || !e.enabled || modal || !e.queue.length)continue;
        const target=e.queue[0],dx=target.x-e.position.x,dy=target.y-e.position.y,distance=Math.hypot(dx,dy);
        const amount=Math.min(distance,32/e.seconds*Math.max(0,Math.min(seconds,0.05)));
        const count=Math.max(1,Math.ceil(amount/4));e.facing=target.facing;e.blocked=false;
        if(!worlds.has(e.position.layer))worlds.set(e.position.layer,{...scene.world,dynamicEntities:undefined,
          vectorCollision:compileBoardVectorCollision(artifacts.get(scene.boardPath),e.position.layer)});
        const world=worlds.get(e.position.layer);
        for(let i=0;i<count && distance;i++) {
          const x=e.position.x+dx/distance*amount/count,y=e.position.y+dy/distance*amount/count;
          const overlaps=api.visible.some(other=>other!==e && other.position.layer===e.position.layer && Math.hypot(x-other.position.x,y-other.position.y)<18) ||
            (actor?.layer===e.position.layer && Math.hypot(x-actor.x,y-actor.y)<18);
          if(circleBlocked(world,x,y)||overlaps){e.blocked=true;e.queue=[];break;}
          e.position.x=x;e.position.y=y;e.moving=amount>0;
        }
        if(!e.blocked && amount>=distance)e.queue.shift();
        e.animationMs=e.moving?e.animationMs+Math.min(seconds,0.05)*1000:0;
      }
      for(const w of waiters)if(w.ready()){waiters.delete(w);w.resolve();}
    },
    destroy(){destroyed=true;cancel();entities=[];},
  };
  return api;
}
