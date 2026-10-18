import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WALL_U = 8.0;
const WALL_V = 7.2;

export function prepareRing(ring) {
  const pts = ring.map((p) => [Number(p[0]), Number(p[1])]);
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) pts.pop();
  }
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    area += x1 * z2 - x2 * z1;
  }
  if (area < 0) pts.reverse();
  return pts;
}

function triangulate(pts) {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  return THREE.ShapeUtils.triangulateShape(contour, []);
}

function triNormalY(a, b, c) {
  const abx = b[0] - a[0], abz = b[1] - a[1];
  const acx = c[0] - a[0], acz = c[1] - a[1];
  return abz * acx - abx * acz;
}

export function createCapGeometry(ring, y, { up = true, uvScale = 20 } = {}) {
  const pts = prepareRing(ring);
  const tris = triangulate(pts);
  const positions = [];
  const uvs = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let vi = 0;
  for (const p of pts) {
    positions.push(p[0], y, p[1]);
    uvs.push(p[0] / uvScale, p[1] / uvScale);
    normals.push(0, up ? 1 : -1, 0);
    colors.push(1, 1, 1);
    vi++;
  }
  for (const t of tris) {
    let [a, b, c] = t;
    const pa = pts[a], pb = pts[b], pc = pts[c];
    const ny = triNormalY(pa, pb, pc);
    if ((up && ny < 0) || (!up && ny > 0)) {
      const tmp = b; b = c; c = tmp;
    }
    indices.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function createWallGeometry(ring, height, { bottom = 0, uvScaleX = WALL_U, uvScaleY = WALL_V, tint = [1, 1, 1] } = {}) {
  const pts = prepareRing(ring);
  const positions = [];
  const uvs = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let dist = 0;
  let vi = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) continue;
    // CCW ring (positive area in x/z) -> outward normal is (dz, -dx).
    const nx = dz / len, nz = -dx / len;
    const u0 = dist / uvScaleX;
    const u1 = (dist + len) / uvScaleX;
    const v0 = bottom / uvScaleY;
    const v1 = (bottom + height) / uvScaleY;

    // bottom a, top a, top b, bottom b (outward)
    positions.push(a[0], bottom, a[1], a[0], bottom + height, a[1], b[0], bottom + height, b[1], b[0], bottom, b[1]);
    uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
    for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
    // Ambient-occlusion-ish base darkening + a quiet per-building tint.
    const [tr, tg, tb] = tint;
    const db = 0.58;
    colors.push(db * tr, db * tg, db * tb, tr, tg, tb, tr, tg, tb, db * tr, db * tg, db * tb);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
    dist += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function createHipRoofGeometry(ring, baseY, roofHeight = 5, overhang = 1.2) {
  const pts = prepareRing(ring);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  minX -= overhang; maxX += overhang; minZ -= overhang; maxZ += overhang;
  const w = maxX - minX, d = maxZ - minZ;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const apexY = baseY + roofHeight;
  const c0 = [minX, baseY, minZ];
  const c1 = [maxX, baseY, minZ];
  const c2 = [maxX, baseY, maxZ];
  const c3 = [minX, baseY, maxZ];
  let r0, r1;
  if (w >= d) {
    const inset = Math.min(w * 0.5, d * 0.5);
    r0 = [minX + inset, apexY, cz];
    r1 = [maxX - inset, apexY, cz];
  } else {
    const inset = Math.min(d * 0.5, w * 0.5);
    r0 = [cx, apexY, minZ + inset];
    r1 = [cx, apexY, maxZ - inset];
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vi = 0;

  const addPolygon = (poly, outward) => {
    const p0 = new THREE.Vector3(...poly[0]);
    for (let i = 1; i < poly.length - 1; i++) {
      let p1 = new THREE.Vector3(...poly[i]);
      let p2 = new THREE.Vector3(...poly[i + 1]);
      let nor = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize();
      if (nor.dot(outward) < 0) {
        const tmp = p1; p1 = p2; p2 = tmp;
        nor.negate();
      }
      const q1 = p1.toArray(), q2 = p2.toArray();
      positions.push(...poly[0], ...q1, ...q2);
      for (let k = 0; k < 3; k++) normals.push(nor.x, nor.y, nor.z);
      for (const v of [poly[0], q1, q2]) uvs.push(v[0] / 5, v[2] / 5);
      indices.push(vi, vi + 1, vi + 2);
      vi += 3;
    }
  };

  // long faces (trapezoids), end faces (triangles)
  addPolygon([c0, c1, r1, r0], new THREE.Vector3(0, 0, -1));
  addPolygon([c2, c3, r0, r1], new THREE.Vector3(0, 0, 1));
  addPolygon([c3, c0, r0], new THREE.Vector3(-1, 0, 0));
  addPolygon([c1, c2, r1], new THREE.Vector3(1, 0, 0));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function scaleRing(ring, factor, cx = null, cz = null) {
  const pts = prepareRing(ring);
  let sx = 0, sz = 0;
  for (const [x, z] of pts) { sx += x; sz += z; }
  sx /= pts.length; sz /= pts.length;
  const ox = cx ?? sx;
  const oz = cz ?? sz;
  return pts.map(([x, z]) => [ox + (x - ox) * factor, oz + (z - oz) * factor]);
}

function boxRing(cx, cz, w, d) {
  return [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
  ];
}

export function mergePreservingGroups(geoms) {
  if (!geoms.length) return null;
  const counts = geoms.map((g) => (g.index ? g.index.count : g.attributes.position.count));
  const merged = mergeGeometries(geoms, false);
  if (!merged) return null;
  let offset = 0;
  for (let i = 0; i < geoms.length; i++) {
    const g = geoms[i];
    if (g.groups.length) {
      for (const gr of g.groups) {
        merged.addGroup(offset + gr.start, gr.count, gr.materialIndex);
      }
    } else {
      merged.addGroup(offset, counts[i], 0);
    }
    offset += counts[i];
  }
  merged.computeBoundingSphere();
  return merged;
}

function mergeWithGroups(parts) {
  const geoms = [];
  for (const part of parts) {
    if (!part.geometry) continue;
    const g = part.geometry;
    const count = g.index ? g.index.count : g.attributes.position.count;
    g.clearGroups();
    g.addGroup(0, count, part.material ?? 0);
    geoms.push(g);
  }
  const merged = mergePreservingGroups(geoms);
  if (!merged) throw new Error('Failed to merge building geometry');
  return merged;
}

function assembleFlatBuilding(ring, height, tint) {
  const wall = createWallGeometry(ring, height, { tint });
  const roof = createCapGeometry(ring, height, { up: true, uvScale: 12 });
  const parts = [
    { geometry: roof, material: 0 },
    { geometry: wall, material: 1 },
  ];
  if (height > 24) {
    // A slim parapet gives the flat roofs a readable architectural edge.
    const parapet = createWallGeometry(ring, 0.6, { bottom: height, uvScaleY: 2.4, tint });
    parts.push({ geometry: parapet, material: 0 });
  }
  return mergeWithGroups(parts);
}

export function createBuildingGeometry(b, { tint = [1, 1, 1] } = {}) {
  const ring = prepareRing(b.ring);
  const h = Math.max(3, b.height || 10);

  if (b.special === 'guanghua') {
    const podiumH = b.podium_height || 25;
    const parts = [
      { geometry: createCapGeometry(ring, podiumH, { up: true, uvScale: 12 }), material: 0 },
      { geometry: createWallGeometry(ring, podiumH, { tint }), material: 1 },
      { geometry: createWallGeometry(scaleRing(ring, 1.012), 2.2, { bottom: podiumH - 2.2, tint }), material: 3 },
    ];
    const towers = b.towers || [];
    for (const [cx, cz, size] of towers) {
      const tr = boxRing(cx, cz, size, size);
      parts.push({ geometry: createCapGeometry(tr, h, { up: true, uvScale: 12 }), material: 0 });
      parts.push({ geometry: createWallGeometry(tr, h, { tint }), material: 1 });
      // slim parapet at the tower roof
      parts.push({ geometry: createWallGeometry(tr, 1.1, { bottom: h, uvScaleY: 2.2, tint }), material: 0 });
      // stone corner fins and a crown cornice
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const fin = boxRing(cx + sx * (size / 2 - 0.75), cz + sz * (size / 2 - 0.75), 1.5, 1.5);
          parts.push({ geometry: createWallGeometry(fin, h - 5, { bottom: 3, uvScaleY: 8, tint }), material: 3 });
        }
      }
      parts.push({ geometry: createWallGeometry(scaleRing(tr, 1.013), 0.9, { bottom: h - 1.7, tint }), material: 3 });
      // crown
      const crownH = 5.5;
      const crownRing = boxRing(cx, cz, size * 0.86, size * 0.86);
      parts.push({ geometry: createWallGeometry(crownRing, crownH, { bottom: h, uvScaleY: 5, tint }), material: 1 });
      parts.push({ geometry: createCapGeometry(crownRing, h + crownH, { up: true, uvScale: 12 }), material: 0 });
      // mast
      const mr = boxRing(cx, cz, 1.4, 1.4);
      parts.push({ geometry: createWallGeometry(mr, 8, { bottom: h + crownH, uvScaleY: 4, tint }), material: 1 });
      parts.push({ geometry: createCapGeometry(mr, h + crownH + 8, { up: true, uvScale: 4 }), material: 0 });
    }
    return mergeWithGroups(parts);
  }

  if (b.special === 'oldGate') {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const w = maxX - minX, d = maxZ - minZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const gateW = Math.max(9, Math.min(18, w * 0.96));
    const pierW = 1.35;
    const pierD = Math.max(2.4, Math.min(5, d * 0.92));
    const pierH = Math.max(6.2, Math.min(8.4, h * 0.82));
    const parts = [];
    for (const sign of [-1, 1]) {
      const pr = boxRing(cx + sign * (gateW / 2 - pierW / 2), cz, pierW, pierD);
      parts.push({ geometry: createWallGeometry(pr, pierH, { tint }), material: 3 });
      parts.push({ geometry: createCapGeometry(pr, pierH, { up: true, uvScale: 5 }), material: 0 });
    }
    const lintel = boxRing(cx, cz, gateW, pierD);
    parts.push({ geometry: createWallGeometry(lintel, 1.15, { bottom: pierH, tint, uvScaleY: 2.5 }), material: 3 });
    parts.push({ geometry: createCapGeometry(lintel, pierH + 1.15, { up: true, uvScale: 5 }), material: 3 });
    const roof = createHipRoofGeometry(boxRing(cx, cz, gateW + 2.2, pierD + 1.8), pierH + 1.15, 2.6, 0.7);
    roof.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(roof.attributes.position.count * 3).fill(1), 3));
    parts.push({ geometry: roof, material: 2 });
    return mergeWithGroups(parts);
  }

  if (b.special === 'libraryAtrium') {
    const parts = [];
    const wall = createWallGeometry(ring, h, { tint });
    const roof = createCapGeometry(ring, h, { up: true, uvScale: 12 });
    parts.push({ geometry: wall, material: 1 }, { geometry: roof, material: 0 });
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const lw = Math.max(6, Math.min(16, (maxX - minX) * 0.26));
    const ld = Math.max(6, Math.min(16, (maxZ - minZ) * 0.26));
    const lr = boxRing(cx, cz, lw, ld);
    parts.push({ geometry: createWallGeometry(lr, 5.5, { bottom: h, tint, uvScaleY: 3 }), material: 1 });
    parts.push({ geometry: createWallGeometry(scaleRing(lr, 1.12), 0.5, { bottom: h + 5.5, tint }), material: 3 });
    parts.push({ geometry: createCapGeometry(scaleRing(lr, 1.12), h + 6.0, { up: true, uvScale: 6 }), material: 0 });
    return mergeWithGroups(parts);
  }

  if (b.roof === 'hip') {
    const wall = createWallGeometry(ring, h, { tint });
    const roofH = Math.max(3.2, Math.min(8, Math.max(b.width || 0, b.depth || 0) * 0.09));
    const hip = createHipRoofGeometry(ring, h, roofH, 1.1);
    hip.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(hip.attributes.position.count * 3).fill(1), 3));
    return mergeWithGroups([
      { geometry: wall, material: 1 },
      { geometry: hip, material: 2 },
    ]);
  }

  return assembleFlatBuilding(ring, h, tint);
}

