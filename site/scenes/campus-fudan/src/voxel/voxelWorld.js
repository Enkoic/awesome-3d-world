/**
 * Pure voxel-world builder for the Fudan three-campus model.
 * One cell = 4 m by default. Landmark sub-voxels are 2 m and stay aligned.
 *
 * Box record:
 *   { x, y, z, sx, sy, sz, color, tag }
 * where (x, y, z) is the box centre in metres and y is up.
 */
export const CELL = 4;
export const GROUND = 8;
export const SUB = 2;

const C = {
  campus: '#d5c7aa',
  campus2: '#c8b795',
  stone: '#c6b9a4',
  stoneLight: '#e1d6c2',
  dorm: '#a8644e',
  dorm2: '#945542',
  historic: '#8f3d35',
  historic2: '#74312c',
  library: '#d2b77f',
  library2: '#bea06b',
  glass: '#3e5d6b',
  glassLight: '#638591',
  glassDark: '#2b414b',
  roof: '#5d5a52',
  roofDark: '#45433e',
  tile: '#3b3732',
  tileRed: '#763e34',
  concrete: '#9b958a',
  context: '#a9a196',
  context2: '#938b80',
  contextRoof: '#5e5a53',
  hospital: '#c7c5bd',
  commercial: '#8fa2a7',
  sports: '#a96250',
  field: '#6f8a4b',
  field2: '#5f7b40',
  green: '#708b4c',
  green2: '#5f7a41',
  green3: '#7f9a56',
  tree: '#4e6b3d',
  tree2: '#5d7a47',
  tree3: '#3f5c36',
  trunk: '#5a4030',
  water: '#3e6d79',
  water2: '#4b7d87',
  bank: '#847b69',
  road: '#4e4b45',
  road2: '#5a5650',
  path: '#b4a68f',
  plaza: '#c7b99f',
  line: '#e9e0cc',
  gold: '#c5a05c',
  wood: '#784b32',
  wood2: '#5e3825',
  white: '#e9e2d4',
  black: '#26231f',
  red: '#9e2b32',
  metal: '#6f6b63',
  car1: '#d8d1c3',
  car2: '#a94b42',
  car3: '#516b7c',
};

