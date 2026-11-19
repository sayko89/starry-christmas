// The opening scene: a camera glides down a Christmas street at night — lit shop fronts, strings
// of lights across the road, lanterns, a crowd, reindeer made of lights, a giant tree — then rises
// past the star on top of the tree into the real starry sky.
//
// Everything is built from code (no models or image files). Most lights are drawn as glowing
// points, so a few draw calls cover thousands of bulbs and it runs on phones too.
import * as THREE from 'three';
import { starColor } from './astro.js';

const BULB_COLORS = [0xff3b3b, 0xffc845, 0x3ddc84, 0x4da6ff, 0xffe6b0, 0xff7ac8];
const WARM = 0xffd9a0;
const DURATION = 17; // seconds of camera flight

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// --- Textures drawn on canvases ----------------------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const glowTexture = () => canvasTexture(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
});

const streakTexture = () => canvasTexture(32, 128, (g) => {
  const r = g.createRadialGradient(16, 64, 0, 16, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.setTransform(0.25, 0, 0, 1, 12, 0);
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
});

const starTexture = () => canvasTexture(256, 256, (g) => {
  const glow = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,240,190,0.9)');
  glow.addColorStop(0.3, 'rgba(255,210,120,0.35)');
  glow.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 22 : 56, a = (i * Math.PI) / 5 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  const fill = g.createLinearGradient(-50, -50, 50, 50);
  fill.addColorStop(0, '#fffbe6');
  fill.addColorStop(1, '#ffc94d');
  g.fillStyle = fill;
  g.shadowColor = '#ffd77a';
  g.shadowBlur = 30;
  g.fill();
});

const sparkleTexture = () => canvasTexture(128, 128, (g) => {
  g.translate(64, 64);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(-64, -64, 128, 128);
  g.fillStyle = 'rgba(255,250,230,0.95)';
  for (const [l, w] of [[62, 3.5], [30, 2.4]]) {
    for (let r = 0; r < 2; r++) {
      g.beginPath();
      g.moveTo(0, -l); g.lineTo(w, 0); g.lineTo(0, l); g.lineTo(-w, 0); g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(-l, 0); g.lineTo(0, w); g.lineTo(l, 0); g.lineTo(0, -w); g.closePath(); g.fill();
      g.rotate(Math.PI / 4);
    }
    g.rotate(-Math.PI / 2);
  }
});

