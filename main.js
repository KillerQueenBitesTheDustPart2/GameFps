
// Mobile FPS Prototype - Three.js + cannon-es (via unpkg)
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// Basic globals
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
renderer.setPixelRatio(window.devicePixelRatio ? Math.min(1.5, window.devicePixelRatio) : 1);
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();

// Sunset-ish ambient
scene.background = new THREE.Color(0xffc9a3);
const hemi = new THREE.HemisphereLight(0xffeedd, 0x442200, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffd8a8, 1.1);
dir.position.set(-5,10,4);
scene.add(dir);

// Camera (player)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 500);
camera.position.set(0,1.6,0);

// Simple ground and arena
const floorGeo = new THREE.PlaneGeometry(200,200);
const floorMat = new THREE.MeshStandardMaterial({color:0x7b4f2c});
const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI/2; scene.add(floor);

// Simple boxes/cover
function addBox(x,y,z,sx,sy,sz){
  const g = new THREE.BoxGeometry(sx,sy,sz);
  const m = new THREE.MeshStandardMaterial({color:0x90623b});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(x,y,z); scene.add(mesh);
  return mesh;
}
addBox(0,0.75,-8,3,1.5,1);
addBox(3,1,-6,1.5,2,1.5);
addBox(-3,1.2,-6,1.5,2.4,1.5);

// Simple skybox gradient via large sphere
const skyGeo = new THREE.SphereGeometry(400,32,15);
const skyMat = new THREE.MeshBasicMaterial({color:0xffb88c, side:THREE.BackSide});
const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

// Physics world (cannon-es)
const world = new CANNON.World({gravity: new CANNON.Vec3(0,-9.82,0)});
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(groundBody);

// Player physics (capsule-ish)
const player = {
  body: null,
  speed: 5,
  sprintSpeed: 9,
  yaw: 0,
  pitch: 0,
  hp: 100,
  score: 0
};
const playerBody = new CANNON.Body({ mass: 80, shape: new CANNON.Sphere(0.35), position: new CANNON.Vec3(0,1.2,8) });
playerBody.fixedRotation = true;
world.addBody(playerBody);
player.body = playerBody;

// Enemies (simple boxes that fall when killed)
const enemies = [];
function spawnEnemy(x,z){
  const g = new THREE.BoxGeometry(0.8,1.6,0.5);
  const m = new THREE.MeshStandardMaterial({color:0x5a2b2b});
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(x,0.8,z); scene.add(mesh);
  const body = new CANNON.Body({ mass: 20, shape: new CANNON.Box(new CANNON.Vec3(0.4,0.8,0.25)), position: new CANNON.Vec3(x,0.8,z) });
  world.addBody(body);
  enemies.push({mesh,body,alive:true,hp:50});
}
spawnEnemy(-2,-12); spawnEnemy(2,-14); spawnEnemy(5,-10);

// Resize
function onWindowResize(){ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', onWindowResize, false);
onWindowResize();

// Simple weapon model (placeholder) - a long box as sniper
const weapon = new THREE.Group();
const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,1.2), new THREE.MeshStandardMaterial({color:0x111111}));
barrel.position.set(0,-0.05,-0.6);
weapon.add(barrel);
const body = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.08,0.6), new THREE.MeshStandardMaterial({color:0x2b2b2b}));
body.position.set(0,-0.04,-0.1);
weapon.add(body);
weapon.position.set(0.25,-0.1,-0.4);
camera.add(weapon);
scene.add(camera);

// Audio placeholders
let shootSound = null;
function playShoot(){ /* optional */ }

// Controls & UI hooks
const leftTouch = document.getElementById('leftTouch');
const rightTouch = document.getElementById('rightTouch');
const joystickThumb = document.getElementById('joystickThumb');
const btnShoot = document.getElementById('btnShoot');
const btnAim = document.getElementById('btnAim');
const btnReload = document.getElementById('btnReload');
const btnJump = document.getElementById('btnJump');
const btnSprint = document.getElementById('btnSprint');
const scope = document.getElementById('scope');
const scoreVal = document.getElementById('scoreVal');
const timeVal = document.getElementById('timeVal');
const hpVal = document.getElementById('hpVal');

let joystick = {active:false, startX:0, startY:0, x:0, y:0};
leftTouch.addEventListener('touchstart', e=>{ e.preventDefault(); joystick.active=true; const t=e.changedTouches[0]; joystick.startX=t.clientX; joystick.startY=t.clientY; }, {passive:false});
leftTouch.addEventListener('touchmove', e=>{ if(!joystick.active) return; const t=e.changedTouches[0]; joystick.x = (t.clientX - joystick.startX)/60; joystick.y = (t.clientY - joystick.startY)/60; // clamp
  joystick.x = Math.max(-1,Math.min(1,joystick.x)); joystick.y = Math.max(-1,Math.min(1,joystick.y)); joystickThumb.style.transform = `translate(${joystick.x*40}px, ${joystick.y*-40}px)`;
}, {passive:false});
leftTouch.addEventListener('touchend', e=>{ joystick.active=false; joystick.x=0; joystick.y=0; joystickThumb.style.transform='translate(0,0)'; }, {passive:false});

