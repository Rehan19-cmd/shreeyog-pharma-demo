// =====================================================================
// 3D stage — a procedurally modelled stainless-steel "clean plant":
// process vessel, recirculation pump, sanitary piping, the brand gear
// and a wall-mounted pass box. The camera travels between keyframes
// driven by scroll position (stage value 0 … 6).
// =====================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeOutBack = (t) => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const FLOOR = -2.2;
const PASSBOX = V(20, -0.1, 0);

// ------------------------------------------------------------------ textures
function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const brushedMap = () => {
  const t = canvasTexture(64, 1024, (g, w, h) => {
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = 95 + Math.random() * 90;
      g.fillStyle = `rgba(${v},${v},${v},0.55)`;
      g.fillRect(0, y, w, 1);
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const radialTexture = (inner, outer) => canvasTexture(256, 256, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, w);
});

// ------------------------------------------------------------------ environment (clean-room light panels reflected in steel)
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: 0x0b1628, side: THREE.BackSide })));
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  // ceiling luminaires
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) panel(3.4, 1.1, 0xffffff, 7, V(x * 7, 7.9, z * 7), [Math.PI / 2, 0, 0]);
  // coloured wall strips — teal and brand blue
  panel(1.4, 10, 0x2fd6e6, 2.2, V(-14.9, 1, -4), [0, Math.PI / 2, 0]);
  panel(1.4, 10, 0x2f6dff, 2.6, V(14.9, 1, 3), [0, -Math.PI / 2, 0]);
  // vertical white wall luminaires give the steel crisp neutral streaks
  for (const z of [-8, 0, 8]) { panel(0.8, 9, 0xffffff, 3.2, V(-14.8, 1, z + 2), [0, Math.PI / 2, 0]); panel(0.8, 9, 0xffffff, 3.2, V(14.8, 1, z - 2), [0, -Math.PI / 2, 0]); }
  panel(9, 3.5, 0xdfe9ff, 1.6, V(0, 2, -14.9), [0, 0, 0]);
  panel(6, 2.5, 0x9fc3ff, 1.1, V(3, 0, 14.9), [0, Math.PI, 0]);
  // dark floor so undersides stay moody
  panel(30, 30, 0x1a2638, 1, V(0, -7.9, 0), [-Math.PI / 2, 0, 0]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

// ------------------------------------------------------------------ materials
function buildMaterials() {
  const brushed = brushedMap();
  return {
    steel: new THREE.MeshPhysicalMaterial({ color: 0xd3d9df, metalness: 1, roughness: 0.52, roughnessMap: brushed, envMapIntensity: 1.15 }),
    steelSoft: new THREE.MeshPhysicalMaterial({ color: 0xc0c7ce, metalness: 1, roughness: 0.62, roughnessMap: brushed, envMapIntensity: 1 }),
    polished: new THREE.MeshPhysicalMaterial({ color: 0xe6edf4, metalness: 1, roughness: 0.07, envMapIntensity: 1.3 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.85, roughness: 0.42 }),
    blue: new THREE.MeshPhysicalMaterial({ color: 0x1b64d8, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
    teal: new THREE.MeshPhysicalMaterial({ color: 0x1aa3b5, metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.85, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 2.2, depthWrite: false }),
    wall: new THREE.MeshStandardMaterial({ color: 0x1a2b40, metalness: 0.35, roughness: 0.55 }),
    wallLine: new THREE.MeshStandardMaterial({ color: 0x0b1524, metalness: 0.3, roughness: 0.7 }),
  };
}

// ------------------------------------------------------------------ process vessel
function vesselProfile(R, H, D) {
  const pts = [new THREE.Vector2(0.001, -H / 2 - D)];
  for (let i = 1; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * R, -H / 2 - Math.cos(a) * D)); }
  for (let i = 1; i <= 10; i++) pts.push(new THREE.Vector2(R, -H / 2 + (i / 10) * H));
  for (let i = 1; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * R, H / 2 + Math.sin(a) * D)); }
  pts[pts.length - 1].x = 0.001;
  return pts;
}

function nameplateTexture() {
  return canvasTexture(1024, 400, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#dfe6ee'); grd.addColorStop(0.5, '#f4f7fa'); grd.addColorStop(1, '#cfd8e2');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7d8b9b'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#7d8b9b';
    for (const [x, y] of [[44, 44], [w - 44, 44], [44, h - 44], [w - 44, h - 44]]) { g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill(); }
    g.fillStyle = '#12304f';
    g.font = '700 78px Sora, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.fillText('SHREEYOG PHARMA', w / 2, 158);
    g.fillStyle = '#1a7f8e';
    g.font = '600 64px Sora, "Segoe UI", sans-serif';
    g.fillText('EQUIPMENTS', w / 2, 238);
    g.fillStyle = '#4a5b6e';
    g.font = '500 34px "JetBrains Mono", Consolas, monospace';
    g.fillText('S.S FABRICATION  ·  KHALAPUR, RAIGAD', w / 2, 320);
  });
}