/** A night-time facade: plaster or brick, lit windows, a shop front, wreaths and garlands. */
function facadeTexture(seed, floors, cols) {
  const rand = rng(seed);
  const walls = ['#3a2a2a', '#2c2f3d', '#3b3026', '#2f3a33', '#40282c', '#33303a'];
  const W = 256, H = 64 * (floors + 1);
  return canvasTexture(W, H, (g) => {
    g.fillStyle = walls[Math.floor(rand() * walls.length)];
    g.fillRect(0, 0, W, H);
    // brick / plaster texture
    g.globalAlpha = 0.12;
    for (let y = 0; y < H; y += 6) {
      g.fillStyle = y % 12 ? '#000' : '#fff';
      g.fillRect(0, y, W, 1);
    }
    g.globalAlpha = 1;
    // cornice and floor lines
    g.fillStyle = '#d8c9a8';
    g.globalAlpha = 0.35;
    g.fillRect(0, 0, W, 6);
    for (let f = 1; f <= floors; f++) g.fillRect(0, H - 64 * f - 2, W, 3);
    g.globalAlpha = 1;
    const cw = W / cols;
    // upper floors: windows, some lit warm, some dark, some with a candle-lit wreath
    for (let f = 1; f <= floors; f++) {
      const top = H - 64 * (f + 1) + 14;
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.22, w = cw * 0.56, h = 40;
        const lit = rand() < 0.68;
        g.fillStyle = '#e9dcc0';
        g.fillRect(x - 2, top - 2, w + 4, h + 4);
        const glass = g.createLinearGradient(0, top, 0, top + h);
        glass.addColorStop(0, lit ? '#ffd38a' : '#16202e');
        glass.addColorStop(1, lit ? '#ff9f45' : '#0c121c');
        g.fillStyle = glass;
        g.fillRect(x, top, w, h);
        g.fillStyle = 'rgba(40,30,20,0.6)';
        g.fillRect(x + w / 2 - 1, top, 2, h);
        g.fillRect(x, top + h * 0.45, w, 2);
        if (rand() < 0.3) wreath(g, x + w / 2, top + h / 2, 9);
      }
    }
    // ground floor: shop windows glowing, with a green garland above
    const top = H - 58;
    g.fillStyle = '#1a1310';
    g.fillRect(0, top - 6, W, 64);
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 6, w = cw - 12;
      const glow = g.createLinearGradient(0, top, 0, top + 52);
      glow.addColorStop(0, '#ffe2a8');
      glow.addColorStop(1, '#ff9a3c');
      g.fillStyle = glow;
      g.fillRect(x, top + 4, w, 50);
      // little displays: gift boxes in the window
      for (let k = 0; k < 3; k++) {
        g.fillStyle = ['#c8102e', '#1f6b45', '#d4a64a'][Math.floor(rand() * 3)];
        const bw = 6 + rand() * 8;
        g.fillRect(x + 4 + rand() * (w - 16), top + 54 - bw, bw, bw);
      }
    }
    // garland swags with coloured dots
    g.strokeStyle = '#1f5a36';
    g.lineWidth = 5;
    for (let c = 0; c < cols; c++) {
      g.beginPath();
      g.moveTo(c * cw, top - 4);
      g.quadraticCurveTo(c * cw + cw / 2, top + 10, (c + 1) * cw, top - 4);
      g.stroke();
      for (let k = 1; k < 5; k++) {
        const t = k / 5, px = c * cw + cw * t, py = top - 4 + 28 * t * (1 - t) * 1.0;
        g.fillStyle = ['#ff4b4b', '#ffd25c', '#5fb2ff', '#fff'][k % 4];
        g.beginPath();
        g.arc(px, py, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    // awning
    if (rand() < 0.6) {
      for (let x = 0; x < W; x += 16) {
        g.fillStyle = (x / 16) % 2 ? '#e9e2d0' : '#a3122a';
        g.fillRect(x, top - 22, 16, 12);
      }
    }
  });
}

function wreath(g, x, y, r) {
  g.strokeStyle = '#1f6b45';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#d0102c';
  g.beginPath();
  g.moveTo(x, y + r);
  g.lineTo(x - 5, y + r + 6);
  g.lineTo(x + 5, y + r + 6);
  g.fill();
}

// --- Lights as point clouds ---------------------------------------------------------------------

/** Collects bulbs (position, colour, size class) and turns them into a few THREE.Points. */
class Bulbs {
  constructor() { this.sets = new Map(); }
  add(x, y, z, color, size = 0.35) {
    if (!this.sets.has(size)) this.sets.set(size, { pos: [], col: [] });
    const s = this.sets.get(size);
    const c = new THREE.Color(color);
    s.pos.push(x, y, z);
    s.col.push(c.r, c.g, c.b);
  }
  build(texture) {
    const group = new THREE.Group();
    for (const [size, { pos, col }] of this.sets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      group.add(new THREE.Points(geo, mat));
    }
    return group;
  }
}

/** Points along a polyline, `step` metres apart. */
function along(points, step) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(points[points.length - 1]);
  return out;
}

// Light-sculpture outlines, side view facing forward (+u), in metres. [u, v] = [forward, up]
const ellipse = (cx, cy, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});

const REINDEER = [
  ellipse(0, 1.25, 0.75, 0.32), // body
  [[0.55, 1.45], [0.82, 1.86]], [[0.72, 1.2], [0.98, 1.66]],
  [[0.82, 1.86], [1.0, 1.9], [1.3, 1.76], [1.3, 1.66], [0.98, 1.64]],
  [[0.88, 1.9], [0.78, 2.03], [0.95, 1.95]],
  [[0.9, 1.92], [0.78, 2.3], [0.55, 2.52]], [[0.8, 2.2], [0.98, 2.38]], [[0.66, 2.42], [0.72, 2.66]],
  [[0.96, 1.92], [0.94, 2.32], [0.76, 2.6]], [[0.94, 2.22], [1.12, 2.4]],
  [[0.52, 0.98], [0.58, 0.52], [0.52, 0]], [[0.34, 0.96], [0.44, 0.5], [0.3, 0]],
  [[-0.52, 1.0], [-0.58, 0.52], [-0.48, 0]], [[-0.34, 0.96], [-0.24, 0.5], [-0.36, 0]],
  [[-0.74, 1.36], [-0.9, 1.48]],
];

