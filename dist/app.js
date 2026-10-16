import * as THREE from './assets/three.module.js';
import {createPhysics} from './assets/physics.js';
import {RoomEnvironment} from './assets/RoomEnvironment.js';
const $=id=>document.getElementById(id);
const poster=new URLSearchParams(location.search).has('poster');if(poster)document.body.classList.add('poster');
try{
async function loadAsset(name){
 const response=await fetch(`assets/${name}.bin`);
 if(!response.ok)throw Error(`Cannot load ${name} (${response.status})`);
 if(!globalThis.DecompressionStream)throw Error('This browser needs an update to open the 3D scene');
 return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
const [robot,data,control,lab,extras]=await Promise.all(['robot','parts','control','lab','extras'].map(loadAsset));
const modelResponse=await fetch('assets/model.xml.gz');if(!modelResponse.ok)throw Error('Cannot load physics model');
const xml=await new Response(modelResponse.body.pipeThrough(new DecompressionStream('gzip'))).text();
const physics=await createPhysics(xml,control);
const view=$('view'),renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xe4eae4);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;view.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.02,15);camera.up.set(0,0,1);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
const detailCamera=new THREE.PerspectiveCamera(32,4/3,.02,15);detailCamera.up.set(0,0,1);
const inset=$('inset');let insetEnabled=true,currentView='wide';
function geo(v,i){let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(i);g.computeVertexNormals();return g}
const nodes=new Map();for(const link of robot.links){const n=new THREE.Group();n.matrixAutoUpdate=false;scene.add(n);nodes.set(link.name,n);for(const p of link.meshes){let g=geo(p.vertices,p.triangles);for(const a of p.groups||[])g.addGroup(a.start,a.count,a.materialIndex);let mats=(p.materials||[{color:p.color}]).map(m=>new THREE.MeshStandardMaterial({color:new THREE.Color(...m.color),roughness:.43,metalness:.3,side:THREE.DoubleSide}));let mesh=new THREE.Mesh(g,mats);mesh.castShadow=true;mesh.receiveShadow=true;n.add(mesh)}}
const [board,peg]=data.parts.map((p,i)=>{let m=new THREE.Mesh(geo(p.vertices,p.faces),new THREE.MeshStandardMaterial({color:i?0xcf8e3c:0x5f7d92,roughness:.55,metalness:0,flatShading:true,side:THREE.DoubleSide}));m.castShadow=true;m.receiveShadow=true;scene.add(m);return m});board.position.fromArray(robot.scene.board_position);
function box(size,pos,col){let m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color:col,roughness:.8}));m.position.fromArray(pos);m.receiveShadow=true;scene.add(m);return m}
// The bamboo mesh owns the top surface. Remove the box's coincident top
// face so orbiting cannot make the depth buffer alternate between colors.
const tableBody=box(robot.scene.table.size,robot.scene.table.position,0xb99968);
const tableGeometry=tableBody.geometry,tableIndices=tableGeometry.index.array,tableNormals=tableGeometry.attributes.normal;
const tableSides=[];
for(let i=0;i<tableIndices.length;i+=3){
 if(tableNormals.getZ(tableIndices[i])<.9)tableSides.push(...tableIndices.slice(i,i+3));
}
tableGeometry.setIndex(tableSides);tableGeometry.clearGroups();
const bamboo=await new THREE.TextureLoader().loadAsync('assets/bamboo.png');bamboo.colorSpace=THREE.SRGBColorSpace;bamboo.wrapS=bamboo.wrapT=THREE.RepeatWrapping;bamboo.anisotropy=8;
for(const item of lab){if(item.name==='MinusYDarkCurtain')continue;let g;if(item.type==='Cube')g=new THREE.BoxGeometry(item.size,item.size,item.size);else if(item.type==='Cylinder'){g=new THREE.CylinderGeometry(item.radius,item.radius,item.height,40);if(item.axis==='Z')g.rotateX(Math.PI/2);else if(item.axis==='X')g.rotateZ(Math.PI/2)}else if(item.type==='Sphere')g=new THREE.SphereGeometry(item.radius,24,16);else{g=geo(item.vertices,item.indices);if(item.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(item.uv,2))}let m=new THREE.MeshStandardMaterial({...item.material,color:new THREE.Color(...item.material.color),side:THREE.DoubleSide});if(item.name==='BambooTop'){m.map=bamboo;m.color.set(0xffffff)}const mesh=new THREE.Mesh(g,m);mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(item.matrix);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh)}
const fixture=new THREE.Mesh(geo(extras.peg_fixture.vertices,extras.peg_fixture.indices),new THREE.MeshStandardMaterial({color:0x333e43,flatShading:true,roughness:.8}));fixture.position.fromArray(control.fixture.position);fixture.rotation.z=control.fixture.yaw;fixture.castShadow=true;fixture.receiveShadow=true;scene.add(fixture);
// Visual wrist-camera assembly. It follows the wrist; it is not a calibrated sensor.
const wristCamera=new THREE.Group();nodes.get(robot.tcp_link).add(wristCamera);
function cameraBox(size,pos,color){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.3}));m.position.set(...pos);m.castShadow=true;wristCamera.add(m);return m}
cameraBox([.10,.032,.006],[.043,0,.038],0x22282b);cameraBox([.042,.042,.023],[.085,0,.055],0x83918f);cameraBox([.037,.036,.003],[.085,0,.068],0x171c21);
for(let y of [-.011,.011]){let lens=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.003,24),new THREE.MeshStandardMaterial({color:0x14293a,metalness:.5,roughness:.16}));lens.rotation.x=Math.PI/2;lens.position.set(.085,y,.071);wristCamera.add(lens)}
let floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xd7d9d5,roughness:1}));floor.position.z=-.765;floor.receiveShadow=true;scene.add(floor);
scene.add(new THREE.HemisphereLight(0xf6fff4,0x3a3d39,.9));let key=new THREE.DirectionalLight(0xfff6ea,2.4);key.position.set(1.4,.6,2.4);key.target.position.set(.35,-.1,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-1.3,right:1.3,top:1.3,bottom:-1.3,near:.1,far:6});key.shadow.bias=-.0003;key.shadow.normalBias=.002;scene.add(key,key.target);let fill=new THREE.DirectionalLight(0xdfe8ff,.6);fill.position.set(-1,1.5,1.2);scene.add(fill);
function mat(p,q){return new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion(...q).normalize(),new THREE.Vector3(1,1,1))}
const base=mat(robot.root_position,robot.root_quaternion_xyzw),joints=robot.joints.map(j=>({...j,f:mat(j.localPos0,j.localRot0),g:mat(j.localPos1,j.localRot1).invert(),axisV:new THREE.Vector3(...({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]})[j.axis])}));
function pose(q){let a=new Map(robot.trace_joint_names.map((n,i)=>[n,q[i]])),t=new Map([[robot.root_link,base]]);for(let j of joints){let rot=new THREE.Matrix4();if(j.type==='revolute')rot.makeRotationAxis(j.axisV,a.get(j.name));t.set(j.body1,t.get(j.body0).clone().multiply(j.f).multiply(rot).multiply(j.g))}for(let [n,m]of t)nodes.get(n).matrix.copy(m)}