function parse(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1)}`;
}
export function shade(hex, factor) {
  const [r, g, b] = parse(hex);
  return toHex(r * factor, g * factor, b * factor);
}
function hash(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1];
    const xj = ring[j][0], zj = ring[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}
function bbox(ring) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
}

function buildingColor(b, context = false) {
  if (context) return C.context;
  switch (b.type) {
    case 'dorm': return C.dorm;
    case 'historic': return C.historic;
    case 'library': return C.library;
    case 'sports': return C.concrete;
    case 'hospital': return C.hospital;
    case 'commercial': return C.commercial;
    case 'landmark': return C.campus;
    case 'default': return C.campus2;
    default: return C.campus;
  }
}

function roofColor(b, context = false) {
  if (context) return C.contextRoof;
  if (b.roof === 'hip' || b.type === 'historic') return C.tileRed;
  if (b.type === 'dorm') return C.roofDark;
  return C.roof;
}

export function buildVoxelCampus(data, { context = false } = {}) {
  const boxes = [];
  const labels = [];
  const ground = new Map();
  const meta = { campus: data.id, buildings: 0, cubes: 0 };

  const add = (x, y0, z, sx, sy, sz, color, tag = 'building') => {
    boxes.push({ x, y: y0 + sy / 2, z, sx, sy, sz, color, tag });
  };
  const addCube = (x, y0, z, s, color, tag) => add(x, y0, z, s, s, s, color, tag);

  const gkey = (gx, gz) => `${gx},${gz}`;
  const setGround = (x, z, color, priority = 1, cell = GROUND) => {
    const gx = Math.round(x / cell);
    const gz = Math.round(z / cell);
    const key = gkey(gx, gz);
    const old = ground.get(key);
    if (old && old.priority > priority) return;
    ground.set(key, { gx, gz, color, priority, cell });
  };
  const setGroundRaw = (gx, gz, color, priority, cell = GROUND) => {
    const key = gkey(gx, gz);
    const old = ground.get(key);
    if (old && old.priority > priority) return;
    ground.set(key, { gx, gz, color, priority, cell });
  };

  // Base perimeter: a chunky voxel rim around the floating island.
  const rimStep = CELL * 0.9;
  const rim = data.base;
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / rimStep));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      add(Math.round(x / CELL) * CELL, 0.05, Math.round(z / CELL) * CELL, CELL * 0.98, 0.55, CELL * 0.98, k % 5 === 0 ? C.green2 : C.green, 'edge');
    }
  }

  // Ground-use polygons: roads, water, sport pitches, plazas, parking.
  for (const a of data.areas) {
    if (!['water', 'sports', 'parking', 'plaza'].includes(a.kind)) continue;
    const color = a.kind === 'water' ? C.water : a.kind === 'sports' ? (a.subtype === 'pitch' ? C.field : C.sports) : a.kind === 'parking' ? C.road2 : C.plaza;
    const cells = new Set();
    const bb = bbox(a.ring);
    const gx0 = Math.floor((bb.minX - GROUND) / GROUND), gx1 = Math.ceil((bb.maxX + GROUND) / GROUND);
    const gz0 = Math.floor((bb.minZ - GROUND) / GROUND), gz1 = Math.ceil((bb.maxZ + GROUND) / GROUND);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const x = gx * GROUND, z = gz * GROUND;
        if (!pointInRing(x, z, a.ring)) continue;
        cells.add(gkey(gx, gz));
        setGroundRaw(gx, gz, color, a.kind === 'water' ? 4 : 3, GROUND);
      }
    }
    if (a.kind === 'water') {
      const shore = new Set();
      for (const key of cells) {
        const [gx, gz] = key.split(',').map(Number);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!cells.has(gkey(gx + dx, gz + dz))) shore.add(gkey(gx + dx, gz + dz));
        }
      }
      for (const key of shore) {
        const [gx, gz] = key.split(',').map(Number);
        setGroundRaw(gx, gz, C.bank, 2, GROUND);
      }
    }
    if (a.kind === 'sports') {
      // white boundary blocks
      for (const key of cells) {
        const [gx, gz] = key.split(',').map(Number);
        let edge = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!cells.has(gkey(gx + dx, gz + dz))) edge = true;
        }
        if (edge) add(gx * GROUND, 0.18, gz * GROUND, GROUND * 0.9, 0.12, GROUND * 0.9, C.line, 'ground');
      }
    }
  }

  // Roads: rasterise the centreline at 4 m, add width + sidewalk cells.
  for (const r of data.roads) {
    const isPath = ['footway', 'path', 'cycleway', 'steps', 'pedestrian'].includes(r.class_);
    const color = isPath ? C.path : C.road;
    const width = Math.max(2.5, r.width * (isPath ? 0.75 : 1));
    const line = r.line;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const nx = -dz / len, nz = dx / len;
      const n = Math.max(1, Math.ceil(len / (GROUND * 0.9)));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + dx * t;
        const z = a[1] + dz * t;
        const offMax = Math.max(0, width / 2 - GROUND * 0.3);
        const steps = Math.max(1, Math.round(offMax / GROUND));
        for (let o = -steps; o <= steps; o++) {
          setGround(x + nx * o * GROUND, z + nz * o * GROUND, color, 3, GROUND);
        }
        if (!isPath) {
          setGround(x + nx * (width / 2 + GROUND * 0.7), z + nz * (width / 2 + GROUND * 0.7), C.path, 2, GROUND);
          setGround(x - nx * (width / 2 + GROUND * 0.7), z - nz * (width / 2 + GROUND * 0.7), C.path, 2, GROUND);
        }
      }
    }
  }

  // Waterways as grid tiles.
  for (const w of data.waterLines || []) {
    const line = w.line;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const nx = -dz / len, nz = dx / len;
      const n = Math.max(1, Math.ceil(len / GROUND));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + dx * t, z = a[1] + dz * t;
        const steps = Math.max(1, Math.round(w.width / GROUND));
        for (let o = -steps; o <= steps; o++) setGround(x + nx * o * GROUND, z + nz * o * GROUND, C.water, 4, GROUND);
      }
    }
  }

  // Flush ground tiles (one low box per tile).
  for (const t of ground.values()) {
    add(t.gx * GROUND, 0.02, t.gz * GROUND, GROUND * 0.97, 0.16, GROUND * 0.97, t.color, 'ground');
  }

  function rasterBuilding(b, { context = false, levelsOverride = null, tag = 'building', baseColor = null, cell = CELL } = {}) {
    const bb = bbox(b.ring);
    const gx0 = Math.floor((bb.minX - cell * 0.6) / cell), gx1 = Math.ceil((bb.maxX + cell * 0.6) / cell);
    const gz0 = Math.floor((bb.minZ - cell * 0.6) / cell), gz1 = Math.ceil((bb.maxZ + cell * 0.6) / cell);
    const cells = [];
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const x = gx * cell, z = gz * cell;
        if (pointInRing(x, z, b.ring)) cells.push([gx, gz]);
      }
    }
    if (!cells.length) return;
    const cellSet = new Set(cells.map(([x, z]) => `${x},${z}`));
    const levels = levelsOverride ?? Math.max(1, Math.min(44, Math.ceil((b.height || 10) / cell)));
    const wall = baseColor || buildingColor(b, context);
    const roof = roofColor(b, context);
    const isHistoric = b.type === 'historic' || b.roof === 'hip';
    const isGlass = b.type === 'library' || b.type === 'commercial' || b.type === 'landmark';
    for (const [gx, gz] of cells) {
      let edge = false, edgeCount = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!cellSet.has(`${gx + dx},${gz + dz}`)) { edge = true; edgeCount++; }
      }
      const corner = edgeCount >= 2;
      // Hollow shell: perimeter walls + a full roof cap. Invisible interior cubes
      // are skipped, which keeps the model readable and the GLB lightweight.
      for (let lv = 0; lv < levels; lv++) {
        const isTop = lv === levels - 1;
        if (!edge && !isTop) continue;
        let color = wall;
        if (isTop) color = roof;
        else if (!context) {
          const windowCell = ((gx + gz + lv) % 2 === 0);
          if (isGlass && lv % 2 === 0 && windowCell) color = C.glass;
          else if (isHistoric && lv % 3 === 1 && windowCell) color = C.glassDark;
          else if (!isGlass && lv % 3 === 1 && windowCell) color = shade(wall, 0.56);
          if (corner && !isGlass) color = shade(wall, 1.07);
          if (isHistoric && lv % 4 === 2 && corner) color = C.stoneLight;
        }
        if (context) color = isTop ? C.contextRoof : (hash(gx, lv, gz, 4) > 0.7 ? C.context2 : C.context);
        color = shade(color, 0.94 + hash(gx, lv, gz, 7) * 0.1);
        addCube(gx * cell, 0.1 + lv * cell, gz * cell, cell * 0.98, color, tag);
      }
      if (isHistoric && !context) {
        // A stepped gable: keep the long axis, pinch the short axis. This reads
        // as a pitched tile roof instead of a giant flat red slab.
        const roofLevels = Math.max(1, Math.min(5, Math.round(Math.min(bb.w, bb.d) / cell * 0.42)));
        const longX = bb.w >= bb.d;
        for (let rl = 0; rl < roofLevels; rl++) {
          const shrink = rl * cell * 1.35;
          const w = longX ? bb.w - shrink * 0.35 : bb.w - shrink;
          const d = longX ? bb.d - shrink : bb.d - shrink * 0.35;
          if (w < cell || d < cell) break;
          add(bb.cx, 0.1 + (levels + rl) * cell, bb.cz, w, cell * 0.96, d, shade(C.tileRed, 0.88 + rl * 0.05), tag);
        }
        // ridge beam
        const ridgeW = longX ? bb.w * 0.92 : cell * 1.4;
        const ridgeD = longX ? cell * 1.4 : bb.d * 0.92;
        add(bb.cx, 0.1 + (levels + roofLevels) * cell, bb.cz, ridgeW, cell * 0.7, ridgeD, C.tile, tag);
      }
    }
    meta.buildings++;
  }

  // Optional context fabric. The voxel edition focuses on the campus itself;
  // generic grey city blocks are off by default so the campus can read clearly.
  if (context) {
    for (const b of data.context) {
      if (!b.ring || b.ring.length < 3 || (b.area || 0) < 150) continue;
      const levels = Math.max(1, Math.min(3, Math.ceil((b.height || 12) / GROUND * 0.6)));
      rasterBuilding(b, { context: true, levelsOverride: levels, tag: 'context', cell: GROUND });
    }
  }

  // Campus buildings, with hand-built landmark overrides.
  for (const b of data.buildings) {
    if (!b.ring || b.ring.length < 3) continue;
    if (b.name === '光华楼' || b.special === 'guanghua') {
      buildGuanghua(b, add, addCube, setGround, labels);
      meta.buildings++;
      continue;
    }
    if (b.special === 'oldGate' || b.name === '老校门') {
      buildOldGate(b, add, addCube, labels);
      meta.buildings++;
      continue;
    }
    if (b.name === '东1号楼') {
      buildEastOne(b, add, addCube, labels);
      meta.buildings++;
      continue;
    }
    if (b.special === 'libraryAtrium' || b.name === '李兆基图书馆') {
      buildLibrary(b, add, addCube, labels, rasterBuilding);
      meta.buildings++;
      continue;
    }
    rasterBuilding(b, { tag: 'building' });
    if (b.name) labels.push({ text: b.name, sub: `${Math.round(b.height)} m`, x: b.center[0], z: b.center[1], y: (b.height || 20) + 12, kind: 'building', priority: b.priority || 60 });
  }

  // Trees: one trunk and a small stepped canopy; instanced later.
  const treeStep = 2;
  for (let i = 0; i < data.trees.length; i += treeStep) {
    const [x, z, s, v] = data.trees[i];
    const sz = Math.max(0.8, s);
    const bx = Math.round(x / 1.5) * 1.5;
    const bz = Math.round(z / 1.5) * 1.5;
    addCube(bx, 0.12, bz, 1.3 * sz, C.trunk, 'tree');
    const base = 2.1 * sz;
    const green = [C.tree, C.tree2, C.tree3][(v + i) % 3];
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      addCube(bx + dx * 1.55 * sz, base, bz + dz * 1.55 * sz, 2.8 * sz, shade(green, 0.9 + hash(i, 0, 0, 2) * 0.16), 'tree');
    }
    addCube(bx, base + 2.4 * sz, bz, 2.4 * sz, shade(green, 0.96), 'tree');
  }

  // Campus ground labels (gardens, lakes, lawns).
  for (const l of data.labels) {
    if (l.kind === 'area' || l.kind === 'gate') labels.push({ ...l });
  }

  // A few voxel cars along the larger roads / parking areas.
  let cars = 0;
  for (const a of data.areas) {
    if (a.kind !== 'parking' || cars > 28) continue;
    const bb = bbox(a.ring);
    const n = Math.min(5, Math.floor(bb.w / 16) * Math.floor(bb.d / 10));
    for (let i = 0; i < n; i++) {
      const x = bb.minX + 8 + (i % 3) * 12;
      const z = bb.minZ + 8 + Math.floor(i / 3) * 12;
      if (x > bb.maxX - 4 || z > bb.maxZ - 4) continue;
      add(x, 0.15, z, 4.4, 1.5, 2.0, [C.car1, C.car2, C.car3][i % 3], 'car');
      add(x - 0.4, 1.5, z, 2.2, 1.1, 1.7, C.glassDark, 'car');
      cars++;
    }
  }

  meta.cubes = boxes.length;
  return { boxes, labels: labels.filter((l, i, a) => a.findIndex((q) => q.text === l.text) === i), meta };
}

/* ------------------------------------------------------------------ landmarks */
function buildGuanghua(b, add, addCube, setGround, labels) {
  const cell = CELL;
  const h = b.height || 142;
  const podiumH = Math.max(2, Math.round((b.podium_height || 25) / cell));
  const bb = bbox(b.ring);
  // podium: stepped slab with stone colonnade
  const gx0 = Math.floor(bb.minX / cell), gx1 = Math.ceil(bb.maxX / cell);
  const gz0 = Math.floor(bb.minZ / cell), gz1 = Math.ceil(bb.maxZ / cell);
  const set = new Set();
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gz = gz0; gz <= gz1; gz++) {
      if (pointInRing(gx * cell, gz * cell, b.ring)) set.add(`${gx},${gz}`);
    }
  }
  for (const k of set) {
    const [gx, gz] = k.split(',').map(Number);
    for (let lv = 0; lv < podiumH; lv++) {
      let col = lv === podiumH - 1 ? C.roof : (lv === 1 || lv === podiumH - 2 ? C.glass : C.stone);
      col = shade(col, 0.94 + hash(gx, lv, gz, 1) * 0.08);
      addCube(gx * cell, 0.1 + lv * cell, gz * cell, cell * 0.98, col, 'landmark');
    }
  }
  // colonnade at the south face
  for (let gx = gx0; gx <= gx1; gx += 2) {
    const z = gz1 * cell;
    if (!set.has(`${gx},${gz1}`)) continue;
    addCube(gx * cell, 0.1, z + 2, 1.0, C.stoneLight, 'detail');
    addCube(gx * cell, 0.1 + cell, z + 2, 1.0, C.stoneLight, 'detail');
    addCube(gx * cell, 0.1 + cell * 2, z + 2, 1.0, C.stoneLight, 'detail');
  }
  // broad front steps toward the lawn
  for (let step = 0; step < 3; step++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      add(gx * cell, 0.1 + step * 1.2, gz1 * cell + (step + 1) * 3.4, cell * 0.95, 1.2, 3.2, C.stoneLight, 'detail');
    }
  }
  // twin towers
  for (const [cx, cz, size] of b.towers || []) {
    const s = Math.max(6, Math.round(size / cell) * cell);
    const half = Math.floor(s / cell / 2);
    const cgx = Math.round(cx / cell);
    const cgz = Math.round(cz / cell);
    const levels = Math.round(h / cell);
    for (let ix = -half; ix <= half; ix++) {
      for (let iz = -half; iz <= half; iz++) {
        const gx = cgx + ix, gz = cgz + iz;
        const edge = Math.abs(ix) === half || Math.abs(iz) === half;
        const corner = Math.abs(ix) === half && Math.abs(iz) === half;
        // Vertical stone piers and recessed glass strips, as in the real tower.
        const pier = Math.abs(ix) % 2 === 0 || Math.abs(iz) % 2 === 0;
        for (let lv = 0; lv < levels; lv++) {
          let col;
          if (!edge) col = lv % 4 === 0 ? C.glassDark : C.glass;
          else if (corner) col = C.stoneLight;
          else if (pier) col = lv % 8 === 0 ? C.stoneLight : C.stone;
          else col = lv > levels - 5 ? C.stoneLight : (lv % 5 === 0 ? C.glassLight : C.glass);
          if (lv > levels - 3) col = C.stoneLight;
          if (lv === levels - 1) col = C.roofDark;
          addCube(gx * cell, 0.1 + lv * cell, gz * cell, cell * 0.98, shade(col, 0.95 + hash(gx, lv, gz, 9) * 0.06), 'landmark');
        }
        // crown mast
        if (ix === 0 && iz === 0) {
          addCube(gx * cell, 0.1 + levels * cell, gz * cell, 1.2, C.metal, 'detail');
          addCube(gx * cell, 0.1 + (levels + 1) * cell, gz * cell, 1.2, C.metal, 'detail');
        }
      }
    }
    // crown slab and mast
    add(cx, 0.1 + levels * cell, cz, s + 5, cell * 0.8, s + 5, C.stoneLight, 'landmark');
    add(cx, 0.1 + (levels + 0.8) * cell, cz, s * 0.45, cell * 0.5, s * 0.45, C.roofDark, 'landmark');
    addCube(Math.round(cx / cell) * cell, 0.1 + (levels + 1.3) * cell, Math.round(cz / cell) * cell, 1.2, C.metal, 'detail');
    // central glass bridge around mid-height
    if (b.towers.length > 1) {
      const other = b.towers.find((t) => t !== b.towers[0]);
      const ax = Math.round(b.towers[0][0] / cell), bx2 = Math.round(other[0] / cell);
      const low = Math.min(ax, bx2), high = Math.max(ax, bx2);
      const z = Math.round(b.towers[0][1] / cell);
      for (let gx = low + 2; gx < high - 1; gx++) {
        for (let lv = Math.max(2, Math.floor(levels * 0.25)); lv < Math.floor(levels * 0.42); lv++) {
          if (lv % 2 === 0) addCube(gx * cell, 0.1 + lv * cell, z * cell, cell * 0.96, C.glass, 'landmark');
        }
      }
    }
  }
  labels.push({ text: '光华楼', sub: '142 m · 双塔', x: b.center[0], z: b.center[1], y: 156, kind: 'building', priority: 1 });
}

function buildOldGate(b, add, addCube, labels) {
  const S = 2; // 2 m sub-voxels: enough for a legible timber gate
  const cx = b.center[0], cz = b.center[1];
  const at = (ix, iy, iz, color, size = S) => addCube(cx + ix * S, 0.1 + iy * S, cz + iz * S, size, color, 'landmark');
  // White side walls and returns, with grey stone bases and dark tiled caps.
  for (const side of [-1, 1]) {
    for (let ix = 5; ix <= 10; ix++) {
      for (let iz = -3; iz <= 3; iz++) {
        for (let iy = 0; iy < 4; iy++) at(side * ix, iy, iz, iy === 0 ? C.stone : C.white);
        at(side * ix, 4, iz, C.tile);
      }
    }
    for (let iz = 4; iz <= 6; iz++) {
      for (let iy = 0; iy < 4; iy++) at(side * 10, iy, iz, iy === 0 ? C.stone : C.white);
      at(side * 10, 4, iz, C.tile);
    }
  }
  // Timber frame: four posts, lintel, black plaque with gold accents.
  for (const ix of [-4, -2, 2, 4]) {
    for (let iy = 0; iy < 4; iy++) at(ix, iy, 0, C.wood, 1.5);
  }
  for (let ix = -4; ix <= 4; ix++) at(ix, 4, 0, C.wood2);
  for (let ix = -3; ix <= 3; ix++) at(ix, 5, 0, C.black);
  at(-1, 5, -1, C.gold, 1.1); at(1, 5, -1, C.gold, 1.1);
  // Three tiers of dark tiles, wide overhanging eaves.
  const tiers = [[12, 5, 6], [9, 4, 7], [6, 3, 8]];
  for (const [w, d, iy] of tiers) {
    for (let ix = -w; ix <= w; ix++) {
      for (let iz = -d; iz <= d; iz++) at(ix, iy, iz, C.tile);
    }
  }
  // Upturned eave tips.
  for (const side of [-1, 1]) {
    at(side * 13, 7, 0, C.tile); at(side * 14, 8, 0, C.tile);
    at(side * 13, 7, -5, C.tile); at(side * 13, 7, 5, C.tile);
  }
  // Stone steps and two small guardian blocks.
  for (let ix = -5; ix <= 5; ix++) {
    at(ix, 0, 8, C.stoneLight); at(ix, 0, 9, C.stoneLight);
  }
  for (const side of [-1, 1]) {
    at(side * 7, 0, 7, C.stone); at(side * 7, 1, 7, C.stone);
  }
  labels.push({ text: '老校门', sub: '传统木构 / 瓦顶', x: cx, z: cz, y: 32, kind: 'building', priority: 2 });
}

function buildJiangwanGate(cx, cz, add, addCube) {
  const S = 2;
  // A gate wall running north-south at the east edge, facing west into campus.
  const at = (ix, iy, iz, color, size = S) => addCube(cx + ix * S, 0.1 + iy * S, cz + iz * S, size, color, 'landmark');
  // twin stone pylons
  for (const side of [-1, 1]) {
    const pz = side * 16;
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const edge = Math.abs(ix) === 4 || Math.abs(iz) === 4;
        for (let iy = 0; iy < 11; iy++) {
          let col = C.stone;
          if (edge && iy > 2 && iy < 9 && (Math.abs(ix) <= 1 || Math.abs(iz) <= 1)) col = C.glassDark;
          if (iy >= 10) col = C.stoneLight;
          at(ix, iy, pz + iz, col);
        }
      }
    }
    // dark roof cap
    for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) at(ix, 11, pz + iz, C.tile);
    at(-1, 12, pz - 1, C.gold, 1.2); at(1, 12, pz + 1, C.gold, 1.2);
  }
  // central wall with a stepped arch opening
  for (let iz = -16; iz <= 16; iz++) {
    for (let iy = 0; iy < 6; iy++) {
      const opening = Math.abs(iz) <= 5 && iy < 4;
      const archCut = Math.abs(iz) <= 7 && iy === 4 && Math.abs(iz) >= 5;
      if (opening || archCut) continue;
      at(0, iy, iz, iy >= 5 ? C.tile : C.stone);
    }
  }
  // darker reveal around the opening
  for (let iz = -5; iz <= 5; iz++) for (let iy = 0; iy < 4; iy++) at(-1, iy, iz, C.black, 1.2);
  // low arcade wings with repeated arched openings
  for (const side of [-1, 1]) {
    for (let seg = 0; seg < 4; seg++) {
      const z = side * (19 + seg * 5);
      for (let iz = -2; iz <= 2; iz++) {
        for (let iy = 0; iy < 3; iy++) {
          if (Math.abs(iz) <= 1 && iy < 2) continue;
          at(0, iy, z + iz, iy === 0 ? C.stone : C.stoneLight);
        }
        at(0, 3, z + iz, C.tile);
      }
    }
  }
  // paving / forecourt west of the gate
  for (let ix = -9; ix <= -4; ix++) {
    for (let iz = -22; iz <= 22; iz += 2) at(ix, 0, iz, C.path, S);
  }
}

function buildEastOne(b, add, addCube, labels) {
  // The OSM outline is an outer courtyard block; a solid extrusion reads as a
  // huge red slab. Build the long 1936 brick wing explicitly instead.
  const cell = CELL;
  const cx = Math.round(b.center[0] / cell) * cell;
  const cz = Math.round(b.center[1] / cell) * cell;
  const halfW = 12; // 96 m long
  const halfD = 3;  // 24 m deep
  const levels = 4;
  for (let ix = -halfW; ix <= halfW; ix++) {
    for (let iz = -halfD; iz <= halfD; iz++) {
      const edge = Math.abs(ix) === halfW || Math.abs(iz) === halfD;
      for (let lv = 0; lv < levels; lv++) {
        if (!edge && lv < levels - 1) continue;
        let col = C.historic;
        if (lv === 0) col = C.stone;
        else if (lv % 2 === 0 && edge) col = C.glassDark;
        if (lv === levels - 1) col = C.roof;
        addCube(cx + ix * cell, 0.1 + lv * cell, cz + iz * cell, cell * 0.98, col, 'landmark');
      }
    }
  }
  // white stone cornice / window bands
  for (let ix = -halfW; ix <= halfW; ix++) {
    for (let iz = -halfD; iz <= halfD; iz++) {
      const edge = Math.abs(ix) === halfW || Math.abs(iz) === halfD;
      if (!edge) continue;
      addCube(cx + ix * cell, 0.1 + 2.45 * cell, cz + iz * cell, cell * 0.94, C.stoneLight, 'detail');
    }
  }
  // central entrance portico, facing south
  for (let ix = -3; ix <= 3; ix++) {
    for (let lv = 0; lv < 3; lv++) {
      addCube(cx + ix * cell, 0.1 + lv * cell, cz + (halfD + 1) * cell, cell * 0.96, lv === 2 ? C.stoneLight : C.stone, 'detail');
    }
  }
  // pitched tiled roof: keep long axis, shrink the short axis
  const roofLevels = 3;
  for (let rl = 0; rl < roofLevels; rl++) {
    const w = (halfW * 2 + 1) * cell - rl * cell * 0.35;
    const d = (halfD * 2 + 1) * cell - rl * cell * 2.2;
    if (d < cell) break;
    add(cx, 0.1 + (levels + rl) * cell, cz, w, cell * 0.95, d, shade(C.tileRed, 0.9 + rl * 0.05), 'landmark');
  }
  add(cx, 0.1 + (levels + roofLevels) * cell, cz, (halfW * 2 + 1) * cell * 0.92, cell * 0.65, cell * 1.2, C.tile, 'detail');
  labels.push({ text: '东1号楼', sub: '1936 · 红砖坡顶', x: b.center[0], z: b.center[1], y: 30, kind: 'building', priority: 3 });
}

function buildLibrary(b, add, addCube, labels, rasterBuilding) {
  rasterBuilding(b, { tag: 'landmark', levelsOverride: Math.max(5, Math.round(b.height / CELL)) });
  const bb = bbox(b.ring);
  const cx = Math.round(bb.cx / CELL) * CELL;
  const cz = Math.round(bb.cz / CELL) * CELL;
  const zFront = cz + Math.round(bb.d / CELL / 2) * CELL + CELL;
  // central glass arch, stepped in plan so it reads as an arch from the plaza
  for (let lv = 0; lv < 12; lv++) {
    const half = lv < 6 ? 3 : lv < 9 ? 2 : 1;
    for (let ix = -3; ix <= 3; ix++) {
      if (Math.abs(ix) > half) continue;
      const col = Math.abs(ix) === half ? C.stoneLight : C.glass;
      addCube(cx + ix * CELL, 0.1 + lv * CELL, zFront, CELL * 0.94, col, 'landmark');
    }
  }
  // stone frame / cornice
  for (const side of [-1, 1]) {
    for (let lv = 0; lv < 10; lv++) addCube(cx + side * 4 * CELL, 0.1 + lv * CELL, zFront, CELL * 0.9, C.stone, 'landmark');
  }
  add(cx, 0.1 + 12 * CELL, zFront, 9 * CELL, CELL * 0.9, 2 * CELL, C.stoneLight, 'landmark');
  // barrel-vault glass roof as three stepped blocks
  add(cx, 0.1 + 13 * CELL, zFront, 8 * CELL, CELL, 3 * CELL, C.glass, 'landmark');
  add(cx, 0.1 + 14 * CELL, zFront, 6 * CELL, CELL, 2 * CELL, C.glassLight, 'landmark');
  add(cx, 0.1 + 15 * CELL, zFront, 4 * CELL, CELL, 1 * CELL, C.glass, 'landmark');
  // end towers with stone caps
  for (const side of [-1, 1]) {
    const x = cx + side * Math.round(bb.w / CELL / 2) * CELL;
    for (let lv = 0; lv < 11; lv++) {
      addCube(x, 0.1 + lv * CELL, cz, 2.2 * CELL, lv > 8 ? C.stoneLight : C.stone, 'landmark');
    }
    addCube(x, 0.1 + 11 * CELL, cz, CELL * 3.2, C.tile, 'landmark');
  }
  labels.push({ text: '李兆基图书馆', sub: '江湾 · 玻璃中庭', x: b.center[0], z: b.center[1], y: b.height + 16, kind: 'building', priority: 1 });
}
