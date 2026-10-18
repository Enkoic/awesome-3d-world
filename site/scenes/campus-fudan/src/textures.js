import * as THREE from 'three';

/* ------------------------------------------------------------------ utils */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex, alpha = 1) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function shade(hex, amount) {
  const c = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function noise(ctx, w, h, rng, alpha = 0.05, light = true) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * alpha * 2;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  if (light) {
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rng() * alpha * 1.4})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
    }
  }
}

function makeTexture(canvas, { srgb = true, repeat = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ facades */
const FACADE = {
  campus: { wall: '#c8bba4', trim: '#a89a84', glass: '#6d7d80', glass2: '#a8b4b0', style: 'punched' },
  dorm: { wall: '#b98973', trim: '#936955', glass: '#657578', glass2: '#a1ada8', style: 'dorm' },
  library: { wall: '#c9b28a', trim: '#9e8763', glass: '#667b7c', glass2: '#aebbb2', style: 'punched' },
  historic: { wall: '#925449', trim: '#6f3b33', glass: '#71807c', glass2: '#b0b7aa', style: 'arch' },
  sports: { wall: '#b6bbb7', trim: '#8d9490', glass: '#64777b', glass2: '#aab7b8', style: 'ribbon' },
  hospital: { wall: '#d5d2c9', trim: '#b4b0a6', glass: '#6f858e', glass2: '#b6c4c5', style: 'ribbon' },
  commercial: { wall: '#9aa3a3', trim: '#7f898a', glass: '#5f7d89', glass2: '#9db5bb', style: 'glass' },
  default: { wall: '#b8af9f', trim: '#978d7d', glass: '#68797a', glass2: '#a8b3ad', style: 'punched' },
  context: { wall: '#b9b2a5', trim: '#9a9387', glass: '#7e8987', glass2: '#b4bab3', style: 'punched' },
};

function drawWindow(ctx, ectx, x, y, w, h, spec, rng, style) {
  const lit = rng() < (style === 'glass' ? 0.28 : 0.38);
  const cool = rng() < 0.18;

  // recess
  ctx.fillStyle = shade(spec.trim, -6);
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, style === 'arch' ? w * 0.45 : 2);
  ctx.fill();

  if (style === 'arch') {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w * 0.48);
    ctx.quadraticCurveTo(x + w / 2, y - w * 0.13, x + w, y + w * 0.48);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = spec.glass;
    ctx.fill();
    ctx.strokeStyle = rgba(spec.trim, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 4);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + w * 0.48);
    ctx.lineTo(x + w, y + w * 0.48);
    ctx.strokeStyle = rgba('#e7e1d4', 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (lit) {
      ctx.fillStyle = cool ? 'rgba(188,211,224,.18)' : 'rgba(255,211,147,.2)';
      ctx.fill();
      ectx.fillStyle = cool ? 'rgba(188,215,232,.9)' : 'rgba(255,208,139,.92)';
      ectx.beginPath();
      ectx.moveTo(x + 2, y + h - 2);
      ectx.lineTo(x + 2, y + w * 0.48);
      ectx.quadraticCurveTo(x + w / 2, y, x + w - 2, y + w * 0.48);
      ectx.lineTo(x + w - 2, y + h - 2);
      ectx.closePath();
      ectx.fill();
    }
    return;
  }

  // glass gradient
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, shade(spec.glass2, 18));
  g.addColorStop(0.35, spec.glass);
  g.addColorStop(1, shade(spec.glass, -12));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // reflection streak
  ctx.fillStyle = 'rgba(235,244,239,.10)';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + w * 0.42, y + 2);
  ctx.lineTo(x + w * 0.58, y + 2);
  ctx.lineTo(x + w * 0.18, y + h - 2);
  ctx.closePath();
  ctx.fill();

  // mullions
  ctx.strokeStyle = rgba(spec.trim, 0.95);
  ctx.lineWidth = style === 'glass' ? 3 : 2;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  if (style !== 'ribbon') {
    ctx.moveTo(x, y + h * 0.52);
    ctx.lineTo(x + w, y + h * 0.52);
  }
  ctx.strokeStyle = rgba(spec.trim, 0.68);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // sill
  ctx.fillStyle = rgba(spec.trim, 0.55);
  ctx.fillRect(x - 3, y + h, w + 6, 2);

  if (lit) {
    ctx.fillStyle = cool ? 'rgba(189,213,226,.11)' : 'rgba(255,211,148,.12)';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ectx.fillStyle = cool ? 'rgba(181,210,229,.82)' : 'rgba(255,204,132,.9)';
    ectx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // subtle interior shapes
    ectx.fillStyle = 'rgba(20,18,16,.22)';
    ectx.fillRect(x + w * 0.18, y + h * 0.58, w * 0.25, h * 0.3);
  }
}