function buildVessel(M, { detailed = true } = {}) {
  const g = new THREE.Group();
  const R = 1, H = 2.1, D = 0.42;
  const dishY = (r) => H / 2 + D * Math.sqrt(Math.max(0, 1 - (r / R) ** 2));

  const shell = new THREE.Mesh(new THREE.LatheGeometry(vesselProfile(R, H, D), 128), M.steel);
  g.add(shell);

  // cooling jacket band
  const jacket = new THREE.LatheGeometry([
    new THREE.Vector2(R, -0.62), new THREE.Vector2(R + 0.05, -0.56), new THREE.Vector2(R + 0.05, 0.72), new THREE.Vector2(R, 0.78),
  ], 128);
  g.add(new THREE.Mesh(jacket, M.steelSoft));

  // weld seams
  const seam = new THREE.TorusGeometry(R + 0.004, 0.013, 8, 128);
  for (const y of [-H / 2, H / 2]) {
    const s = new THREE.Mesh(seam, M.polished);
    s.rotation.x = Math.PI / 2; s.position.y = y;
    g.add(s);
  }
  const jseam = new THREE.TorusGeometry(R + 0.052, 0.01, 8, 128);
  for (const y of [-0.56, 0.72]) {
    const s = new THREE.Mesh(jseam, M.polished);
    s.rotation.x = Math.PI / 2; s.position.y = y;
    g.add(s);
  }

  // legs with levelling ball feet
  const legLen = (-H / 2 - 0.05) - FLOOR;
  const legGeo = new THREE.CylinderGeometry(0.055, 0.055, legLen, 20);
  const footGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.05, 24);
  const padGeo = new RoundedBoxGeometry(0.2, 0.34, 0.06, 2, 0.02);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * (Math.PI / 2);
    const x = Math.sin(a) * 0.9, z = Math.cos(a) * 0.9;
    const leg = new THREE.Mesh(legGeo, M.steel);
    leg.position.set(x, FLOOR + legLen / 2, z);
    g.add(leg);
    const foot = new THREE.Mesh(footGeo, M.polished);
    foot.position.set(x, FLOOR + 0.025, z);
    g.add(foot);
    const pad = new THREE.Mesh(padGeo, M.steelSoft);
    pad.position.set(Math.sin(a) * (R + 0.02), -H / 2 + 0.12, Math.cos(a) * (R + 0.02));
    pad.rotation.y = a;
    g.add(pad);
  }

  // bottom outlet
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 20), M.steel);
  outlet.position.y = -H / 2 - D - 0.08;
  g.add(outlet);

  // agitator drive: mounting flange + gearbox + motor
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 40), M.polished);
  flange.position.y = dishY(0) + 0.02;
  g.add(flange);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.24, 32), M.steelSoft);
  lantern.position.y = dishY(0) + 0.17;
  g.add(lantern);
  const gearbox = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.26, 0.42, 3, 0.05), M.blue);
  gearbox.position.y = dishY(0) + 0.42;
  g.add(gearbox);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 40), M.blue);
  motor.position.y = dishY(0) + 0.8;
  g.add(motor);
  if (detailed) {
    const fin = new THREE.BoxGeometry(0.02, 0.42, 0.06);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const f = new THREE.Mesh(fin, M.blue);
      f.position.set(Math.sin(a) * 0.215, dishY(0) + 0.8, Math.cos(a) * 0.215);
      f.rotation.y = a;
      g.add(f);
    }
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 40), M.darkSteel);
  cap.position.y = dishY(0) + 1.09;
  g.add(cap);

  // manway with clamp knobs
  const mx = 0.52, mz = 0.12, mr = Math.hypot(mx, mz);
  const manway = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 40), M.steel);
  manway.position.set(mx, dishY(mr) + 0.06, mz);
  g.add(manway);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 40), M.polished);
  lid.position.set(mx, dishY(mr) + 0.18, mz);
  g.add(lid);
  const knob = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const k = new THREE.Mesh(knob, M.darkSteel);
    k.position.set(mx + Math.cos(a) * 0.25, dishY(mr) + 0.2, mz + Math.sin(a) * 0.25);
    g.add(k);
  }

  // sanitary nozzles with tri-clamp ferrules
  const nozzles = [[-0.42, 0], [0.05, 0.55], [-0.3, -0.45]];
  const nozGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.24, 20);
  const ferGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.045, 28);
  const nozzleTops = [];
  for (const [x, z] of nozzles) {
    const r = Math.hypot(x, z);
    const n = new THREE.Mesh(nozGeo, M.steel);
    n.position.set(x, dishY(r) + 0.08, z);
    g.add(n);
    const f = new THREE.Mesh(ferGeo, M.polished);
    f.position.set(x, dishY(r) + 0.2, z);
    g.add(f);
    nozzleTops.push(V(x, dishY(r) + 0.22, z));
  }

  // side nozzle (to the holding tank) and sight glass
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 20), M.steel);
  side.rotation.z = Math.PI / 2;
  side.position.set(-R - 0.12, -0.84, 0);
  g.add(side);
  const sideF = new THREE.Mesh(ferGeo, M.polished);
  sideF.rotation.z = Math.PI / 2;
  sideF.position.set(-R - 0.26, -0.84, 0);
  g.add(sideF);

  const sight = new THREE.Group();
  sight.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 32), M.polished));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), new THREE.MeshStandardMaterial({ color: 0x06121e, emissive: 0x1fb6c9, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.2 }));
  lens.rotation.x = -Math.PI / 2; lens.position.y = 0.041;
  sight.add(lens);
  const sa = -0.9;
  sight.position.set(Math.sin(sa) * (R + 0.03), 0.3, Math.cos(sa) * (R + 0.03));
  sight.lookAt(sight.position.clone().multiplyScalar(2).setY(0.3));
  sight.rotateX(Math.PI / 2);
  g.add(sight);

  // curved nameplate on the shell
  if (detailed) {
    const plateGeo = new THREE.CylinderGeometry(R + 0.058, R + 0.058, 0.3, 32, 1, true, -0.4, 0.8);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ map: nameplateTexture(), metalness: 0.6, roughness: 0.32, side: THREE.FrontSide }));
    plate.position.y = 0.06;
    plate.name = 'nameplate';
    g.add(plate);
  }

  g.userData.nozzleTops = nozzleTops;
  return g;
}