export function createTowerGeometry(cx, cz, w, d, h) {
  const ring = boxRing(cx, cz, w, d);
  return mergeWithGroups([
    { geometry: createCapGeometry(ring, h, { up: true, uvScale: 12 }), material: 0 },
    { geometry: createWallGeometry(ring, h), material: 1 },
  ]);
}

export function createBaseTopGeometry(base, y = 0) {
  return createCapGeometry(base, y, { up: true, uvScale: 26 });
}

export function createBaseSideGeometry(base, depth = 28) {
  const pts = prepareRing(base);
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  let dist = 0;
  let vi = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) continue;
    const nx = dz / len, nz = -dx / len;
    const u0 = dist / 18, u1 = (dist + len) / 18;
    positions.push(a[0], 0, a[1], b[0], 0, b[1], b[0], -depth, b[1], a[0], -depth, a[1]);
    for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
    uvs.push(u0, 1, u1, 1, u1, 0, u0, 0);
    // warm soil near the top, dark bedrock below
    colors.push(0.47, 0.39, 0.31, 0.47, 0.39, 0.31, 0.12, 0.11, 0.10, 0.12, 0.11, 0.10);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
    dist += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function createBaseBottomGeometry(base, depth = 28) {
  return createCapGeometry(base, -depth, { up: false, uvScale: 20 });
}