function facadeCanvases(type, createCanvas, seed = 1) {
  const spec = FACADE[type] || FACADE.default;
  const size = 512;
  const canvas = createCanvas(size, size);
  const ecanvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const ectx = ecanvas.getContext('2d');
  const rng = mulberry32(seed + type.length * 37);

  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, size, size);

  ctx.fillStyle = spec.wall;
  ctx.fillRect(0, 0, size, size);

  if (spec.style === 'arch') {
    // brick coursing
    ctx.strokeStyle = 'rgba(70,42,34,.16)';
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,244,226,.06)';
    for (let y = 6; y < size; y += 24) {
      for (let x = (y / 24) % 2 ? 12 : 0; x < size; x += 24) {
        ctx.fillRect(x, y, 22, 10);
      }
    }
  } else if (spec.style === 'glass') {
    // curtain-wall panel joints
    ctx.strokeStyle = 'rgba(60,66,64,.22)';
    ctx.lineWidth = 2;
    for (let x = 0; x < size; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let y = 0; y < size; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
  } else {
    // subtle horizontal floor bands
    ctx.fillStyle = 'rgba(58,50,42,.06)';
    for (let y = 0; y < size; y += 128) ctx.fillRect(0, y + 118, size, 10);
    // panel joints
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
  }

  // windows: 2 columns x 2 floors per 8m x 7.2m tile
  const cols = 2;
  const rows = 2;
  const cellW = size / cols;
  const cellH = size / rows;
  const winW = spec.style === 'glass' ? cellW * 0.78 : spec.style === 'ribbon' ? cellW * 0.82 : cellW * 0.55;
  const winH = spec.style === 'glass' ? cellH * 0.64 : cellH * 0.48;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + (cellW - winW) / 2;
      const y = r * cellH + cellH * (spec.style === 'ribbon' ? 0.24 : 0.2);
      drawWindow(ctx, ectx, x, y, winW, winH, spec, rng, spec.style);
    }
  }

  // dorm balconies / AC units
  if (spec.style === 'dorm') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.55) {
          const bx = c * cellW + cellW * 0.62;
          const by = r * cellH + cellH * 0.77;
          ctx.fillStyle = 'rgba(230,225,213,.6)';
          ctx.fillRect(bx, by, 18, 10);
          ctx.strokeStyle = 'rgba(95,88,78,.45)';
          ctx.strokeRect(bx, by, 18, 10);
        }
      }
    }
  }

  noise(ctx, size, size, rng, 0.035, true);
  return { canvas, ecanvas };
}

/* ------------------------------------------------------------------ surfaces */
function grassCanvas(createCanvas, seed = 1, light = false) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const base = light ? '#8d986c' : '#6f7c4e';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const g = rng();
    ctx.fillStyle = g < 0.45
      ? `rgba(${70 + rng() * 28},${85 + rng() * 30},${48 + rng() * 20},${0.12 + rng() * 0.22})`
      : `rgba(${118 + rng() * 36},${126 + rng() * 32},${82 + rng() * 25},${0.1 + rng() * 0.18})`;
    ctx.fillRect(x, y, 1 + rng() * 2.2, 1 + rng() * 3.5);
  }
  // soft patches
  for (let i = 0; i < 30; i++) {
    const x = rng() * size, y = rng() * size, r = 18 + rng() * 55;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(210,210,150,${0.04 + rng() * 0.04})`);
    grd.addColorStop(1, 'rgba(210,210,150,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  noise(ctx, size, size, rng, 0.025, false);
  return c;
}

function cityCanvas(createCanvas, seed = 2) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#9b958c';
  ctx.fillRect(0, 0, size, size);
  // faint city block joints
  ctx.strokeStyle = 'rgba(70,66,60,.16)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * size + (rng() - 0.5) * 10;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p + 30, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p - 20); ctx.stroke();
  }
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(${80 + rng() * 70},${78 + rng() * 65},${72 + rng() * 55},${0.08 + rng() * 0.15})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 3);
  }
  noise(ctx, size, size, rng, 0.045, true);
  return c;
}

function asphaltCanvas(createCanvas, seed = 3) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#5c5a55';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 11000; i++) {
    const v = 55 + rng() * 55;
    ctx.fillStyle = `rgba(${v},${v - 2},${v - 7},${0.12 + rng() * 0.2})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  noise(ctx, size, size, rng, 0.04, true);
  return c;
}

function pavingCanvas(createCanvas, seed = 4) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#bbaf9b';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(85,78,67,.22)';
  ctx.lineWidth = 1.5;
  const step = 64;
  for (let y = 0; y < size; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    for (let x = (y / step) % 2 ? step / 2 : 0; x < size; x += step) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + step); ctx.stroke();
    }
  }
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(${90 + rng() * 70},${85 + rng() * 65},${72 + rng() * 55},${0.06 + rng() * 0.12})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  noise(ctx, size, size, rng, 0.03, true);
  return c;
}

function trackCanvas(createCanvas, seed = 5) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#a95444';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 42) {
    ctx.fillStyle = 'rgba(255,235,220,.07)';
    ctx.fillRect(0, y, size, 18);
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${120 + rng() * 50},${65 + rng() * 35},${50 + rng() * 30},${0.1 + rng() * 0.18})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  noise(ctx, size, size, rng, 0.04, false);
  return c;
}