// ------------------------------------------------------------------ pump
function buildPump(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.44, 2, 0.02), M.steelSoft);
  base.position.set(0.28, -0.2, 0);
  g.add(base);
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 36), M.polished);
  volute.rotation.z = Math.PI / 2;
  g.add(volute);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 32), M.steel);
  bell.rotation.z = Math.PI / 2; bell.position.x = 0.15;
  g.add(bell);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.52, 36), M.blue);
  motor.rotation.z = Math.PI / 2; motor.position.x = 0.48;
  g.add(motor);
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 36), M.darkSteel);
  fan.rotation.z = Math.PI / 2; fan.position.x = 0.79;
  g.add(fan);
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.16, 2, 0.02), M.blue);
  box.position.set(0.48, 0.2, 0);
  g.add(box);
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20), M.steel);
  outlet.position.set(0, 0.25, 0);
  g.add(outlet);
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20), M.steel);
  inlet.rotation.z = Math.PI / 2; inlet.position.set(-0.13, 0, 0);
  g.add(inlet);
  return g;
}

// ------------------------------------------------------------------ gear (brand mark)
function gearGeometry(teeth, rOuter, rRoot, rHole, depth) {
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [[rRoot, a], [rRoot, a + step * 0.2], [rOuter, a + step * 0.34], [rOuter, a + step * 0.66], [rRoot, a + step * 0.8]];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, rHole, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 64 });
  geo.center();
  return geo;
}

// ------------------------------------------------------------------ piping
function pipePath(points, bend) {
  const path = new THREE.CurvePath();
  const clamps = [];
  let prev = points[0].clone();
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (i < points.length - 1) {
      const dIn = p.clone().sub(points[i - 1]).normalize();
      const dOut = points[i + 1].clone().sub(p).normalize();
      const a = p.clone().addScaledVector(dIn, -bend);
      const b = p.clone().addScaledVector(dOut, bend);
      path.add(new THREE.LineCurve3(prev, a));
      clamps.push({ pos: a.clone(), dir: dIn.clone(), curve: path.curves.length - 1, end: true });
      path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
      clamps.push({ pos: b.clone(), dir: dOut.clone(), curve: path.curves.length, end: false });
      prev = b;
    } else {
      path.add(new THREE.LineCurve3(prev, p.clone()));
    }
  }
  const lengths = path.getCurveLengths();
  const total = path.getLength();
  for (const c of clamps) {
    const before = c.curve > 0 ? lengths[c.curve - 1] : 0;
    c.t = (c.end ? lengths[c.curve] : before) / total;
  }
  clamps.push({ pos: points[points.length - 1].clone(), dir: points[points.length - 1].clone().sub(points[points.length - 2]).normalize(), t: 1 });
  return { path, clamps, total };
}

