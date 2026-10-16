import fs from 'node:fs';import zlib from 'node:zlib';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createPhysics} from '../dist/assets/physics.js';
const root=new URL('../',import.meta.url),asset=new URL('dist/assets/',root);
const xml=zlib.gunzipSync(fs.readFileSync(new URL('model.xml.gz',asset))).toString();
const control=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('control.bin',asset))));
assert.equal(xml,fs.readFileSync(new URL('source/model.xml',root),'utf8'));
assert.deepEqual(control,JSON.parse(fs.readFileSync(new URL('source/control.json',root))));
const sim=await createPhysics(xml,control),runs=[];
for(let run=0;run<2;run++){
 sim.reset();assert.equal(sim.state().seatedAt,null,'Reset must clear seating latch');
 assert(sim.seek(5).peg[2]>.08,'Initial pickup must lift freely');
 const lifted=sim.seek(24.4);assert(lifted.peg[2]>.15,'Regrasp must lift from fixture');
 const reference=lifted.pegInHand;let maxGripDrift=0,seated=null,seatPalm=null,minPalm=Infinity,heldTarget=null;
 for(let tick=12201;tick<=Math.round(control.duration/.002);tick++){
  sim.step();const s=sim.state();
  assert(s.q.concat(s.peg,s.quat).every(Number.isFinite));
  assert(!s.blocked,'Nominal cycle must not time out');
  if(s.seatedAt===null)maxGripDrift=Math.max(maxGripDrift,Math.hypot(...s.pegInHand.map((v,i)=>v-reference[i])));
  if(s.seatedAt!==null&&seated===null){seated=s.seatedAt;seatPalm=s.palm[2];heldTarget=s.armTarget;}
  if(seated!==null&&s.time<=seated+control.seating.holdSeconds+control.seating.openSeconds){
   assert.deepEqual(s.armTarget,heldTarget,'Arm must stop descending while releasing the seated peg');minPalm=Math.min(minPalm,s.palm[2]);
  }
 }
 const end=sim.state();
 assert(seated!==null,'Support contact must confirm seating');
 assert(maxGripDrift<.002,'Held peg displacement must stay below 2 mm before seating');
 assert(seatPalm-minPalm<.0005,'Post-seat downward travel must stay below 0.5 mm');
 assert(Math.hypot(end.peg[0]-.45364,end.peg[1]+.24612)<.001,'Peg must enter hole');
 assert(end.peg[2]>=0&&end.peg[2]<.001,'Peg must remain seated after hand withdraws');
 assert(end.palm[2]>seatPalm+.18,'Hand must withdraw after opening');
 assert(end.fingerContacts===0,'Withdrawn fingers must not touch peg');
 assert(end.maxPenetration<.001,'Peg contact penetration must remain below 1 mm');
 runs.push({seatedAt:seated,maxGripDrift_m:maxGripDrift,postSeatDescent_m:seatPalm-minPalm,end});
}
sim.dispose();
const released=structuredClone(control);for(let i=240;i<released.controls.length;i++)released.controls[i][6]=.05;
const free=await createPhysics(xml,released);const dropped=free.seek(8);assert(dropped.peg[2]<.035,'Opening fingers must release the free peg');free.dispose();
// Loss of seating confirmation must never become a timed successful release.
const missingContact=structuredClone(control);missingContact.seating.supportGeom=-1;
const blocked=await createPhysics(xml,missingContact);const held=blocked.seek(35.5),endBlocked=blocked.seek(control.duration);
assert(endBlocked.blocked&&endBlocked.seatedAt===null);assert.equal(endBlocked.jawTarget,.72);assert.deepEqual(endBlocked.armTarget,held.armTarget);
blocked.dispose();
const hashes=Object.fromEntries(['dist/assets/physics.js','source/model.xml','source/control.json'].map(path=>[path,crypto.createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex')]));
const result={engine:'MuJoCo 3.16.0 WASM',passed:true,runs,earlyRelease:dropped,missingSeatConfirmation:{passed:true,blocked:endBlocked.blocked,jawTarget:endBlocked.jawTarget},hashes,scope:'Nominal presentation scene, contact-driven seating/release, and missing-confirmation failure path. Approximate model; no learned policy, hardware calibration, or general robustness claim.'};
fs.writeFileSync(new URL('source/validation.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,runs:runs.map(({seatedAt,maxGripDrift_m,postSeatDescent_m})=>({seatedAt,maxGripDrift_m,postSeatDescent_m})),earlyRelease:true,missingSeatConfirmation:true}));