const SLEIGH = {
  red: [
    [[-1.3, 0.48], [1.0, 0.48]],
    [[-1.3, 0.48], [-1.38, 1.3], [-1.22, 1.55], [-1.0, 1.5], [-0.95, 1.0]],
    [[-0.95, 1.0], [0.55, 0.98], [0.95, 1.05], [1.15, 0.82], [1.0, 0.48]],
  ],
  gold: [
    [[-1.4, 0.1], [1.05, 0.1], [1.35, 0.3], [1.4, 0.62], [1.22, 0.78]],
    [[-0.8, 0.1], [-0.8, 0.48]], [[0.6, 0.1], [0.6, 0.48]],
  ],
  gifts: [[[-0.6, 1.0], [-0.6, 1.45], [-0.1, 1.45], [-0.1, 1.0]], [[0.0, 1.0], [0.0, 1.3], [0.4, 1.3], [0.4, 1.0]],
    [[-0.35, 1.45], [-0.35, 1.75], [0.05, 1.75], [0.05, 1.45]]],
};

// --- The scene -----------------------------------------------------------------------------------

export function createIntro(canvas, { stars = [], reducedMotion = false, fixedProgress = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070d1a');
  scene.fog = new THREE.FogExp2('#0b1526', 0.0145);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1200);

  scene.add(new THREE.HemisphereLight('#4a5f8a', '#5a3a20', 1.6));
  const glow = glowTexture();
  const bulbs = new Bulbs();
  const reflections = []; // [x, z, color, length]
  const rand = rng(1225);

  // ground: wet street and sidewalks
  const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 220), new THREE.MeshBasicMaterial({ color: '#1a2131' }));
  street.rotation.x = -Math.PI / 2;
  street.position.z = -40;
  scene.add(street);
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.16, 220), new THREE.MeshBasicMaterial({ color: '#30353f' }));
    walk.position.set(side * 8.5, 0.08, -40);
    scene.add(walk);
  }
  // snow along the kerbs
  for (const side of [-1, 1]) {
    const bank = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 200, 4, 8), new THREE.MeshBasicMaterial({ color: '#c9d4e6' }));
    bank.rotation.x = Math.PI / 2;
    bank.scale.set(1, 1, 0.45);
    bank.position.set(side * 7.1, 0.12, -40);
    scene.add(bank);
  }

  // buildings on both sides, with outlines of warm lights along their roofs
  const darkSide = new THREE.MeshBasicMaterial({ color: '#141821' });
  for (const side of [-1, 1]) {
    let z = 48;
    let n = 0;
    while (z > -46) {
      const depth = 7 + rand() * 5, floors = 2 + Math.floor(rand() * 3), cols = 3 + Math.floor(rand() * 2);
      const height = 3.4 * (floors + 1);
      const tex = facadeTexture(side * 100 + n, floors, cols);
      const front = new THREE.MeshBasicMaterial({ map: tex, color: '#a7abb8' });
      const mats = side < 0 ? [front, darkSide, darkSide, darkSide, darkSide, darkSide]
        : [darkSide, front, darkSide, darkSide, darkSide, darkSide];
      const x = side * (10 + 4 + rand() * 0.8);
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, height, depth), mats);
      b.position.set(x, height / 2, z - depth / 2);
      scene.add(b);
      const fx = x - side * 4; // facade plane
      for (let k = 0; k <= 1; k += 1 / Math.round(depth / 0.45)) bulbs.add(fx - side * 0.05, height + 0.05, z - depth * k, WARM, 0.3);
      for (let y = 0.5; y < height; y += 0.45) bulbs.add(fx - side * 0.05, y, z - 0.05, WARM, 0.3);
      // a big wreath on some facades
      if (rand() < 0.45) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 24), new THREE.MeshLambertMaterial({ color: '#1f6b45' }));
        w.position.set(fx - side * 0.2, 3.4 * 1.6, z - depth / 2);
        w.rotation.y = Math.PI / 2;
        scene.add(w);
        const bow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: '#c8102e', emissive: '#4a0010' }));
        bow.position.set(fx - side * 0.35, 3.4 * 1.6 - 0.75, z - depth / 2);
        scene.add(bow);
        for (let a = 0; a < 18; a++) {
          const t = (a / 18) * Math.PI * 2;
          bulbs.add(fx - side * 0.45, 3.4 * 1.6 + Math.sin(t) * 0.75, z - depth / 2 + Math.cos(t) * 0.75, BULB_COLORS[a % 4], 0.25);
        }
      }
      z -= depth;
      n++;
    }
  }

  // strings of lights across the street, every other one with a big snowflake in the middle
  for (let z = 34, i = 0; z > -44; z -= 8.5, i++) {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, x = -10 + 20 * t, y = 8.2 - 2.2 * 4 * t * (1 - t);
      pts.push(new THREE.Vector3(x, y, z));
      bulbs.add(x, y - 0.12, z, BULB_COLORS[(k + i) % BULB_COLORS.length], 0.42);
      if (k % 8 === 4 && z < 30) reflections.push([x, z + 4, BULB_COLORS[(k + i) % BULB_COLORS.length], 6]);
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#0d2a1c' })));
    if (i % 2 === 0) {
      for (let arm = 0; arm < 6; arm++) {
        const a = (arm * Math.PI) / 3;
        for (let r = 0; r <= 1.1; r += 0.11) bulbs.add(Math.sin(a) * r, 5.0 + Math.cos(a) * r, z, 0xdff0ff, 0.3);
        for (const s of [-1, 1]) {
          for (let r = 0; r <= 0.35; r += 0.11) {
            const b = a + s * 0.6;
            bulbs.add(Math.sin(a) * 0.6 + Math.sin(b) * r, 5.0 + Math.cos(a) * 0.6 + Math.cos(b) * r, z, 0xdff0ff, 0.3);
          }
        }
      }
    }
  }

  // lanterns on posts, each with a small wreath
  const postMat = new THREE.MeshLambertMaterial({ color: '#1b1d22' });
  for (const side of [-1, 1]) {
    for (let z = 38; z > -42; z -= 10) {
      const x = side * 7.6;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 8), postMat);
      post.position.set(x, 2.1, z);
      scene.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), new THREE.MeshBasicMaterial({ color: '#ffd38a' }));
      lamp.position.set(x, 4.45, z);
      scene.add(lamp);
      bulbs.add(x, 4.45, z, 0xffc777, 3.2);
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 16), new THREE.MeshLambertMaterial({ color: '#1f6b45' }));
      w.position.set(x - side * 0.12, 2.9, z);
      w.rotation.y = Math.PI / 2;
      scene.add(w);
      bulbs.add(x - side * 0.2, 2.62, z, 0xff3b3b, 0.35);
      reflections.push([side * 5.6, z + 3, 0xffc777, 8]);
    }
  }

  // reindeer and a sleigh made of lights, standing by the road
  const sculpture = (strokes, u0, side, zBase, color, scale = 1) => {
    for (const stroke of strokes) {
      for (const [u, v] of along(stroke, 0.075)) bulbs.add(side, v * scale, zBase - (u + u0) * scale, color, 0.2);
    }
  };
  sculpture(SLEIGH.red, 0, 5.6, -6, 0xff4040);
  sculpture(SLEIGH.gold, 0, 5.6, -6, 0xffc845);
  sculpture(SLEIGH.gifts, 0, 5.6, -6, 0x3ddc84);
  sculpture(REINDEER, 2.9, 5.2, -6, WARM);
  sculpture(REINDEER, 2.9, 6.1, -7.1, WARM);
  sculpture(REINDEER, 5.0, 5.2, -6, WARM);
  sculpture(REINDEER, 5.0, 6.1, -7.1, WARM);
  sculpture(REINDEER, 0, -5.6, 14, WARM, 1.05);
  sculpture(REINDEER, 1.6, -6.3, 16, WARM, 0.9);

  // the crowd watching from the pavements
  const people = 230;
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), new THREE.MeshLambertMaterial(), people);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial(), people);
  const hats = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial(), people);
  const poms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshLambertMaterial({ color: '#f2f2f2' }), people);
  const coats = ['#3a1d22', '#1d2a3a', '#2b2b2b', '#4a1a1f', '#26331f', '#3a3029', '#5a1820'];
  const hatColors = ['#b3122a', '#e8e8e8', '#1f6b45', '#2a3f73', '#b3122a', '#d9b25a'];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < people; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.3 + rand() * 2.6), z = 40 - rand() * 82;
    if (Math.abs(z + 6.6) < 3.2 && side > 0) continue; // leave room for the sleigh
    const h = rand() < 0.15 ? 0.7 : 0.92 + rand() * 0.16;
    s.set(h, h, h);
    p.set(x, 0.6 * h + 0.08, z);
    bodies.setMatrixAt(i, m.compose(p, q, s));
    bodies.setColorAt(i, new THREE.Color(coats[Math.floor(rand() * coats.length)]));
    p.set(x, 1.38 * h + 0.08, z);
    heads.setMatrixAt(i, m.compose(p, q, s));
    heads.setColorAt(i, new THREE.Color(rand() < 0.5 ? '#c79a7a' : '#8a6650'));
    p.set(x, 1.44 * h + 0.08, z);
    hats.setMatrixAt(i, m.compose(p, q, s));
    hats.setColorAt(i, new THREE.Color(hatColors[Math.floor(rand() * hatColors.length)]));
    p.set(x, 1.62 * h + 0.08, z);
    poms.setMatrixAt(i, m.compose(p, q, s));
  }
  scene.add(bodies, heads, hats, poms);

  // the Christmas tree in the square at the end of the street
  const TREE = { z: -60, h: 22, r: 6.2 };
  const treeGroup = new THREE.Group();
  treeGroup.position.z = TREE.z;
  for (let i = 0; i < 6; i++) {
    const y0 = 1 + i * 3.2, r = TREE.r * (1 - i / 6.6), h = 6.2 - i * 0.4;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 28, 1, true),
      new THREE.MeshLambertMaterial({ color: i % 2 ? '#123d27' : '#0f3321', side: THREE.DoubleSide }));
    cone.position.y = y0 + h / 2;
    treeGroup.add(cone);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 10), new THREE.MeshLambertMaterial({ color: '#3b2516' }));
  trunk.position.y = 0.8;
  treeGroup.add(trunk);
  // baubles
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshLambertMaterial({ emissive: '#220000' }), 120);
  for (let i = 0; i < 120; i++) {
    const y = 2 + rand() * 18, r = TREE.r * (1 - (y - 1) / TREE.h) * 0.98 + 0.25, a = rand() * Math.PI * 2;
    p.set(Math.cos(a) * r, y, Math.sin(a) * r);
    s.set(1, 1, 1);
    balls.setMatrixAt(i, m.compose(p, q, s));
    balls.setColorAt(i, new THREE.Color(['#c8102e', '#e8c063', '#c8102e', '#dfe8f5'][i % 4]));
  }
  treeGroup.add(balls);
  scene.add(treeGroup);
  for (let i = 0; i < 1100; i++) {
    const y = 1.6 + (i / 1100) * (TREE.h - 2.4), r = TREE.r * (1 - (y - 1) / TREE.h) + 0.15;
    const a = y * 2.3 + rand() * 0.9 + (i % 3) * 2.09;
    const color = i % 5 === 4 ? WARM : BULB_COLORS[i % 4];
    bulbs.add(Math.cos(a) * r, y, TREE.z + Math.sin(a) * r, color, 0.38);
  }
  // gold garland spiralling down the tree
  for (let i = 0; i < 500; i++) {
    const y = 2 + (i / 500) * 18, r = TREE.r * (1 - (y - 1) / TREE.h) + 0.3, a = y * 0.9;
    bulbs.add(Math.cos(a) * r, y, TREE.z + Math.sin(a) * r, 0xffd27a, 0.18);
  }
  const topStar = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  topStar.scale.set(4.6, 4.6, 1);
  topStar.position.set(0, TREE.h + 1.2, TREE.z);
  scene.add(topStar);
  reflections.push([0, TREE.z + 9, 0xffcf70, 26], [-3, TREE.z + 8, 0xff4b4b, 18], [3, TREE.z + 8, 0x3ddc84, 18]);
  // presents under the tree
  for (let i = 0; i < 14; i++) {
    const size = 0.6 + rand() * 0.8, a = (i / 14) * Math.PI * 2 + rand() * 0.3, r = TREE.r * 0.95 + rand() * 1.2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * (0.7 + rand() * 0.5), size),
      new THREE.MeshLambertMaterial({ color: ['#c8102e', '#e8c063', '#1f6b45', '#dfe8f5', '#4da6ff'][i % 5] }));
    box.position.set(Math.cos(a) * r, size * 0.4, TREE.z + Math.sin(a) * r);
    box.rotation.y = rand() * Math.PI;
    scene.add(box);
  }

  scene.add(bulbs.build(glow));

  // wet street: long soft reflections under the lights
  const refl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }),
    reflections.length);
  reflections.forEach(([x, z, color, len], i) => {
    const r = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    refl.setMatrixAt(i, m.compose(p.set(x, 0.02, z), r, s.set(1.0, len, 1)));
    refl.setColorAt(i, new THREE.Color(color));
  });
  scene.add(refl);

  // --- Camera flight ---------------------------------------------------------------------------------
  const path = new THREE.CatmullRomCurve3([
    [0, 1.7, 44], [0.6, 1.9, 24], [-0.4, 2.2, 4], [0.3, 2.8, -16], [0, 6, -34], [0, 14, -46],
    [0, 27, -54], [0, 48, -58], [0, 90, -62],
  ].map((v) => new THREE.Vector3(...v)));
  const look = new THREE.CatmullRomCurve3([
    [0, 2.4, 0], [0, 3, -20], [0, 5, -40], [0, 9, -60], [0, 18, -62], [0, 30, -64],
    [0, 70, -70], [0, 200, -85], [0, 500, -100],
  ].map((v) => new THREE.Vector3(...v)));
  // --- Sky: real stars on a sphere that follows the camera -----------------------------------------
  const sky = new THREE.Group();
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vDir; void main(){
      float h = clamp(vDir.y, -0.2, 1.0);
      vec3 horizon = vec3(0.16, 0.12, 0.16);
      vec3 low = vec3(0.04, 0.07, 0.14);
      vec3 high = vec3(0.012, 0.02, 0.05);
      vec3 c = mix(horizon, low, smoothstep(0.0, 0.18, h));
      c = mix(c, high, smoothstep(0.18, 0.9, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.add(skyDome);
  // Aim the sky so that where the camera ends up looking is the winter hexagon — Orion, Sirius,
  // Gemini, Auriga: the stars of a Christmas night.
  const eqVec = (ra, dec) => {
    const a = THREE.MathUtils.degToRad(ra), d = THREE.MathUtils.degToRad(dec);
    return new THREE.Vector3(Math.cos(d) * Math.cos(a), Math.sin(d), -Math.cos(d) * Math.sin(a));
  };
  const finalDir = look.points.at(-1).clone().sub(path.points.at(-1)).normalize();
  const aim = new THREE.Quaternion().setFromUnitVectors(eqVec(96, 14), finalDir);
  const classes = [[-2, 1.5, 14], [1.5, 3, 8], [3, 4.5, 5], [4.5, 7, 3.2]];
  for (const [lo, hi, size] of classes) {
    const pos = [], col = [];
    for (const [ra, dec, mag, bv] of stars) {
      if (mag < lo || mag >= hi) continue;
      const v = eqVec(ra, dec).applyQuaternion(aim).multiplyScalar(420);
      pos.push(v.x, v.y, v.z);
      const [r, g, b] = starColor(bv);
      const k = Math.min(1, 0.55 + (6.5 - mag) * 0.15);
      col.push((r / 255) * k, (g / 255) * k, (b / 255) * k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sky.add(new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, fog: false })));
  }
  // the Milky Way: thousands of faint points scattered about the galactic equator, plus a soft haze
  const GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.444829630, 0.7469822445],
    [-0.867666149, -0.1980763734, 0.4559837762]]; // equatorial -> galactic rotation (J2000)
  const galactic = (l, b) => {
    const g = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
    const x = GAL[0][0] * g[0] + GAL[1][0] * g[1] + GAL[2][0] * g[2];
    const y = GAL[0][1] * g[0] + GAL[1][1] * g[1] + GAL[2][1] * g[2];
    const z = GAL[0][2] * g[0] + GAL[1][2] * g[1] + GAL[2][2] * g[2];
    return eqVec(THREE.MathUtils.radToDeg(Math.atan2(y, x)), THREE.MathUtils.radToDeg(Math.asin(z)));
  };
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2;
  for (const [count, size, spread, alpha] of [[12000, 2, 0.2, 0.22], [1200, 110, 0.18, 0.0045]]) {
    const pos = [], col = [];
    for (let i = 0; i < count; i++) {
      const l = rand() * Math.PI * 2, b = gauss() * spread * (1.2 + 0.6 * Math.cos(l * 3 + 1));
      const v = galactic(l, b).applyQuaternion(aim).multiplyScalar(440);
      pos.push(v.x, v.y, v.z);
      const k = alpha * (0.5 + rand());
      col.push(0.75 * k, 0.82 * k, k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sky.add(new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, fog: false })));
  }
  // the brightest stars get a Christmas-star sparkle, like on the card
  const sparkleMat = new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false });
  for (const [ra, dec, mag] of stars.filter((st) => st[2] < 0.5)) {
    const sp = new THREE.Sprite(sparkleMat);
    sp.position.copy(eqVec(ra, dec).applyQuaternion(aim).multiplyScalar(410));
    const k = 0.05 + (0.5 - mag) * 0.02;
    sp.scale.set(k, k, 1);
    sky.add(sp);
  }
  scene.add(sky);

  // --- Snow that travels with the camera -----------------------------------------------------------
  const FLAKES = reducedMotion ? 900 : 3500;
  const box = { x: 30, y: 26, z: 50 };
  const snowPos = new Float32Array(FLAKES * 3);
  const speed = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) {
    snowPos[i * 3] = (rand() - 0.5) * box.x * 2;
    snowPos[i * 3 + 1] = (rand() - 0.5) * box.y * 2;
    snowPos[i * 3 + 2] = (rand() - 0.5) * box.z * 2;
    speed[i] = 0.7 + rand() * 0.9;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.17, map: glow, color: '#ffffff', transparent: true,
    opacity: 0.85, depthWrite: false, fog: false }));
  scene.add(snow);

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) * 0.55 + t * 0.45;

  let start = null, ended = false, onEnd = null, raf = 0, last = 0, paused = false;
  let progress = reducedMotion ? 1 : 0;
  const target = new THREE.Vector3();

  function place(t, time) {
    const u = ease(Math.min(1, t));
    camera.position.copy(path.getPoint(u));
    target.copy(look.getPoint(u));
    // a gentle hand-held sway on the street, calming as we rise
    const sway = (1 - u) * 0.08;
    target.x += Math.sin(time * 0.5) * sway * 4;
    if (camera.aspect < 1) target.y += 5 * (1 - u); // portrait phones: look a little higher, less road
    camera.position.y += Math.sin(time * 0.9) * sway;
    if (t >= 1) {
      // keep drifting slowly among the stars
      target.x += Math.sin(time * 0.05) * 60;
      target.z += Math.cos(time * 0.05) * 60;
    }
    camera.lookAt(target);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < h ? 66 : 58; // a wider view on portrait phones
      camera.updateProjectionMatrix();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const time = now / 1000;
    const dt = Math.min(0.05, last ? time - last : 0);
    last = time;
    if (start === null) start = time;
    if (!ended) {
      progress = fixedProgress ?? (reducedMotion ? 1 : Math.min(1, progress + dt / DURATION));
      if (progress >= 1 && fixedProgress === null) {
        ended = true;
        onEnd?.();
      }
    }
    resize();
    place(progress, time);
    // snow falls and wraps around the camera
    const pos = snowGeo.attributes.position.array;
    for (let i = 0; i < FLAKES; i++) {
      pos[i * 3 + 1] -= speed[i] * dt * 1.6;
      pos[i * 3] += Math.sin(time * 0.6 + i) * dt * 0.25;
      if (pos[i * 3 + 1] < -box.y) pos[i * 3 + 1] += box.y * 2;
    }
    snowGeo.attributes.position.needsUpdate = true;
    snow.position.copy(camera.position);
    sky.position.copy(camera.position);
    topStar.material.rotation = Math.sin(time * 0.7) * 0.06;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    /** Called once when the camera reaches the stars (immediately with reduced motion). */
    onEnd(fn) {
      onEnd = fn;
      if (ended || reducedMotion) { ended = true; fn(); }
    },
    skip() {
      progress = 0.999;
    },
    /** 0..1, how far the flight has got */
    get progress() { return progress; },
    pause(v = true) { paused = v; },
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