function gravelCanvas(createCanvas, seed = 6) {
  const size = 256;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#8c8982';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8000; i++) {
    const v = 90 + rng() * 80;
    ctx.fillStyle = `rgba(${v},${v - 1},${v - 5},${0.18 + rng() * 0.26})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  noise(ctx, size, size, rng, 0.05, true);
  return c;
}

function waterNormalCanvas(createCanvas, seed = 7) {
  const size = 256;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx = Math.sin(u * 3 + Math.cos(v * 2)) * 0.24 + Math.sin(v * 5) * 0.08;
      const ny = Math.cos(v * 3 + Math.sin(u * 2)) * 0.24 + Math.cos(u * 4) * 0.08;
      const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      d[i] = Math.round((nx * 0.5 + 0.5) * 255);
      d[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[i + 2] = Math.round(nz * 255);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function stoneCanvas(createCanvas, seed = 31) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#b6ac9b';
  ctx.fillRect(0, 0, size, size);
  const rowH = 64;
  for (let row = 0; row < size / rowH; row++) {
    const y = row * rowH;
    const offset = row % 2 ? -64 : 0;
    for (let x = offset; x < size; x += 128) {
      const v = 0.88 + rng() * 0.18;
      ctx.fillStyle = `rgba(${Math.round(177 * v)},${Math.round(169 * v)},${Math.round(153 * v)},1)`;
      ctx.fillRect(x + 2, y + 2, 124, rowH - 4);
      ctx.strokeStyle = 'rgba(86,78,67,.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, 124, rowH - 4);
    }
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${95 + rng() * 65},${88 + rng() * 60},${76 + rng() * 50},${0.06 + rng() * 0.1})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  noise(ctx, size, size, rng, 0.025, true);
  return c;
}

function roofTileCanvas(createCanvas, seed = 32) {
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#713c33';
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < 16; row++) {
    const y = row * 32;
    for (let x = row % 2 ? -20 : 0; x < size; x += 40) {
      const v = 0.88 + rng() * 0.2;
      ctx.fillStyle = `rgba(${Math.round(118 * v)},${Math.round(62 * v)},${Math.round(52 * v)},1)`;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x + 1, y + 1, 38, 30, 3) : ctx.rect(x + 1, y + 1, 38, 30);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,24,20,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  noise(ctx, size, size, rng, 0.03, false);
  return c;
}

/* ------------------------------------------------------------------ export */
export function createTextureLibrary(createCanvas) {
  const facades = {};
  for (const type of Object.keys(FACADE)) {
    const { canvas, ecanvas } = facadeCanvases(type, createCanvas, 11);
    const map = makeTexture(canvas, { srgb: true });
    const emissiveMap = makeTexture(ecanvas, { srgb: true });
    map.name = `facade-${type}`;
    emissiveMap.name = `facade-${type}-emissive`;
    facades[type] = { map, emissiveMap };
  }

  const grass = makeTexture(grassCanvas(createCanvas, 21, false), { srgb: true });
  const campusGrass = makeTexture(grassCanvas(createCanvas, 22, true), { srgb: true });
  const city = makeTexture(cityCanvas(createCanvas, 23), { srgb: true });
  const asphalt = makeTexture(asphaltCanvas(createCanvas, 24), { srgb: true });
  const paving = makeTexture(pavingCanvas(createCanvas, 25), { srgb: true });
  const track = makeTexture(trackCanvas(createCanvas, 26), { srgb: true });
  const gravel = makeTexture(gravelCanvas(createCanvas, 27), { srgb: true });
  const waterNormal = makeTexture(waterNormalCanvas(createCanvas, 28), { srgb: false });
  waterNormal.repeat.set(4, 4);

  const mistCanvas = createCanvas(512, 512);
  const mctx = mistCanvas.getContext('2d');
  const mg = mctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  mg.addColorStop(0, 'rgba(244,250,255,0.72)');
  mg.addColorStop(0.42, 'rgba(232,243,250,0.38)');
  mg.addColorStop(0.72, 'rgba(220,235,245,0.12)');
  mg.addColorStop(1, 'rgba(220,235,245,0)');
  mctx.fillStyle = mg;
  mctx.fillRect(0, 0, 512, 512);
  const mist = makeTexture(mistCanvas, { srgb: true });
  mist.wrapS = mist.wrapT = THREE.ClampToEdgeWrapping;

  const stone = makeTexture(stoneCanvas(createCanvas, 31), { srgb: true });
  stone.repeat.set(1, 1);
  const roofTile = makeTexture(roofTileCanvas(createCanvas, 32), { srgb: true });
  roofTile.repeat.set(1, 1);

  for (const t of [grass, campusGrass, city, asphalt, paving, track, gravel]) {
    t.repeat.set(1, 1);
  }

  return { facades, grass, campusGrass, city, asphalt, paving, track, gravel, waterNormal, mist, stone, roofTile };
}

export function setTextureAnisotropy(textures, value) {
  const seen = new Set();
  const walk = (obj) => {
    for (const v of Object.values(obj)) {
      if (!v) continue;
      if (v.isTexture) {
        if (!seen.has(v)) { v.anisotropy = value; v.needsUpdate = true; seen.add(v); }
      } else if (typeof v === 'object') {
        walk(v);
      }
    }
  };
  walk(textures);
}
