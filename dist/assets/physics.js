import loadMujoco from './mujoco.js';
export async function createPhysics(xml,control){
 const mj=await loadMujoco({locateFile:name=>new URL(name,import.meta.url).href});
 const model=mj.MjModel.from_xml_string(xml),data=new mj.MjData(model),dt=.002;
 const initialControl=control.initial.slice(0,7),seat=control.seating,grip=control.grip;
 const jaw=control.actuatorIds[6];
 let step=0,seatedAt=null,held=null,blocked=false,maxPenetration=0;
 const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)};
 function planned(time){
  const n=Math.max(0,Math.round(time/dt)),frame=Math.min(Math.floor(n/10),control.controls.length-1),sub=n%10;
  const a=frame===0?initialControl:control.controls[frame-1],b=control.controls[frame];
  return b.map((v,i)=>a[i]+(v-a[i])*(sub+1)/10);
 }
 function reset(){
  mj.mj_resetData(model,data);
  for(let i=0;i<12;i++)data.qpos[control.jointAddresses[i]]=control.initial[i];
  for(let i=0;i<7;i++)data.ctrl[control.actuatorIds[i]]=initialControl[i];
  mj.mj_forward(model,data);step=0;seatedAt=null;held=null;blocked=false;maxPenetration=0;
 }
 function contactState(){
  let supported=false;const fingers=new Set();
  if(!seat)return {supported,fingers:0};
  const contacts=data.contact;
  for(let i=0;i<contacts.size();i++){
   const c=contacts.get(i),a=c.geom1,b=c.geom2;
   if(a===seat.pegGeom||b===seat.pegGeom){
    const other=a===seat.pegGeom?b:a;
    maxPenetration=Math.max(maxPenetration,-c.dist);
    if(other===seat.supportGeom&&c.efc_address>=0)supported=true;
    if(seat.fingerGeoms.includes(other)&&c.efc_address>=0)fingers.add(other);
   }
   c.delete();
  }
  contacts.delete();
  return {supported,fingers:fingers.size};
 }
 function advance(){
  const t=step*dt,target=planned(t);
  if(grip){const limit=t>=grip.switchTime?grip.insertionTorque:grip.initialTorque;model.actuator_forcerange[jaw*2]=-limit;model.actuator_forcerange[jaw*2+1]=limit}
  if(seatedAt!==null){
   const elapsed=t-seatedAt;
   for(let i=0;i<6;i++)target[i]=held[i];
   target[6]=held[6]+(.05-held[6])*smooth((elapsed-seat.holdSeconds)/seat.openSeconds);
   const retreat=elapsed-seat.holdSeconds-seat.openSeconds;
   if(retreat>0){
    const base=planned(seat.retreatStart),next=planned(seat.retreatStart+Math.min(retreat,seat.retreatSeconds));
    for(let i=0;i<6;i++)target[i]+=next[i]-base[i];
   }
  }else if(seat&&t>=seat.deadline){
   // A missed seat is a failed cycle: never open the hand on a timer.
   if(!held)held=control.actuatorIds.map(i=>data.ctrl[i]);
   for(let i=0;i<7;i++)target[i]=held[i];blocked=true;
  }
  for(let i=0;i<7;i++)data.ctrl[control.actuatorIds[i]]=target[i];
  mj.mj_step(model,data);step++;
  const contact=contactState();
  if(seat&&seatedAt===null&&!blocked&&step*dt>=seat.startTime){
   const p=control.pegBodyId*3,q=control.pegBodyId*4;
   const upright=1-2*(data.xquat[q+1]**2+data.xquat[q+2]**2);
   if(contact.supported&&data.xpos[p+2]<=seat.height&&data.xpos[p+2]>=-.0002&&Math.hypot(data.xpos[p]-seat.hole[0],data.xpos[p+1]-seat.hole[1])<=seat.xyTolerance&&upright>=seat.minUpright){
    seatedAt=step*dt;held=target.slice();
   }
  }
 }
 function state(){
  const i=control.pegBodyId,p=Array.from(data.xpos.subarray(i*3,i*3+3));
  let palm=null,pegInHand=null;
  if(seat){
   palm=Array.from(data.xpos.subarray(seat.palmBody*3,seat.palmBody*3+3));
   const r=data.xmat.subarray(seat.palmBody*9,seat.palmBody*9+9),v=p.map((x,j)=>x-palm[j]);
   pegInHand=[0,1,2].map(j=>r[j]*v[0]+r[j+3]*v[1]+r[j+6]*v[2]);
  }
  return {q:control.jointAddresses.map(a=>data.qpos[a]),peg:p,quat:[data.xquat[i*4+1],data.xquat[i*4+2],data.xquat[i*4+3],data.xquat[i*4]],time:step*dt,palm,pegInHand,seatedAt,blocked,maxPenetration,armTarget:control.actuatorIds.slice(0,6).map(i=>data.ctrl[i]),jawTarget:data.ctrl[jaw],fingerContacts:contactState().fingers};
 }
 function seek(time){const target=Math.round(Math.min(control.duration,Math.max(0,time))/dt);if(target<step)reset();while(step<target)advance();return state()}
 reset();return {state,seek,reset,step:advance,duration:control.duration,dispose(){data.delete();model.delete()}};
}