export function createRibbonGeometry(line, width, y = 0.14, uvScale = 6) {
  if (!line || line.length < 2) return null;
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  let dist = 0;
  let vi = 0;
  const hw = Math.max(0.2, width / 2);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = -dz / len, nz = dx / len;
    // use averaged joint normals for smoother bends
    const prev = line[i - 1] || a;
    const next = line[i + 2] || b;
    const ax = a[0] - prev[0], az = a[1] - prev[1];
    const bx = next[0] - b[0], bz = next[1] - b[1];
    const al = Math.hypot(ax, az), bl = Math.hypot(bx, bz);
    let n1x = nx, n1z = nz, n2x = nx, n2z = nz;
    if (al > 0.01) {
      const px = -az / al, pz = ax / al;
      n1x = (px + nx) / 2; n1z = (pz + nz) / 2;
      const l = Math.hypot(n1x, n1z) || 1; n1x /= l; n1z /= l;
    }
    if (bl > 0.01) {
      const qx = -bz / bl, qz = bx / bl;
      n2x = (qx + nx) / 2; n2z = (qz + nz) / 2;
      const l = Math.hypot(n2x, n2z) || 1; n2x /= l; n2z /= l;
    }
    const p1 = [a[0] - n1x * hw, a[1] - n1z * hw];
    const p2 = [a[0] + n1x * hw, a[1] + n1z * hw];
    const p3 = [b[0] + n2x * hw, b[1] + n2z * hw];
    const p4 = [b[0] - n2x * hw, b[1] - n2z * hw];
    const u0 = dist / uvScale, u1 = (dist + len) / uvScale;
    positions.push(p1[0], y, p1[1], p2[0], y, p2[1], p3[0], y, p3[1], p4[0], y, p4[1]);
    uvs.push(0, u0, 1, u0, 1, u1, 0, u1);
    for (let k = 0; k < 4; k++) normals.push(0, 1, 0);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
    dist += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ trees */
function colorize(geom, color) {
  const count = geom.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

export function createTreeGeometry(variant = 0) {
  const parts = [];
  const trunkH = 4.5;
  const trunk = new THREE.CylinderGeometry(0.26, 0.5, trunkH, 5, 1);
  trunk.translate(0, trunkH / 2, 0);
  colorize(trunk, new THREE.Color('#4b3929'));
  parts.push(trunk);

  // two angled branches break up the "lollipop" silhouette
  for (const [sx, rot] of [[-1, 0.48], [1, -0.42]]) {
    const branch = new THREE.CylinderGeometry(0.1, 0.2, 2.3, 4, 1);
    branch.rotateZ(rot);
    branch.translate(sx * 0.55, 4.4, sx * 0.15);
    colorize(branch, new THREE.Color('#4f3b2b'));
    parts.push(branch);
  }

  const shapes = [
    [[0, 6.7, 0, 3.4, 1], [2.1, 5.9, 0.5, 2.2, 0], [-2.0, 6.1, -0.4, 2.15, 0], [0.4, 8.1, -0.8, 2.0, 0], [0.1, 4.9, 1.5, 1.8, 0]],
    [[0, 7.0, 0, 3.6, 1], [0.8, 5.3, 1.6, 2.15, 0], [-1.4, 6.1, -1.1, 2.2, 0], [-0.2, 8.4, 0.4, 1.9, 0], [1.9, 7.4, -0.3, 1.75, 0]],
    [[0, 6.2, 0, 3.15, 1], [1.6, 7.2, -0.4, 2.2, 0], [-1.9, 5.6, 0.9, 2.05, 0], [0.7, 4.8, -1.4, 1.85, 0], [-0.6, 8.0, 0.6, 1.7, 0]],
  ][variant % 3];

  for (let i = 0; i < shapes.length; i++) {
    const [x, y, z, r, detail] = shapes[i];
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.translate(x, y, z);
    const c = new THREE.Color().setHSL(0.232 + i * 0.007, 0.31 + (i % 2) * 0.045, 0.30 - i * 0.012);
    colorize(g, c);
    parts.push(g);
  }
  const nonIndexed = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/* ------------------------------------------------------------------ utils */
export function disposeObject(obj) {
  obj.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) m.dispose();
    }
  });
}

export function polygonBounds(ring) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}