function buildPipes(M, routes) {
  const group = new THREE.Group();
  const runs = [];
  const zAxis = V(0, 0, 1);
  for (const r of routes) {
    const { path, clamps, total } = pipePath(r.points, r.bend || 0.22);
    const segs = Math.max(24, Math.ceil(total * 26));
    const geo = new THREE.TubeGeometry(path, segs, r.radius, 18, false);
    const mesh = new THREE.Mesh(geo, r.material || M.steel);
    mesh.geometry.setDrawRange(0, 0);
    group.add(mesh);

    const clampGeo = new THREE.TorusGeometry(r.radius * 1.12, r.radius * 0.32, 8, 24);
    const inst = new THREE.InstancedMesh(clampGeo, M.polished, clamps.length);
    const dummy = new THREE.Object3D();
    clamps.forEach((c, i) => {
      dummy.position.copy(c.pos);
      dummy.quaternion.setFromUnitVectors(zAxis, c.dir);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    group.add(inst);
    runs.push({ mesh, inst, clamps, delay: r.delay || 0, speed: r.speed || 1, count: geo.index.count, last: -1, dummy });
  }

  const setGrowth = (g) => {
    for (const run of runs) {
      const p = clamp((g - run.delay) * run.speed / Math.max(0.001, 1 - run.delay));
      if (Math.abs(p - run.last) < 0.0005) continue;
      run.last = p;
      const tris = Math.floor((run.count / 3) * p) * 3;
      run.mesh.geometry.setDrawRange(0, tris);
      run.mesh.visible = tris > 0;
      run.clamps.forEach((c, i) => {
        const s = p >= c.t - 0.002 ? 1 : 0;
        run.dummy.position.copy(c.pos);
        run.dummy.quaternion.setFromUnitVectors(zAxis, c.dir);
        run.dummy.scale.setScalar(s);
        run.dummy.updateMatrix();
        run.inst.setMatrixAt(i, run.dummy.matrix);
      });
      run.inst.instanceMatrix.needsUpdate = true;
    }
  };
  return { group, setGrowth };
}

function buildValve(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), M.polished);
  body.scale.set(1.3, 1, 1);
  g.add(body);
  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 24), M.steel);
  bonnet.position.y = 0.18;
  g.add(bonnet);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), M.polished);
  stem.position.y = 0.34;
  g.add(stem);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 10, 32), M.teal);
  wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.4;
  g.add(wheel);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), M.teal);
    spoke.rotation.z = Math.PI / 2; spoke.rotation.y = (i / 3) * Math.PI;
    spoke.position.y = 0.4;
    g.add(spoke);
  }
  return g;
}

// ------------------------------------------------------------------ pass box
function interiorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.35, 20, w / 2, h / 2, w * 0.75);
    grd.addColorStop(0, '#9fe7ff'); grd.addColorStop(0.35, '#2a7ccc'); grd.addColorStop(1, '#06101d');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // inner box perspective edges
    g.strokeStyle = 'rgba(200,240,255,0.35)'; g.lineWidth = 3;
    const i = 110;
    g.strokeRect(i, i, w - 2 * i, h - 2 * i);
    for (const [x1, y1, x2, y2] of [[0, 0, i, i], [w, 0, w - i, i], [0, h, i, h - i], [w, h, w - i, h - i]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    // perforated shelf
    g.fillStyle = 'rgba(200,230,255,0.22)';
    g.fillRect(i - 40, h - i - 10, w - 2 * i + 80, 14);
  });
}

function labelTexture(text) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = '#0a1320'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#82e3ec';
    g.font = '600 40px "JetBrains Mono", Consolas, monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, 26, h / 2 + 2);
  });
}

function buildPassBox(M) {
  const g = new THREE.Group();
  const W = 1.7, H = 1.5, Dp = 1.4;
  const front = Dp / 2;

  // clean-room wall with modular panel joints
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 0.2), M.wall);
  wall.position.set(0, 0.6, -0.35);
  g.add(wall);
  const joints = [];
  for (const x of [-3, -1.5, 1.5, 3]) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.03, 6, 0.02), M.wallLine);
    j.position.set(x, 0.6, -0.24);
    g.add(j);
    joints.push(j);
  }
  const trim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.24, H + 0.24, 0.08, 2, 0.03), M.polished);
  trim.position.set(0, 0, -0.22);
  g.add(trim);

  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, Dp, 5, 0.06), M.steel);
  body.position.z = 0.2;
  g.add(body);

  // glowing interior seen through the door glass
  const interior = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.02), new THREE.MeshBasicMaterial({ map: interiorTexture(), toneMapped: false }));
  interior.position.set(0, -0.08, front + 0.2 + 0.002);
  g.add(interior);

  // door (pivots on its left edge)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.66, -0.08, front + 0.2 + 0.03);
  const door = new THREE.Group();
  door.position.x = 0.66;
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.05, 2, 0.015), M.polished);
    m.position.set(x, y, 0);
    door.add(m);
  };
  bar(1.32, 0.12, 0, 0.55); bar(1.32, 0.12, 0, -0.55); bar(0.12, 1.22, -0.6, 0); bar(0.12, 1.22, 0.6, 0);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.98), M.glass);
  pane.position.z = 0.005;
  door.add(pane);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), M.polished);
  handle.position.set(0.5, 0, 0.07);
  door.add(handle);
  for (const y of [0.16, -0.16]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8), M.polished);
    post.rotation.x = Math.PI / 2; post.position.set(0.5, y, 0.045);
    door.add(post);
  }
  doorPivot.add(door);
  g.add(doorPivot);

  // control strip with status LEDs
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture('PASS BOX · INTERLOCK'), toneMapped: false }));
  strip.position.set(-0.12, 0.66, front + 0.2 + 0.004);
  g.add(strip);
  const leds = [];
  const ledGeo = new THREE.CircleGeometry(0.028, 20);
  [[0x3ddc97, 0.62], [0xffb23d, 0.72]].forEach(([c, x]) => {
    const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    led.position.set(x, 0.66, front + 0.2 + 0.006);
    g.add(led);
    leds.push(led);
  });

  // a sealed parcel that travels through when an enquiry is sent
  const parcel = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.3, 0.34, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0xeaf2fb, roughness: 0.5, metalness: 0.05 }));
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.31, 0.07), M.teal);
  parcel.add(tape);
  parcel.position.set(0, -0.35, 0);
  parcel.visible = false;
  g.add(parcel);

  const glow = new THREE.PointLight(0x7fd4ff, 0, 4, 2);
  glow.position.set(0, 0, front + 0.6);
  g.add(glow);

  return { group: g, doorPivot, leds, parcel, interior, glow, wall, joints };
}

