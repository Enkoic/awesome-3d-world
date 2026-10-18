import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergePreservingGroups } from './geometry.js';
import {
  createBaseBottomGeometry,
  createBaseSideGeometry,
  createBaseTopGeometry,
  createBuildingGeometry,
  createCapGeometry,
  createRibbonGeometry,
  createTreeGeometry,
  createWallGeometry,
  polygonBounds,
  scaleRing,
} from './geometry.js';

const TREE_GEOMETRIES = [];
function treeGeometries() {
  if (!TREE_GEOMETRIES.length) {
    for (let i = 0; i < 3; i++) TREE_GEOMETRIES.push(createTreeGeometry(i));
  }
  return TREE_GEOMETRIES;
}

function wallType(type) {
  if (type === 'landmark') return 'landmark';
  if (type === 'campus') return 'campus';
  if (type === 'dorm') return 'dorm';
  if (type === 'library') return 'library';
  if (type === 'historic') return 'historic';
  if (type === 'sports') return 'sports';
  if (type === 'hospital') return 'hospital';
  if (type === 'commercial') return 'commercial';
  return 'default';
}

export function createMaterials(textures, envMap = null) {
  const wall = {};
  for (const type of ['campus', 'dorm', 'library', 'historic', 'sports', 'hospital', 'commercial', 'default', 'context', 'landmark']) {
    const src = type === 'landmark' ? textures.facades.campus : textures.facades[type];
    const mat = new THREE.MeshStandardMaterial({
      map: src.map,
      emissiveMap: src.emissiveMap,
      emissive: new THREE.Color('#ffc37a'),
      emissiveIntensity: 0,
      vertexColors: true,
      roughness: type === 'historic' ? 0.88 : type === 'commercial' ? 0.52 : 0.78,
      metalness: type === 'commercial' ? 0.18 : 0.035,
      envMap,
      envMapIntensity: 0.38,
    });
    const typeColor = {
      campus: '#d8c5a9', dorm: '#b56f58', library: '#d4b87e',
      historic: '#a96552', sports: '#b4c2bb', hospital: '#d5d1c8',
      commercial: '#aebfc2', default: '#c1b3a0', landmark: '#dcc39e',
      context: '#928b80',
    }[type];
    if (typeColor) mat.color.set(typeColor);
    if (type === 'context') {
      mat.color.set('#a39b8f');
      mat.roughness = 0.92;
      mat.envMapIntensity = 0.32;
    }
    mat.name = `wall-${type}`;
    wall[type] = mat;
  }

  const roof = new THREE.MeshStandardMaterial({
    map: textures.gravel,
    color: '#69645d',
    roughness: 0.96,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.25,
  });
  roof.name = 'roof-gravel';

  const hip = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    color: '#9a6255',
    roughness: 0.9,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.18,
  });
  hip.name = 'roof-hip';

  const city = new THREE.MeshStandardMaterial({
    map: textures.city,
    color: '#b4aca0',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.18,
  });
  city.name = 'base-city';

  const campusGround = new THREE.MeshStandardMaterial({
    map: textures.campusGrass,
    color: '#afc07f',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.14,
  });
  campusGround.name = 'campus-ground';

  const grass = new THREE.MeshStandardMaterial({
    map: textures.grass,
    color: '#a8b56f',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.12,
  });
  grass.name = 'grass';

  const asphalt = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    color: '#aaa49a',
    roughness: 0.92,
    metalness: 0.04,
    envMap,
    envMapIntensity: 0.25,
  });
  asphalt.name = 'asphalt';

  const paving = new THREE.MeshStandardMaterial({
    map: textures.paving,
    color: '#dfd3bf',
    roughness: 0.9,
    metalness: 0.02,
    envMap,
    envMapIntensity: 0.22,
  });
  paving.name = 'paving';

  const track = new THREE.MeshStandardMaterial({
    map: textures.track,
    color: '#e0c9ba',
    roughness: 0.92,
    metalness: 0,
    envMap,
    envMapIntensity: 0.16,
  });
  track.name = 'track';

  const field = new THREE.MeshStandardMaterial({
    map: textures.grass,
    color: '#aebd8d',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.1,
  });
  field.name = 'field';

  const waterNormal = textures.waterNormal.clone();
  waterNormal.needsUpdate = true;
  waterNormal.wrapS = THREE.RepeatWrapping;
  waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(5, 5);
  const water = new THREE.MeshStandardMaterial({
    color: '#3b646e',
    roughness: 0.12,
    metalness: 0.1,
    normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.36, 0.36),
    envMap,
    envMapIntensity: 1.15,
    transparent: false,
  });
  water.name = 'water';

  const earth = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.08,
  });
  earth.name = 'earth-side';

  const dark = new THREE.MeshStandardMaterial({ color: '#171513', roughness: 1 });
  dark.name = 'base-bottom';

  const tree = new THREE.MeshStandardMaterial({
    color: '#aeba8a',
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    envMap,
    envMapIntensity: 0.18,
  });
  tree.name = 'trees';

  const mechanical = new THREE.MeshStandardMaterial({
    color: '#7d7971',
    roughness: 0.76,
    metalness: 0.24,
    envMap,
    envMapIntensity: 0.3,
  });
  mechanical.name = 'roof-mechanical';

  const stone = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: '#d8cfc0',
    roughness: 0.84,
    metalness: 0.03,
    envMap,
    envMapIntensity: 0.28,
  });
  stone.name = 'stone-trim';

  const metal = new THREE.MeshStandardMaterial({
    color: '#49453f',
    roughness: 0.54,
    metalness: 0.38,
    envMap,
    envMapIntensity: 0.34,
  });
  metal.name = 'metal-trim';

  const bank = new THREE.MeshStandardMaterial({
    color: '#565148',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.08,
  });
  bank.name = 'water-bank';

  const hedge = new THREE.MeshStandardMaterial({
    color: '#526b3f',
    roughness: 1,
    metalness: 0,
    envMap,
    envMapIntensity: 0.1,
  });
  hedge.name = 'hedge';

  const fieldLine = new THREE.LineBasicMaterial({
    color: '#f7f0df',
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  fieldLine.name = 'field-line';

  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff0c8',
    emissive: '#ffc06b',
    emissiveIntensity: 0.08,
    roughness: 0.45,
    metalness: 0.05,
    envMap,
    envMapIntensity: 0.2,
  });
  lamp.name = 'lamp-glow';

  const car = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.36,
    metalness: 0.32,
    envMap,
    envMapIntensity: 0.3,
  });
  car.name = 'cars';

  const mist = new THREE.MeshBasicMaterial({
    map: textures.mist,
    color: '#dcecf4',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  mist.name = 'mist';

  const goldLine = new THREE.LineBasicMaterial({
    color: '#c7a15d',
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const baseLine = new THREE.LineBasicMaterial({
    color: '#c9b48d',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  return { wall, roof, hip, city, campusGround, grass, asphalt, paving, track, field, water, waterNormal, earth, dark, tree, mechanical, stone, metal, bank, hedge, fieldLine, lamp, car, mist, goldLine, baseLine };
}

function mergeMesh(geometries, material, { cast = true, receive = true, preserveGroups = false } = {}) {
  if (!geometries.length) return null;
  const merged = preserveGroups ? mergePreservingGroups(geometries) : mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildingTint(b, context = false) {
  if (context) return [0.80, 0.78, 0.74];
  const h = hashString(`${b.id}:${b.name || ''}`);
  const v = 0.87 + ((h >>> 3) % 12) / 100;
  const warm = ((h >>> 9) % 5) / 100;
  return [Math.min(1, v + warm), v, Math.max(0.72, v - warm * 0.5)];
}

function withColor(geom) {
  const count = geom.attributes.position.count;
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  return geom;
}

function detailBox(w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return withColor(g);
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class CampusModel {
  constructor(data, materials, { shadows = true, forExport = false } = {}) {
    this.data = data;
    this.mats = materials;
    this.shadows = shadows;
    this.forExport = forExport;
    this.group = new THREE.Group();
    this.group.name = data.id;
    this.group.userData.campusId = data.id;
    this.pickMeshes = [];
    this.waterMeshes = [];
    this.night = false;
    this.build();
  }

  build() {
    const { data, mats } = this;
    const baseDepth = 34;
    const baseTop = new THREE.Mesh(createBaseTopGeometry(data.base, 0), mats.city);
    baseTop.receiveShadow = true;
    baseTop.name = 'base-top';
    this.group.add(baseTop);

    const baseSide = new THREE.Mesh(createBaseSideGeometry(data.base, baseDepth), mats.earth);
    baseSide.castShadow = true;
    baseSide.receiveShadow = true;
    baseSide.name = 'base-side';
    this.group.add(baseSide);

    const baseBottom = new THREE.Mesh(createBaseBottomGeometry(data.base, baseDepth), mats.dark);
    baseBottom.receiveShadow = false;
    this.group.add(baseBottom);

    if (!this.forExport) {
      const mistSize = Math.max(data.extent.width, data.extent.depth) * 1.6;
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(mistSize, mistSize), mats.mist);
      mist.rotation.x = -Math.PI / 2;
      mist.position.y = -37;
      mist.renderOrder = 1;
      mist.name = 'base-mist';
      this.group.add(mist);
    }

    if (!this.forExport) {
      // Gold edge around the model base.
      const basePts = data.base.map(([x, z]) => new THREE.Vector3(x, 0.25, z));
      const baseLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(basePts), mats.baseLine);
      baseLine.name = 'base-edge';
      this.group.add(baseLine);
    }

    // Campus surface.
    const campusGeoms = data.campus.map((ring) => createCapGeometry(ring, 0.08, { up: true, uvScale: 20 }));
    if (campusGeoms.length) {
      const campusMesh = mergeMesh(campusGeoms, mats.campusGround);
      if (campusMesh) {
        campusMesh.name = 'campus-surface';
        this.group.add(campusMesh);
      }
    }

    if (!this.forExport) {
      // Campus boundary lines.
      const boundaryGroup = new THREE.Group();
      for (const ring of data.campus) {
        const pts = ring.map(([x, z]) => new THREE.Vector3(x, 0.2, z));
        if (pts.length < 3) continue;
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mats.goldLine);
        boundaryGroup.add(line);
      }
      boundaryGroup.name = 'campus-boundaries';
      this.group.add(boundaryGroup);
    }

    this.buildAreas();
    this.buildRoads();
    this.buildContextBuildings();
    this.buildCampusBuildings();
    this.buildTrees();
    this.buildDetails();
  }

  buildAreas() {
    const { data, mats } = this;
    const groups = new Map();
    const keyFor = (a) => {
      if (a.kind === 'green') return { key: 'green', y: 0.12, mat: mats.grass };
      if (a.kind === 'water') return { key: 'water', y: 0.112, mat: mats.water };
      if (a.kind === 'parking') return { key: 'parking', y: 0.15, mat: mats.asphalt };
      if (a.kind === 'plaza') return { key: 'plaza', y: 0.155, mat: mats.paving };
      if (a.kind === 'sports') {
        if (a.subtype === 'pitch') return { key: 'pitch', y: 0.145, mat: mats.field };
        return { key: 'track', y: 0.145, mat: mats.track };
      }
      return { key: 'green', y: 0.12, mat: mats.grass };
    };
    const shoreGeoms = [];
    const linePositions = [];
    for (const a of data.areas) {
      const { key, y, mat } = keyFor(a);
      if (!groups.has(key)) groups.set(key, { y, mat, geoms: [] });
      groups.get(key).geoms.push(createCapGeometry(a.ring, y, { up: true, uvScale: key === 'water' ? 18 : 16 }));
      if (key === 'water') {
        shoreGeoms.push(createCapGeometry(scaleRing(a.ring, 1.006), 0.104, { up: true, uvScale: 12 }));
      }
      if (a.kind === 'sports') {
        const { minX, maxX, minZ, maxZ, cx, cz } = polygonBounds(a.ring);
        const rx = (maxX - minX) * 0.5;
        const rz = (maxZ - minZ) * 0.5;
        const addEllipse = (fx, segments = 52) => {
          let prev = null;
          for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(t) * rx * fx;
            const z = cz + Math.sin(t) * rz * fx;
            if (prev) linePositions.push(prev[0], 0.158, prev[1], x, 0.158, z);
            prev = [x, z];
          }
        };
        if (a.subtype === 'track' || a.subtype === 'stadium') {
          addEllipse(0.94);
          addEllipse(0.86);
          addEllipse(0.78);
        } else if (a.subtype === 'pitch') {
          const insetX = rx * 0.9, insetZ = rz * 0.9;
          const corners = [
            [cx - insetX, cz - insetZ], [cx + insetX, cz - insetZ],
            [cx + insetX, cz + insetZ], [cx - insetX, cz + insetZ],
          ];
          for (let i = 0; i < 4; i++) {
            const p = corners[i], q = corners[(i + 1) % 4];
            linePositions.push(p[0], 0.158, p[1], q[0], 0.158, q[1]);
          }
          linePositions.push(cx, 0.158, cz - insetZ, cx, 0.158, cz + insetZ);
          const rr = Math.min(insetX, insetZ) * 0.22;
          let prev = null;
          for (let i = 0; i <= 32; i++) {
            const t = (i / 32) * Math.PI * 2;
            const x = cx + Math.cos(t) * rr, z = cz + Math.sin(t) * rr;
            if (prev) linePositions.push(prev[0], 0.158, prev[1], x, 0.158, z);
            prev = [x, z];
          }
        }
      }
    }
    for (const [key, g] of groups) {
      const mesh = mergeMesh(g.geoms, g.mat, { cast: false, receive: true });
      if (!mesh) continue;
      mesh.name = `area-${key}`;
      if (key === 'water') {
        mesh.castShadow = false;
        this.waterMeshes.push(mesh);
      }
      this.group.add(mesh);
    }

    if (shoreGeoms.length) {
      const shore = mergeMesh(shoreGeoms, mats.bank, { cast: false, receive: true });
      if (shore) {
        shore.name = 'water-shore';
        this.group.add(shore);
      }
    }

    // Rivers / canals as ribbons, with a stone shore.
    if (data.waterLines?.length) {
      const geoms = [];
      const shores = [];
      for (const w of data.waterLines) {
        const g = createRibbonGeometry(w.line, w.width, 0.108, 20);
        if (g) geoms.push(g);
        const s = createRibbonGeometry(w.line, w.width + 2.5, 0.104, 20);
        if (s) shores.push(s);
      }
      const mesh = mergeMesh(geoms, mats.water, { cast: false, receive: true });
      if (mesh) {
        mesh.name = 'water-lines';
        this.waterMeshes.push(mesh);
        this.group.add(mesh);
      }
      if (shores.length) {
        const shore = mergeMesh(shores, mats.bank, { cast: false, receive: true });
        if (shore) {
          shore.name = 'water-line-shores';
          this.group.add(shore);
        }
      }
    }

    if (linePositions.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      const lines = new THREE.LineSegments(g, mats.fieldLine);
      lines.name = 'sports-markings';
      this.group.add(lines);
    }
  }

  buildRoads() {
    const { data, mats } = this;
    const groups = {
      major: { geoms: [], mat: mats.asphalt, y: 0.188 },
      minor: { geoms: [], mat: mats.asphalt, y: 0.178 },
      path: { geoms: [], mat: mats.paving, y: 0.166 },
    };
    const sidewalkGeoms = [];
    const curbGeoms = [];
    const centerGeoms = [];
    for (const r of data.roads) {
      const isPath = ['footway', 'path', 'cycleway', 'steps', 'pedestrian'].includes(r.class_);
      const isMajor = ['primary', 'secondary', 'tertiary', 'trunk', 'motorway'].includes(r.class_);
      const g = groups[isPath ? 'path' : isMajor ? 'major' : 'minor'];
      const width = isPath ? Math.max(2.2, r.width * 0.72) : r.width;
      const geom = createRibbonGeometry(r.line, width, g.y, isPath ? 7 : 11);
      if (geom) g.geoms.push(geom);
      if (!isPath) {
        const sw = width + (isMajor ? 4.4 : 2.2);
        const swGeom = createRibbonGeometry(r.line, sw, 0.17, 9);
        if (swGeom) sidewalkGeoms.push(swGeom);
        const curbGeom = createRibbonGeometry(r.line, sw + 0.5, 0.176, 9);
        if (curbGeom) curbGeoms.push(curbGeom);
        if (isMajor) {
          const cl = createRibbonGeometry(r.line, 0.28, 0.192, 8);
          if (cl) centerGeoms.push(cl);
        }
      }
    }
    for (const [key, g] of Object.entries(groups)) {
      const mesh = mergeMesh(g.geoms, g.mat, { cast: false, receive: true });
      if (!mesh) continue;
      mesh.name = `roads-${key}`;
      this.group.add(mesh);
    }
    if (sidewalkGeoms.length) {
      const mesh = mergeMesh(sidewalkGeoms, mats.paving, { cast: false, receive: true });
      if (mesh) { mesh.name = 'road-sidewalks'; this.group.add(mesh); }
    }
    if (curbGeoms.length) {
      const mesh = mergeMesh(curbGeoms, mats.stone, { cast: false, receive: true });
      if (mesh) { mesh.name = 'road-curbs'; this.group.add(mesh); }
    }
    if (centerGeoms.length) {
      const mesh = mergeMesh(centerGeoms, mats.paving, { cast: false, receive: true });
      if (mesh) {
        mesh.material = new THREE.MeshBasicMaterial({ color: '#e9e1d1', transparent: true, opacity: 0.55, depthWrite: false });
        mesh.name = 'road-centerlines';
        this.group.add(mesh);
      }
    }
  }

  buildContextBuildings() {
    const { data, mats } = this;
    const buckets = new Map();
    const outlinePositions = [];
    for (const b of data.context) {
      const ring = b.ring;
      const y = b.height + 0.02;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length];
        outlinePositions.push(a[0], y, a[1], c[0], y, c[1]);
      }
      let geom;
      try {
        geom = createBuildingGeometry(b, { tint: buildingTint(b, true) });
      } catch (e) {
        console.warn('context building failed', b.id, e);
        continue;
      }
      const key = b.type === 'hospital' ? 'hospital' : b.type === 'commercial' ? 'commercial' : 'context';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(geom);
    }
    for (const [key, geoms] of buckets) {
      const wallMat = key === 'hospital' ? mats.wall.hospital : key === 'commercial' ? mats.wall.commercial : mats.wall.context;
      const mesh = mergeMesh(geoms, [mats.roof, wallMat, mats.hip, mats.stone], { preserveGroups: true });
      if (!mesh) continue;
      mesh.name = `context-buildings-${key}`;
      mesh.position.y = 0.02;
      this.group.add(mesh);
    }
    if (!this.forExport && outlinePositions.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(outlinePositions, 3));
      const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#37322c', transparent: true, opacity: 0.14, depthWrite: false }));
      lines.name = 'context-roof-outlines';
      this.group.add(lines);
    }
  }

  buildCampusBuildings() {
    const { data, mats } = this;
    const wallMats = mats.wall;
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'campus-buildings';
    for (const b of data.buildings) {
      let geometry;
      try {
        geometry = createBuildingGeometry(b, { tint: buildingTint(b, false) });
      } catch (e) {
        console.warn('building failed', b.id, b.name, e);
        continue;
      }
      const mat = wallMats[wallType(b.type)] || wallMats.default;
      const mesh = new THREE.Mesh(geometry, [mats.roof, mat, mats.hip, mats.stone]);
      mesh.position.y = 0.1;
      mesh.castShadow = this.shadows;
      mesh.receiveShadow = true;
      mesh.name = b.name || `building-${b.id}`;
      mesh.userData.building = b;
      mesh.userData.campusId = data.id;
      buildingGroup.add(mesh);
      this.pickMeshes.push(mesh);
    }
    this.group.add(buildingGroup);
    this.buildingGroup = buildingGroup;

    // Crisp roof outlines: a single line-segments draw call.
    if (this.forExport) return;
    const positions = [];
    for (const b of data.buildings) {
      if (b.special || b.roof === 'hip') continue;
      const y = b.height + 0.12;
      const ring = b.ring;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const c = ring[(i + 1) % ring.length];
        positions.push(a[0], y, a[1], c[0], y, c[1]);
      }
    }
    if (positions.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lineMat = new THREE.LineBasicMaterial({ color: '#3a352e', transparent: true, opacity: 0.2, depthWrite: false });
      const lines = new THREE.LineSegments(g, lineMat);
      lines.name = 'roof-outlines';
      this.group.add(lines);
    }
  }

  buildTrees() {
    const { data, mats } = this;
    const geoms = treeGeometries();
    const buckets = [[], [], []];
    for (const t of data.trees) {
      buckets[t[3] % 3].push(t);
    }
    const rng = seededRandom(data.trees.length * 7 + 3);
    this.treeMeshes = [];
    for (let v = 0; v < 3; v++) {
      const arr = buckets[v];
      if (!arr.length) continue;
      const inst = new THREE.InstancedMesh(geoms[v], mats.tree, arr.length);
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const color = new THREE.Color();
      for (let i = 0; i < arr.length; i++) {
        const [x, z, s] = arr[i];
        pos.set(x, 0.08, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
        scale.set(s, s * (0.92 + rng() * 0.2), s);
        m.compose(pos, q, scale);
        inst.setMatrixAt(i, m);
        const hue = 0.225 + rng() * 0.032;
        const sat = 0.22 + rng() * 0.14;
        const light = 0.37 + rng() * 0.18;
        color.setHSL(hue, sat, light);
        inst.setColorAt(i, color);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = this.shadows;
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      inst.name = `trees-${v}`;
      this.group.add(inst);
      this.treeMeshes.push(inst);
    }
  }

  buildDetails() {
    const { data, mats } = this;
    const stoneGeoms = [];
    const metalGeoms = [];
    const hedgeGeoms = [];
    const rng = seededRandom(1905 + data.buildings.length);

    for (const b of data.buildings) {
      if (b.special === 'oldGate') continue;
      const { minX, maxX, minZ, maxZ, cx, cz } = polygonBounds(b.ring);
      const w = maxX - minX;
      const d = maxZ - minZ;
      const h = b.height;
      if (w < 2 || d < 2) continue;

      // Stone base course and cornice.
      stoneGeoms.push(createWallGeometry(scaleRing(b.ring, 1.018), 0.72, { bottom: 0.08, uvScaleY: 4 }));
      stoneGeoms.push(createWallGeometry(scaleRing(b.ring, 1.012), 0.48, { bottom: h - 0.48, uvScaleY: 3 }));

      // Entrance canopy + two slim posts + steps.
      if (b.area > 420 && h > 8) {
        const cw = Math.max(4.5, Math.min(20, w * 0.24));
        const cd = Math.max(3.4, Math.min(5.2, d * 0.12 + 2.2));
        const cy = Math.min(5.0, Math.max(3.4, h * 0.16));
        const zFace = cz + d / 2;
        metalGeoms.push(detailBox(cw, 0.42, cd, cx, cy, zFace + cd / 2 - 0.1));
        metalGeoms.push(detailBox(cw * 0.32, 2.9, 0.24, cx, 1.55, zFace + 0.04));
        stoneGeoms.push(detailBox(cw * 0.9, 0.06, 5.2, cx, 0.14, zFace + 2.7));
        metalGeoms.push(detailBox(0.3, cy, 0.3, cx - cw * 0.38, cy / 2, zFace + cd * 0.82));
        metalGeoms.push(detailBox(0.3, cy, 0.3, cx + cw * 0.38, cy / 2, zFace + cd * 0.82));
        stoneGeoms.push(detailBox(cw * 0.86, 0.16, 1.15, cx, 0.17, zFace + 0.8));
        stoneGeoms.push(detailBox(cw * 0.78, 0.14, 0.8, cx, 0.31, zFace + 0.5));
        // clipped hedges flanking the entrance
        hedgeGeoms.push(detailBox(2.6, 0.8, 1.0, cx - cw * 0.66, 0.5, zFace + 1.6));
        hedgeGeoms.push(detailBox(2.6, 0.8, 1.0, cx + cw * 0.66, 0.5, zFace + 1.6));
      }

      // Balcony bands on dormitory blocks.
      if (b.type === 'dorm' && h > 10 && b.area > 260) {
        const bw = w * 0.84;
        for (const by of [5.2, 9.0, 12.8]) {
          if (by < h - 1.8) {
            stoneGeoms.push(detailBox(bw, 0.2, 0.9, cx, by, cz + d / 2 + 0.4));
          }
        }
      }

      // Rooftop mechanical penthouses.
      if (h > 18 && b.area > 420) {
        const count = h > 45 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const mw = Math.max(2.2, Math.min(8, w * 0.16));
          const md = Math.max(2.0, Math.min(7, d * 0.16));
          const mh = 1.4 + rng() * 2.0;
          const mx = cx + (rng() - 0.5) * Math.max(0, w - mw - 2);
          const mz = cz + (rng() - 0.5) * Math.max(0, d - md - 2);
          metalGeoms.push(detailBox(mw, mh, md, mx, h + mh / 2 + 0.02, mz));
        }
      }
    }

    const stoneMesh = mergeMesh(stoneGeoms, mats.stone, { cast: true, receive: true });
    if (stoneMesh) {
      stoneMesh.name = 'architectural-stone-detail';
      this.group.add(stoneMesh);
    }
    const metalMesh = mergeMesh(metalGeoms, mats.metal, { cast: true, receive: true });
    if (metalMesh) {
      metalMesh.name = 'architectural-metal-detail';
      this.group.add(metalMesh);
    }
    const hedgeMesh = mergeMesh(hedgeGeoms, mats.hedge, { cast: true, receive: true });
    if (hedgeMesh) {
      hedgeMesh.name = 'entrance-hedges';
      this.group.add(hedgeMesh);
    }

    this.buildStreetFurniture();
  }

  buildStreetFurniture() {
    const { data, mats } = this;
    const poleGeoms = [];
    const lampGeoms = [];
    const carGeoms = [];
    const poleRing = new THREE.CylinderGeometry(0.13, 0.19, 5.6, 5);
    poleRing.translate(0, 2.8, 0);
    withColor(poleRing);

    let lampCount = 0;
    for (const r of data.roads) {
      if (!['primary', 'secondary', 'tertiary', 'residential', 'service'].includes(r.class_)) continue;
      if (lampCount > 110 || r.line.length < 2) continue;
      const line = new THREE.LineCurve3(
        new THREE.Vector3(r.line[0][0], 0, r.line[0][1]),
        new THREE.Vector3(r.line[r.line.length - 1][0], 0, r.line[r.line.length - 1][1])
      );
      const length = line.getLength();
      if (length < 60) continue;
      const step = 48;
      let side = 1;
      for (let dist = 24; dist < length; dist += step) {
        const p = line.getPointAt(dist / length);
        const p2 = line.getPointAt(Math.min(1, (dist + 2) / length));
        const dx = p2.x - p.x, dz = p2.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l, nz = dx / l;
        const off = r.width / 2 + 3.1;
        const x = p.x + nx * off * side;
        const z = p.z + nz * off * side;
        side *= -1;
        const pole = poleRing.clone();
        pole.translate(x, 0.15, z);
        poleGeoms.push(pole);
        lampGeoms.push(detailBox(0.72, 0.24, 0.38, x, 5.75, z));
        lampCount++;
        if (lampCount > 110) break;
      }
    }

    const palette = ['#e9e3d6', '#b8493e', '#536b82', '#3f4548', '#d0ad63', '#7c8f78', '#d9d4cb'];
    const carAt = (x, z, angle) => {
      const color = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      const body = new THREE.BoxGeometry(4.15, 1.05, 1.85);
      body.rotateY(angle);
      body.translate(x, 0.72, z);
      const cabin = new THREE.BoxGeometry(2.05, 0.72, 1.62);
      cabin.rotateY(angle);
      cabin.translate(x + Math.cos(angle) * -0.15, 1.55, z + Math.sin(angle) * 0.15);
      for (const g of [body, cabin]) {
        const count = g.attributes.position.count;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        carGeoms.push(g);
      }
    };

    let carCount = 0;
    for (const a of data.areas) {
      if (a.kind !== 'parking' || carCount > 70) continue;
      const { minX, maxX, minZ, maxZ, cx, cz } = polygonBounds(a.ring);
      const w = maxX - minX, d = maxZ - minZ;
      if (w < 12 || d < 8) continue;
      const alongX = w >= d;
      const rows = alongX ? Math.max(1, Math.min(3, Math.floor(d / 9))) : Math.max(1, Math.min(3, Math.floor(w / 9)));
      const cols = alongX ? Math.max(1, Math.min(4, Math.floor(w / 12))) : Math.max(1, Math.min(4, Math.floor(d / 12)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.35) continue;
          const px = alongX ? minX + (c + 0.5) * (w / cols) : cx + (r - (rows - 1) / 2) * 3.2;
          const pz = alongX ? cz + (r - (rows - 1) / 2) * 3.2 : minZ + (c + 0.5) * (d / cols);
          carAt(px, pz, alongX ? 0 : Math.PI / 2);
          carCount++;
          if (carCount > 70) break;
        }
      }
    }

    // A few cars on the larger approach roads.
    for (const r of data.roads) {
      if (carCount > 78) break;
      if (!['primary', 'secondary', 'tertiary'].includes(r.class_) || r.line.length < 2) continue;
      const line = new THREE.LineCurve3(
        new THREE.Vector3(r.line[0][0], 0, r.line[0][1]),
        new THREE.Vector3(r.line[r.line.length - 1][0], 0, r.line[r.line.length - 1][1])
      );
      const length = line.getLength();
      if (length < 90) continue;
      for (let dist = 55; dist < length && carCount < 78; dist += 92) {
        const p = line.getPointAt(dist / length);
        const p2 = line.getPointAt(Math.min(1, (dist + 2) / length));
        const angle = Math.atan2(p2.z - p.z, p2.x - p.x);
        const side = carCount % 2 ? 1 : -1;
        const nx = -Math.sin(angle), nz = Math.cos(angle);
        carAt(p.x + nx * (r.width * 0.25) * side, p.z + nz * (r.width * 0.25) * side, angle);
        carCount++;
      }
    }

    if (poleGeoms.length) {
      const merged = mergeGeometries(poleGeoms, false);
      for (const g of poleGeoms) g.dispose();
      if (merged) {
        const mesh = new THREE.Mesh(merged, mats.metal);
        mesh.name = 'street-lamp-poles';
        mesh.castShadow = this.shadows;
        this.group.add(mesh);
      }
    }
    if (lampGeoms.length) {
      const merged = mergeGeometries(lampGeoms, false);
      for (const g of lampGeoms) g.dispose();
      if (merged) {
        const mesh = new THREE.Mesh(merged, mats.lamp);
        mesh.name = 'street-lamp-heads';
        this.group.add(mesh);
        this.lampMesh = mesh;
      }
    }
    if (carGeoms.length) {
      const merged = mergeGeometries(carGeoms, false);
      for (const g of carGeoms) g.dispose();
      if (merged) {
        const mesh = new THREE.Mesh(merged, mats.car);
        mesh.name = 'parked-cars';
        mesh.castShadow = this.shadows;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
  }

  setNight(night) {
    this.night = night;
    for (const [type, mat] of Object.entries(this.mats.wall)) {
      if (type === 'context') {
        mat.emissiveIntensity = night ? 0.5 : 0;
      } else {
        mat.emissiveIntensity = night ? 1.65 : 0;
      }
    }
    if (this.mats.mist) {
      this.mats.mist.color.set(night ? '#9bb1c8' : '#dcecf4');
      this.mats.mist.opacity = night ? 0.28 : 0.42;
    }
    if (this.mats.water) {
      this.mats.water.color.set(night ? '#1b3038' : '#436d72');
      this.mats.water.envMapIntensity = night ? 0.45 : 1.15;
    }
    if (this.mats.lamp) {
      this.mats.lamp.emissiveIntensity = night ? 1.65 : 0.06;
    }
  }

  update(dt, elapsed) {
    if (this.mats.waterNormal) {
      this.mats.waterNormal.offset.x = (elapsed * 0.006) % 1;
      this.mats.waterNormal.offset.y = (elapsed * 0.004) % 1;
    }
  }

  dispose() {
    this.group.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
  }
}