// Look via right touch: swipe to rotate
let lastTouch = null;
rightTouch.addEventListener('touchstart', e=>{ lastTouch = e.changedTouches[0]; }, {passive:true});
rightTouch.addEventListener('touchmove', e=>{ if(!lastTouch) return; const t = e.changedTouches[0]; const dx = t.clientX - lastTouch.clientX; const dy = t.clientY - lastTouch.clientY; lastTouch = t; player.yaw -= dx * 0.0025; player.pitch -= dy * 0.0025; player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch)); }, {passive:true});
rightTouch.addEventListener('touchend', e=>{ lastTouch = null; }, {passive:true});

// Buttons
let aiming = false;
let reloading = false;
let ammo = 5; const maxAmmo = 5;
btnAim.addEventListener('touchstart', e=>{ aiming=true; scope.hidden=false; camera.fov = 25; camera.updateProjectionMatrix(); weapon.position.set(0.05,-0.05,-0.25); }, {passive:true});
btnAim.addEventListener('touchend', e=>{ aiming=false; scope.hidden=true; camera.fov = 60; camera.updateProjectionMatrix(); weapon.position.set(0.25,-0.1,-0.4); }, {passive:true});
btnShoot.addEventListener('touchstart', e=>{ e.preventDefault(); attemptShoot(); }, {passive:false});
btnReload.addEventListener('touchstart', e=>{ e.preventDefault(); reload(); }, {passive:false});
btnJump.addEventListener('touchstart', e=>{ attemptJump(); }, {passive:true});
btnSprint.addEventListener('touchstart', e=>{ player.speed = player.sprintSpeed; }, {passive:true});
btnSprint.addEventListener('touchend', e=>{ player.speed = 5; }, {passive:true});

function reload(){ if(reloading) return; reloading=true; showMessage('Reloading...'); setTimeout(()=>{ ammo = maxAmmo; reloading=false; showMessage(''); }, 1200); }

function attemptJump(){ // small impulse
  const onGround = Math.abs(player.body.velocity.y) < 0.1;
  if(onGround) player.body.velocity.y = 6;
}

// Shoot logic (raycast + recoil)
let lastShot = 0;
function attemptShoot(){
  const now = performance.now();
  if(now - lastShot < 400) return; // fire rate
  if(ammo <= 0){ showMessage('Out of ammo'); return; }
  lastShot = now; ammo--;
  // recoil: small camera kick
  camera.rotation.x -= 0.04;
  camera.rotation.y += (Math.random()-0.5)*0.01;
  // muzzle flash quick scale
  // perform raycast from camera center
  const origin = new THREE.Vector3(); origin.setFromMatrixPosition(camera.matrixWorld);
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const ray = new THREE.Raycaster(origin, dir, 0.1, 200);
  const hits = ray.intersectObjects(scene.children, true);
  if(hits.length>0){
    const h = hits.find(x=>x.object !== weapon && x.object !== sky && x.object !== floor);
    if(h){
      // check enemies
      for(const e of enemies){
        if(e.mesh === h.object || e.mesh.children.includes(h.object)){
          e.hp -= 50;
          if(e.hp <= 0 && e.alive){
            e.alive = false;
            player.score += 10; scoreVal.textContent = player.score;
            // enable ragdoll-like: make body dynamic and let it fall
            e.body.mass = 30; e.body.updateMassProperties();
            // apply impulse at hit
            e.body.applyImpulse(new CANNON.Vec3(dir.x*8,dir.y*8,dir.z*8), e.body.position);
          }
        }
      }
    }
  }
  // small timeout muzzle etc
  setTimeout(()=>{ camera.rotation.x += 0.04; }, 120);
}

// Message helper
function showMessage(txt){ const m = document.getElementById('message'); if(!txt){ m.style.display='none'; m.textContent=''; } else { m.style.display='block'; m.textContent=txt; } }

// Game loop
let last = performance.now();
let timeLeft = 60;
function animate(){
  const now = performance.now();
  const dt = Math.min(0.05,(now-last)/1000);
  last = now;

  // physics step
  world.step(1/60, dt);

  // apply player movement from joystick (relative to camera yaw)
  const forward = new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw+Math.PI/2),0,Math.cos(player.yaw+Math.PI/2));
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -joystick.y);
  move.addScaledVector(right, joystick.x);
  // normalize and apply speed
  if(move.length() > 0.1){
    move.normalize();
    player.body.velocity.x = move.x * player.speed;
    player.body.velocity.z = move.z * player.speed;
  } else {
    // damp xz velocities
    player.body.velocity.x *= 0.9; player.body.velocity.z *= 0.9;
  }

  // camera follows player
  const ppos = player.body.position;
  camera.position.set(ppos.x, ppos.y + 0.45, ppos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  // sync enemy meshes with physics
  for(const e of enemies){
    e.mesh.position.copy(e.body.position);
    e.mesh.quaternion.copy(e.body.quaternion);
  }

  // update UI time
  timeLeft -= dt;
  if(timeLeft <= 0){ timeLeft = 0; endGame(); }
  timeVal.textContent = Math.ceil(timeLeft);
  hpVal.textContent = Math.max(0, Math.floor(player.hp));

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function endGame(){ showMessage('Time Up! Score: ' + player.score); }