const presets={wide:{yaw:25,tilt:25,distance:2.8,target:[.38,-.02,.16]},robot:{yaw:20,tilt:27,distance:1.8,target:[.40,-.05,.23]},close:{yaw:29,tilt:30,distance:.66,target:[.45364,-.24612,.12]},top:{yaw:0,tilt:85,distance:1.85,target:[.38,-.04,.05]}};
let yaw=25,tilt=25,distance=2.8,target=new THREE.Vector3(.38,-.02,.16),time=poster?31:0,playing=!poster&&!matchMedia('(prefers-reduced-motion: reduce)').matches,last=null,tween=null,hasLooped=false;
const duration=physics.duration,loop=duration+.45;
$('scrub').max=duration;
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),pegCenter=new THREE.Vector3();
function cameraPose(){let y=yaw*Math.PI/180,t=tilt*Math.PI/180;const d=distance*Math.max(1,.95/camera.aspect);camera.position.set(target.x+d*Math.cos(t)*Math.cos(y),target.y+d*Math.cos(t)*Math.sin(y),target.z+d*Math.sin(t));camera.lookAt(target)}
function frame(){
 const shown=Math.max(0,Math.min(time,duration)),state=physics.seek(shown);
 pose(state.q);peg.position.fromArray(state.peg);peg.quaternion.fromArray(state.quat);
 $('time').textContent=Math.floor(shown/60)+':'+Math.floor(shown%60).toString().padStart(2,'0');$('scrub').value=shown;
 let opacity=0;
 if(playing){if(time>duration)opacity=Math.max(opacity,(time-duration)/.45);if(hasLooped&&time<.35)opacity=Math.max(opacity,1-time/.35)}
 $('fade').style.opacity=opacity;cameraPose();draw();
}
function draw(){
 const w=view.clientWidth,h=view.clientHeight;
 renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.render(scene,camera);
 inset.hidden=!insetEnabled||currentView==='close';
 if(inset.hidden)return;
 const r=inset.getBoundingClientRect(),v=view.getBoundingClientRect();
 detailCamera.aspect=r.width/r.height;detailCamera.updateProjectionMatrix();
 pegCenter.set(0,0,.075).applyQuaternion(peg.quaternion).add(peg.position);
 detailCamera.position.copy(pegCenter).add(new THREE.Vector3(.34,.20,.20));detailCamera.lookAt(pegCenter);
 renderer.setScissorTest(true);renderer.setScissor(r.left-v.left,v.bottom-r.bottom,r.width,r.height);
 renderer.setViewport(r.left-v.left,v.bottom-r.bottom,r.width,r.height);renderer.render(scene,detailCamera);renderer.setScissorTest(false);
}
$('inset-toggle').onclick=()=>{insetEnabled=!insetEnabled;$('inset-toggle').setAttribute('aria-pressed',String(insetEnabled));frame()};
function playLabel(){$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation')}
$('play').onclick=()=>{playing=!playing;last=null;playLabel();frame()};$('restart').onclick=()=>{time=0;hasLooped=false;frame()};$('scrub').oninput=e=>{time=Math.max(0,Math.min(duration,+e.target.value));playing=false;hasLooped=false;playLabel();frame()};
function setView(id){currentView=id;for(let n of Object.keys(presets))$(n).classList.toggle('selected',n===id);const p=presets[id];tween={elapsed:0,start:{yaw,tilt,distance,target:target.clone()},end:p};if(matchMedia('(prefers-reduced-motion: reduce)').matches){yaw=p.yaw;tilt=p.tilt;distance=p.distance;target.fromArray(p.target);tween=null}frame()}
for(let n of Object.keys(presets))$(n).onclick=()=>setView(n);
new ResizeObserver(()=>{renderer.setSize(view.clientWidth,view.clientHeight,false);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();frame()}).observe(view);
let pointers=new Map(),previousPinch=null;const canvas=renderer.domElement;
canvas.onpointerdown=e=>{tween=null;pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;let old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){yaw-=(e.clientX-old[0])*.35;tilt=Math.max(5,Math.min(87,tilt+(e.clientY-old[1])*.25))}else{let [a,b]=[...pointers.values()];let d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(previousPinch)distance=Math.max(.25,Math.min(4,distance*previousPinch/d));previousPinch=d}frame()};
for(let n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,e=>{pointers.delete(e.pointerId);previousPinch=null});canvas.addEventListener('wheel',e=>{e.preventDefault();tween=null;distance=Math.max(.25,Math.min(4,distance*Math.exp(e.deltaY*.001)));frame()},{passive:false});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();playing=!playing;playLabel();frame()}});
$('loading').remove();playLabel();
function animate(now){const dt=last===null?0:Math.max(0,Math.min((now-last)/1000,.1));last=now;let changed=false;
 if(tween){tween.elapsed=Math.min(.65,tween.elapsed+dt);const u=tween.elapsed/.65,e=u*u*(3-2*u),a=tween.start,b=tween.end;yaw=a.yaw+(b.yaw-a.yaw)*e;tilt=a.tilt+(b.tilt-a.tilt)*e;distance=a.distance+(b.distance-a.distance)*e;target.copy(a.target).lerp(new THREE.Vector3(...b.target),e);if(u===1)tween=null;changed=true}
 if(playing&&!document.hidden){time+=dt*+$('speed').value;if(time>=loop){time%=loop;hasLooped=true}changed=true}if(changed)frame();requestAnimationFrame(animate)
}requestAnimationFrame(animate);
window.demoState=()=>({time,playing,inset:insetEnabled,view:currentView,meshes:scene.children.length,physics:physics.state()});
}catch(e){let notice=$('loading');if(!notice){notice=document.createElement('p');notice.id='loading';notice.setAttribute('role','alert');$('view').appendChild(notice)}notice.textContent='The 3D view could not load. '+e.message;console.error(e)}