// =====================================================================
export function createScene(canvas, { mobile = false, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  scene.fog = new THREE.FogExp2(0x050b16, 0.04);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const M = buildMaterials();

  // lights: key + coloured rims + a travelling sweep light for moving highlights
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 6);
  scene.add(key, new THREE.HemisphereLight(0x8fb8ff, 0x050b16, 0.35));
  const rimTeal = new THREE.PointLight(0x2fd6e6, 9, 14, 2);
  rimTeal.position.set(-4, 2.5, -2);
  const rimBlue = new THREE.PointLight(0x2f6dff, 10, 16, 2);
  rimBlue.position.set(4.5, 1, -3);
  const sweep = new THREE.PointLight(0xffffff, 10, 7, 2);
  scene.add(rimTeal, rimBlue, sweep);

  // ---------------------------------------------------------------- the plant
  const plant = new THREE.Group();
  scene.add(plant);

  const vessel = buildVessel(M);
  plant.add(vessel);

  const tank = buildVessel(M, { detailed: false });
  tank.scale.setScalar(0.62);
  tank.position.set(-3.7, FLOOR - FLOOR * 0.62, -2.4);
  tank.rotation.y = 0.8;
  plant.add(tank);

  const pump = buildPump(M);
  pump.position.set(2.5, -1.95, 0.9);
  plant.add(pump);

  const valves = [buildValve(M), buildValve(M)];
  valves[0].position.set(1.05, -1.95, 0);
  valves[1].position.set(2.5, 0.6, 0.9);
  valves[1].rotation.z = Math.PI / 2;
  valves.forEach((v) => { v.scale.setScalar(0); plant.add(v); });

  const top = vessel.userData.nozzleTops[0];
  const pipes = buildPipes(M, [
    { points: [V(0, -1.55, 0), V(0, -1.95, 0), V(1.9, -1.95, 0), V(1.9, -1.95, 0.9), V(2.37, -1.95, 0.9)], radius: 0.07, bend: 0.2 },
    { points: [V(2.5, -1.69, 0.9), V(2.5, 2.45, 0.9), V(2.5, 2.45, 0), V(top.x, 2.45, 0), V(top.x, top.y, 0)], radius: 0.07, bend: 0.25, delay: 0.12 },
    { points: [V(-1.29, -0.84, 0), V(-2.1, -0.84, 0), V(-2.1, -0.84, -2.4), V(-3.13, -0.84, -2.4)], radius: 0.07, bend: 0.25, delay: 0.2 },
    { points: [V(-9, 3.1, -3.2), V(6, 3.1, -3.2), V(6, 3.1, -1.2), V(6, FLOOR, -1.2)], radius: 0.11, bend: 0.4, delay: 0.3, material: M.steelSoft },
    { points: [V(9, 3.5, -3.7), V(-9, 3.5, -3.7)], radius: 0.13, delay: 0.38, material: M.blue },
    { points: [V(-5.5, 3.5, -3.7), V(-5.5, 1.2, -3.7), V(-5.5, 1.2, -1.2), V(-5.5, FLOOR, -1.2)], radius: 0.08, bend: 0.3, delay: 0.5, material: M.blue },
  ]);
  plant.add(pipes.group);

  // brand gear pair behind the vessel
  const gearBig = new THREE.Mesh(gearGeometry(20, 2.45, 2.15, 1.55, 0.32), M.blue);
  gearBig.position.set(1.7, 1.1, -4.3);
  const gearSmall = new THREE.Mesh(gearGeometry(10, 1.2, 0.92, 0.45, 0.28), M.polished);
  const meshDir = V(Math.cos(-0.62), Math.sin(-0.62), 0);
  gearSmall.position.copy(gearBig.position).addScaledVector(meshDir, 2.15 + 0.92 + 0.14);
  gearSmall.position.z -= 0.05;
  plant.add(gearBig, gearSmall);

  // soft light pooling behind the hero object
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(60,140,255,0.55)', 'rgba(60,140,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.set(0.6, 0.6, -3);
  halo.scale.set(10, 10, 1);
  plant.add(halo);

  // floor: blueprint grid + contact shadows
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x5fc8ff) }, uCenterA: { value: new THREE.Vector2(0.5, 0) }, uCenterB: { value: new THREE.Vector2(PASSBOX.x, 0) }, uFade: { value: new THREE.Vector2(11, 7) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform vec3 uColor; uniform vec2 uCenterA; uniform vec2 uCenterB; uniform vec2 uFade; varying vec3 vW;
      float grid(vec2 p, float s, float w){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
      void main(){
        float dA = length(vW.xz - uCenterA);
        float dB = length(vW.xz - uCenterB);
        float fade = max(smoothstep(uFade.x, 1.5, dA), smoothstep(uFade.y, 1.0, dB));
        float g = max(grid(vW.xz, 1.0, 1.0) * 0.28, grid(vW.xz, 4.0, 1.4) * 0.55);
        float glow = smoothstep(5.0, 0.0, dA) * 0.07;
        gl_FragColor = vec4(uColor, (g * fade + glow) * 0.55);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(8, FLOOR - 0.001, 0);
  scene.add(floor);

  const shadowTex = radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');
  const shadow = (x, z, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, FLOOR + 0.002, z);
    scene.add(m);
    return m;
  };
  shadow(0, 0, 3.6);
  const pumpShadow = shadow(2.8, 0.9, 1.8);
  const tankShadow = shadow(-3.7, -2.4, 2.4);

  // ---------------------------------------------------------------- pass box stage
  const pb = buildPassBox(M);
  pb.group.position.copy(PASSBOX);
  scene.add(pb.group);

  // ---------------------------------------------------------------- clean-air particles (laminar downflow)
  const COUNT = 700;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const speed = new Float32Array(COUNT);
  const X0 = -11, X1 = 27, Y0 = FLOOR, Y1 = 6.5, Z0 = -7, Z1 = 6;
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = lerp(X0, X1, Math.random());
    pos[i * 3 + 1] = lerp(Y0, Y1, Math.random());
    pos[i * 3 + 2] = lerp(Z0, Z1, Math.random());
    speed[i] = 0.08 + Math.random() * 0.22;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.055, map: radialTexture('rgba(190,245,255,1)', 'rgba(190,245,255,0)'),
    transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  scene.add(particles);

  // ---------------------------------------------------------------- camera keyframes
  // t = look-at target, r = distance, th = azimuth, ph = polar angle
  const BASE = [
    { t: V(-2.9, 0.45, 0), r: 11.5, th: 0.22, ph: 1.47 },              // 0 hero
    { t: V(-1.75, 0.1, 0.5), r: 6.3, th: 0.18, ph: 1.53 },          // 1 nameplate / certified MOC
    { t: V(-1.4, -0.9, 0.3), r: 5.8, th: 0.95, ph: 1.72 },          // 2 weld seams, low angle
    { t: V(-1.4, 1.3, 0.1), r: 6.2, th: 0.75, ph: 0.95 },           // 3 sanitary fittings from above
    { t: V(-2.7, 0.4, 0), r: 11, th: 0.35, ph: 1.36 },                  // 4 whole vessel
    { t: V(0.9, 1.7, -0.6), r: 17, th: 0.62, ph: 1.05 },            // 5 plant overview
    { t: V(PASSBOX.x - 2.6, -1.15, 0.2), r: 8.6, th: -0.3, ph: 1.47 },   // 6 pass box
  ];
  let KEYS = BASE;

  // Each keyframe's object is fitted into a screen region that the page layout leaves free
  // (measured live in main.js), so the 3D can never sit behind text on any screen size.
  // t = centre of what must fit, w / h = its size in scene units (w 0 = may overflow sideways).
  // Laptops: the free space beside the text; the plant overview stays a full-screen backdrop.
  const DESK = [
    { region: 'hero', t: V(0, 0.2, 0), w: 2.8, h: 4.9 },
    { region: 'showcase', t: V(0.1, 0.1, 0.5), w: 2.5, h: 3.0 },
    { region: 'showcase', t: V(0.2, -0.9, 0.3), w: 2.6, h: 3.2 },
    { region: 'showcase', t: V(0, 1.3, 0.1), w: 2.6, h: 3.0 },
    { region: 'showcase', t: V(0, 0.2, 0), w: 2.8, h: 4.9 },
    null,
    { region: 'enquiry', t: V(PASSBOX.x, -0.1, 0.25), w: 2.3, h: 2.1 },
  ];
  // Phones / portrait tablets: a reserved box per moment; drawn only inside it (see frame()).
  const PHONE = [
    { region: 'hero', t: V(0, 0.35, -0.3), h: 5.3, w: 4.9 },
    { region: 'showcase', t: V(0, 0.35, 0), h: 5.3, w: 4.9 },
    { region: 'showcase', t: V(0, 0.3, 0), h: 5.4, w: 4.9, ph: 1.68 },
    { region: 'showcase', t: V(0, 0.55, 0), h: 5.2, w: 4.9, th: -0.6, ph: 1.0 },
    { region: 'showcase', t: V(0, 0.35, 0), h: 5.3, w: 4.9, th: -0.5 },
    { region: 'services', t: V(0.3, 0.6, -1.0), h: 7.8, w: 0, ph: 1.1 },
    { region: 'enquiry', t: V(PASSBOX.x, -0.05, 0.1), h: 3.5, w: 4.3 },
  ];
  let boxProvider = null;   // () => { phone, hero, showcase, services?, enquiry } rects
  let phoneMode = false;
  const view = { w: 1, h: 1 };

  function applyMode(phone) {
    if (phone === phoneMode) return;
    phoneMode = phone;
    gearSmall.visible = !phone;
    if (phone) { gearBig.position.set(0, 0.45, -3.2); halo.position.set(0, 0.4, -3); halo.scale.set(7, 7, 1); }
    else { gearBig.position.set(1.7, 1.1, -4.3); halo.position.set(0.6, 0.6, -3); halo.scale.set(10, 10, 1); }
    pb.wall.scale.set(phone ? 0.46 : 1, phone ? 0.56 : 1, 1);
    pb.wall.position.y = phone ? -0.05 : 0.6;
    pb.joints.forEach((j) => { j.visible = !phone; });
    floorMat.uniforms.uFade.value.set(phone ? 6 : 11, phone ? 3.2 : 7);
  }

  const anchors = {
    nameplate: V(0, 0.06, 1.06),
    seam: V(Math.sin(0.7) * 1.01, -1.05, Math.cos(0.7) * 1.01),
    fitting: vessel.userData.nozzleTops[1].clone(),
    motor: V(0, 2.55, 0),
  };

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    view.w = w; view.h = h;
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 40 : 35;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- state
  let targetStage = 0;
  let stage = 0;
  let active = true;
  let time = 0;
  let pulseT = -1;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const frameCallbacks = new Set();
  const camTarget = V(0, 0, 0);
  const tmp = V(0, 0, 0);

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  // Phones: tilting the device moves the 3D the way the mouse does on a laptop
  // (only where no permission prompt is needed).
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.x = clamp(e.gamma / 25, -1, 1);
      pointer.y = clamp((e.beta - 50) / 25, -1, 1);
    }, { passive: true });
  }

  // Showcase hotspots are only valid inside the showcase box on phones.
  const clip = { top: 0, bottom: 0, on: false };
  let viewShifted = false;

  /** Camera for keyframe i: fitted into its layout region when one is available. */
  function keyAt(i, regions, defs) {
    const base = KEYS[i];
    const def = defs[i];
    const rect = def && regions && regions[def.region];
    if (!rect || rect.width < 8 || rect.height < 8) return { t: base.t, r: base.r, th: base.th, ph: base.ph, ox: 0, oy: 0 };
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const byH = def.h / (2 * tanV * Math.max(0.08, rect.height / view.h) * 0.92);
    const byW = def.w ? def.w / (2 * tanV * camera.aspect * Math.max(0.05, rect.width / view.w) * 0.92) : 0;
    return {
      t: def.t, r: Math.max(byH, byW), th: def.th ?? base.th, ph: def.ph ?? base.ph,
      // shift the rendered image so the object is centred in (and moves with) its region
      ox: rect.left + rect.width / 2 - view.w / 2,
      oy: rect.top + rect.height / 2 - view.h / 2,
    };
  }

  /** Point the camera at keyframe value s (fractional values blend neighbouring keyframes). */
  function applyCamera(s, regions = null, defs = DESK) {
    const i = clamp(Math.floor(s), 0, KEYS.length - 1);
    const j = Math.min(i + 1, KEYS.length - 1);
    const f = s - i;
    const a = keyAt(i, regions, defs), b = keyAt(j, regions, defs);
    const ox = lerp(a.ox, b.ox, f), oy = lerp(a.oy, b.oy, f);
    if (Math.abs(ox) + Math.abs(oy) > 0.5) {
      camera.setViewOffset(view.w, view.h, -ox, -oy, view.w, view.h);
      viewShifted = true;
    } else if (viewShifted) {
      viewShifted = false;
      camera.clearViewOffset();
    }
    camTarget.lerpVectors(a.t, b.t, f);
    const r = lerp(a.r, b.r, f);
    const th = lerp(a.th, b.th, f) + pointer.sx * 0.06 + (reducedMotion ? 0 : Math.sin(time * 0.15) * 0.03);
    const ph = lerp(a.ph, b.ph, f) + pointer.sy * 0.035;
    camera.position.set(
      camTarget.x + r * Math.sin(ph) * Math.sin(th),
      camTarget.y + r * Math.cos(ph),
      camTarget.z + r * Math.sin(ph) * Math.cos(th),
    );
    camera.lookAt(camTarget);
  }

  function update(dt) {
    time += dt;
    stage = damp(stage, targetStage, reducedMotion ? 12 : 3.6, dt);
    pointer.sx = damp(pointer.sx, pointer.x, 2.5, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 2.5, dt);

    // plant assembly as the overview approaches
    const grow = smooth(4.15, 4.95, stage);
    pipes.setGrowth(grow);
    const pop = (a, b) => easeOutBack(smooth(a, b, grow));
    const sPump = pop(0.0, 0.35);
    pump.scale.setScalar(Math.max(0.0001, sPump));
    pumpShadow.scale.setScalar(Math.max(0.0001, sPump));
    const sTank = pop(0.15, 0.5);
    tank.scale.setScalar(Math.max(0.0001, 0.62 * sTank));
    tank.position.y = FLOOR - FLOOR * 0.62 * sTank;
    tankShadow.scale.setScalar(Math.max(0.0001, sTank));
    valves[0].scale.setScalar(Math.max(0.0001, pop(0.35, 0.6)));
    valves[1].scale.setScalar(Math.max(0.0001, pop(0.55, 0.8)));

    // gears turn continuously, faster while scrolling
    const spin = reducedMotion ? 0 : dt * (0.12 + Math.min(2, Math.abs(targetStage - stage) * 3));
    gearBig.rotation.z += spin;
    gearSmall.rotation.z -= spin * (20 / 10);

    // travelling highlight across the steel
    sweep.position.set(Math.cos(time * 0.5) * 3.2, 1.2 + Math.sin(time * 0.35) * 1.4, Math.sin(time * 0.5) * 3.2);

    // particles drift down with the laminar air flow
    if (!reducedMotion) {
      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= speed[i] * dt;
        arr[i * 3] += Math.sin(time * 0.6 + i) * 0.0015;
        if (arr[i * 3 + 1] < Y0) arr[i * 3 + 1] = Y1;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    // pass box: door opens on arrival; parcel passes through after an enquiry is sent
    let open = smooth(5.45, 5.95, stage) * 0.55;
    if (pulseT >= 0) {
      pulseT += dt;
      const t = pulseT;
      open = Math.max(open, smooth(0, 0.6, t) * 1.35 * (1 - smooth(3.2, 4, t)));
      pb.parcel.visible = t > 0.3 && t < 3.4;
      pb.parcel.position.z = lerp(-0.1, 2.3, smooth(0.5, 2.6, t));
      pb.parcel.position.y = -0.35 + Math.sin(smooth(0.5, 2.6, t) * Math.PI) * 0.12;
      pb.parcel.rotation.y = smooth(0.5, 2.6, t) * 0.6;
      pb.glow.intensity = Math.sin(clamp(t / 3) * Math.PI) * 12;
      if (t > 4.2) { pulseT = -1; pb.parcel.visible = false; pb.glow.intensity = 0; }
    }
    pb.doorPivot.rotation.y = -open;
    pb.leds[0].visible = true;
    pb.leds[1].visible = open > 0.05 ? Math.sin(time * 8) > 0 : false;
  }

  // ---------------------------------------------------------------- loop
  let lastT = performance.now();
  let raf = 0;
  let firstFrame;
  const ready = new Promise((res) => { firstFrame = res; });

  function frame() {
    raf = requestAnimationFrame(frame);
    const nowT = performance.now();
    const dt = Math.min((nowT - lastT) / 1000, 0.1);
    lastT = nowT;
    if (!active || document.hidden) return;
    update(dt);
    const regions = boxProvider?.();
    const boxes = regions?.phone ? regions : null;
    applyMode(!!boxes);
    if (boxes) {
      // Phones: each box shows its own moment of the story and is drawn only inside itself.
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      clip.on = true;
      clip.top = clip.bottom = -1;
      for (const [key, s] of [['hero', 0], ['services', 5], ['enquiry', 6], ['showcase', clamp(stage, 1, 4)]]) {
        const r = boxes[key];
        if (!r || r.height < 2 || r.bottom <= 0 || r.top >= view.h) continue;
        applyCamera(s, boxes, PHONE);
        const top = Math.max(0, r.top), bottom = Math.min(view.h, r.bottom);
        renderer.setScissor(0, view.h - bottom, view.w, bottom - top);
        renderer.render(scene, camera);
        if (key === 'showcase') { clip.top = r.top; clip.bottom = r.bottom; }
      }
      renderer.setScissorTest(false);
    } else {
      clip.on = false;
      applyCamera(stage, regions, DESK);
      renderer.render(scene, camera);
    }
    for (const fn of frameCallbacks) fn();
    if (firstFrame) { firstFrame(); firstFrame = null; }
  }

  layout();
  window.addEventListener('resize', layout);
  // redraw the nameplate once web fonts are available
  document.fonts?.ready.then(() => {
    const plate = vessel.getObjectByName('nameplate');
    if (plate) { plate.material.map.dispose(); plate.material.map = nameplateTexture(); plate.material.needsUpdate = true; }
  });
  frame();

  return {
    ready,
    setStage(s) { targetStage = s; },
    jumpTo(s) { targetStage = stage = s; },
    setActive(v) { active = v; },
    /** Phone layout: fn returns { hero, showcase, services, enquiry } box rects, or null on desktop. */
    setBoxProvider(fn) { boxProvider = fn; },
    onFrame(fn) { frameCallbacks.add(fn); return () => frameCallbacks.delete(fn); },
    /** Screen position (CSS px) of a named 3D anchor. */
    project(name) {
      tmp.copy(anchors[name]).project(camera);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const y = (1 - tmp.y) / 2 * h;
      const inClip = !clip.on || (y > clip.top && y < clip.bottom);
      return { x: (tmp.x + 1) / 2 * w, y, visible: inClip && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 };
    },
    get stage() { return stage; },
    pulse() { pulseT = 0; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
