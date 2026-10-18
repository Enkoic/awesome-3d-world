import * as THREE from 'three';
import { createCapGeometry, createWallGeometry, scaleRing } from '../geometry.js';
import { buildVoxelCampus } from './voxelWorld.js';

const BOX_GEOM = new THREE.BoxGeometry(1, 1, 1);
const VOXEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.86,
  metalness: 0.02,
  flatShading: true,
});
const VOXEL_GROUND_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.96,
  metalness: 0,
  flatShading: true,
});
const GRASS = new THREE.MeshStandardMaterial({ color: '#819b58', roughness: 1, metalness: 0 });
const EARTH = new THREE.MeshStandardMaterial({ color: '#6d5943', roughness: 1, metalness: 0 });
const DARK = new THREE.MeshStandardMaterial({ color: '#2d2922', roughness: 1, metalness: 0 });
const MERGED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02, flatShading: true });

export function createVoxelCampus(data, { mode = 'instanced' } = {}) {
  const voxel = buildVoxelCampus(data);
  const group = new THREE.Group();
  group.name = `voxel-${data.id}`;
  group.userData = { campus: data.id, data, voxel, labels: voxel.labels };

  // Floating block base: grassy top + soil section; the voxel rim hides the edge.
  const top = new THREE.Mesh(createCapGeometry(data.base, 0.02, { up: true, uvScale: 20 }), GRASS);
  top.receiveShadow = true;
  top.name = 'voxel-base-top';
  group.add(top);

  const tier1 = scaleRing(data.base, 0.985);
  const tier2 = scaleRing(data.base, 0.965);
  const side0 = new THREE.Mesh(createWallGeometry(data.base, 14, { bottom: 0, uvScaleY: 6 }), EARTH);
  side0.castShadow = true; side0.receiveShadow = true; side0.name = 'voxel-base-side-0';
  group.add(side0);
  const side1 = new THREE.Mesh(createWallGeometry(tier1, 14, { bottom: -14, uvScaleY: 6 }), EARTH);
  side1.castShadow = true; side1.receiveShadow = true; side1.name = 'voxel-base-side-1';
  group.add(side1);
  const side2 = new THREE.Mesh(createWallGeometry(tier2, 14, { bottom: -28, uvScaleY: 6 }), EARTH);
  side2.castShadow = true; side2.receiveShadow = true; side2.name = 'voxel-base-side-2';
  group.add(side2);

  const bottom = new THREE.Mesh(createCapGeometry(tier2, -42, { up: false, uvScale: 20 }), DARK);
  bottom.name = 'voxel-base-bottom';
  group.add(bottom);

  let pickMesh = null;
  if (mode === 'merged') {
    const mesh = createMergedVoxelMesh(voxel.boxes);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'voxel-cubes';
    group.add(mesh);
  } else {
    const solid = voxel.boxes.filter((b) => b.tag !== 'ground');
    const ground = voxel.boxes.filter((b) => b.tag === 'ground');
    if (solid.length) group.add(createInstancedVoxels(solid, VOXEL_MATERIAL, true));
    if (ground.length) group.add(createInstancedVoxels(ground, VOXEL_GROUND_MATERIAL, false));
    const picked = createBuildingPickers(data);
    pickMesh = picked.mesh;
    group.add(pickMesh);
  }

  // Campus label anchor
  const maxY = voxel.boxes.reduce((m, b) => Math.max(m, b.y + b.sy / 2), 0);
  return { group, voxel, maxY, data, pickMesh };
}

function createInstancedVoxels(boxes, material, castShadow) {
  const mesh = new THREE.InstancedMesh(BOX_GEOM, material, boxes.length);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    m.makeScale(b.sx, b.sy, b.sz);
    m.setPosition(b.x, b.y, b.z);
    mesh.setMatrixAt(i, m);
    c.set(b.color);
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = castShadow ? 'voxel-solid' : 'voxel-ground';
  return mesh;
}

/** Create a portable merged voxel mesh (8 vertices per cube, shared across GLB viewers). */
export function createMergedVoxelMesh(boxes) {
  const positions = new Float32Array(boxes.length * 8 * 3);
  const normals = new Float32Array(boxes.length * 8 * 3);
  const colors = new Float32Array(boxes.length * 8 * 3);
  const indices = new Uint32Array(boxes.length * 36);
  const faceDefs = [
    [[0, 3, 2, 1], [0, 0, -1]],
    [[4, 5, 6, 7], [0, 0, 1]],
    [[0, 4, 7, 3], [-1, 0, 0]],
    [[1, 2, 6, 5], [1, 0, 0]],
    [[3, 7, 6, 2], [0, 1, 0]],
    [[0, 1, 5, 4], [0, -1, 0]],
  ];
  let v = 0, n = 0, idx = 0, cube = 0;
  const col = new THREE.Color();
  for (const b of boxes) {
    col.set(b.color);
    const x0 = b.x - b.sx / 2, x1 = b.x + b.sx / 2;
    const y0 = b.y - b.sy / 2, y1 = b.y + b.sy / 2;
    const z0 = b.z - b.sz / 2, z1 = b.z + b.sz / 2;
    const verts = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    for (const [px, py, pz] of verts) {
      positions[v] = px; positions[v + 1] = py; positions[v + 2] = pz;
      colors[v] = col.r; colors[v + 1] = col.g; colors[v + 2] = col.b;
      v += 3;
    }
    for (const [face, normal] of faceDefs) {
      for (const vi of face) {
        normals[n] = normal[0]; normals[n + 1] = normal[1]; normals[n + 2] = normal[2];
        n += 3;
      }
      const base = cube * 8;
      indices[idx++] = base + face[0]; indices[idx++] = base + face[1]; indices[idx++] = base + face[2];
      indices[idx++] = base + face[0]; indices[idx++] = base + face[2]; indices[idx++] = base + face[3];
    }
    cube++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, MERGED);
  mesh.name = 'voxel-cubes-merged';
  return mesh;
}

function createBuildingPickers(data) {
  const infos = [];
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }),
    data.buildings.length
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (const b of data.buildings) {
    if (!b.ring || b.ring.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of b.ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const w = Math.max(4, maxX - minX), d = Math.max(4, maxZ - minZ);
    const h = Math.max(4, b.height || 12);
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    m.makeScale(w * 1.05, h, d * 1.05);
    m.setPosition(cx, h / 2 + 0.2, cz);
    mesh.setMatrixAt(n, m);
    infos.push({
      id: b.id, name: b.name, en: b.en || '', type: b.type, height: h, levels: b.levels || 0,
      area: b.area || 0, desc: b.desc || '', center: [cx, cz], width: w, depth: d,
    });
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = 'voxel-pickables';
  mesh.userData.infos = infos;
  mesh.frustumCulled = false;
  return { mesh, infos };
}

export function createVoxelMaterials() {
  return { grass: GRASS, earth: EARTH, dark: DARK, voxel: VOXEL_MATERIAL, merged: MERGED };
}
