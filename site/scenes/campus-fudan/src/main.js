import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextureLibrary, setTextureAnisotropy } from './textures.js';
import { CampusModel, createMaterials } from './campusScene.js';
import { LabelLayer } from './labels.js';

/* ------------------------------------------------------------------ helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const CAMPUS_ORDER = ['handan', 'jiangwan', 'fenglin'];
const CAMPUS_CODES = { handan: '01 / HANDAN', jiangwan: '02 / JIANGWAN', fenglin: '03 / FENGLIN' };
const CAMPUS_YEARS = { handan: '1922', jiangwan: '2005', fenglin: '1937' };
const TYPE_LABEL = {
  campus: '教学科研', dorm: '学生生活', library: '图书馆', historic: '历史建筑',
  sports: '体育设施', hospital: '附属医院', landmark: '校园地标', default: '校园建筑',
  commercial: '周边建筑', residential: '居住建筑',
};
const TYPE_DESC = {
  campus: '教学、科研与办公空间',
  dorm: '学生住宿与生活服务空间',
  library: '图书馆与学习空间',
  historic: '校园历史建筑',
  sports: '体育教学与运动空间',
  hospital: '医学诊疗与科研空间',
  landmark: '校园标志性建筑',
  default: '校园建筑',
};

/* ------------------------------------------------------------------ dom */
const canvas = $('#scene');
const labelsRoot = $('#labels');
const tooltip = $('#tooltip');
const intro = $('#intro');
const loading = $('#loading');
const loadStep = $('#load-step');
const loadPercent = $('#load-percent');
const loadFill = $('#load-fill');
const campusCard = $('#campus-card');
const overviewCard = $('#overview-card');
const detailPanel = $('#detail-panel');
const aboutModal = $('#about-modal');
const directoryModal = $('#directory-modal');

/* ------------------------------------------------------------------ renderer */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#a9cadb', 0.00012);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 2, 60000);
camera.position.set(0, 6000, 7600);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.7;
controls.screenSpacePanning = false;
controls.minDistance = 80;
controls.maxDistance = 10000;
controls.minPolarAngle = THREE.MathUtils.degToRad(8);
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.zoomToCursor = true;
controls.enabled = false;

/* ------------------------------------------------------------------ sky and light */
const sunDirection = new THREE.Vector3(-0.45, 0.55, -0.55).normalize();

function makeSkyTexture(night = false) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext('2d');
  const rng = (() => { let s = night ? 77 : 19; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  if (night) {
    g.addColorStop(0, '#040810');
    g.addColorStop(0.3, '#0a1526');
    g.addColorStop(0.48, '#15243a');
    g.addColorStop(0.56, '#1e2f42');
    g.addColorStop(0.72, '#142131');
    g.addColorStop(1, '#0a121c');
  } else {
    g.addColorStop(0, '#4b7fb6');
    g.addColorStop(0.22, '#79a4cd');
    g.addColorStop(0.43, '#bfd4e1');
    g.addColorStop(0.53, '#e4ebe7');
    g.addColorStop(0.62, '#bcdeea');
    g.addColorStop(0.8, '#90bdd4');
    g.addColorStop(1, '#6f9db8');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2048, 1024);

  if (!night) {
    // high cloud streaks
    ctx.save();
    ctx.filter = 'blur(24px)';
    for (let i = 0; i < 24; i++) {
      const x = rng() * 2048;
      const y = 180 + rng() * 330;
      const w = 100 + rng() * 340;
      const h = 14 + rng() * 34;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, w);
      cg.addColorStop(0, `rgba(255,251,242,${0.08 + rng() * 0.12})`);
      cg.addColorStop(1, 'rgba(255,251,242,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // sun + glow, on the west (left)
    const sx = 390, sy = 318;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 250);
    glow.addColorStop(0, 'rgba(255,247,220,.95)');
    glow.addColorStop(0.04, 'rgba(255,243,208,.85)');
    glow.addColorStop(0.18, 'rgba(255,238,194,.28)');
    glow.addColorStop(1, 'rgba(255,238,194,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 2048, 1024);
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,251,234,.98)';
    ctx.fill();
  } else {
    // stars
    for (let i = 0; i < 800; i++) {
      const x = rng() * 2048;
      const y = rng() * 520;
      const a = 0.18 + rng() * 0.7;
      const r = rng() < 0.92 ? 0.6 + rng() * 0.9 : 1.5 + rng() * 1.2;
      ctx.fillStyle = `rgba(214,228,247,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // moon and halo
    const mx = 1590, my = 210;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
    halo.addColorStop(0, 'rgba(214,229,247,.28)');
    halo.addColorStop(0.2, 'rgba(196,215,238,.12)');
    halo.addColorStop(1, 'rgba(196,215,238,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 2048, 1024);
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,239,248,.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx - 9, my + 5, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(225,234,245,.16)';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = night ? 'night-sky' : 'day-sky';
  return tex;
}

const daySkyTexture = makeSkyTexture(false);
const nightSkyTexture = makeSkyTexture(true);
scene.background = daySkyTexture;

const hemi = new THREE.HemisphereLight('#cbdfeb', '#554b3e', 0.48);
scene.add(hemi);

const ambient = new THREE.AmbientLight('#e9f2ff', 0.04);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight('#ffe8c2', 3.9);
sunLight.position.copy(sunDirection).multiplyScalar(4600);
sunLight.target.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(window.innerWidth < 900 ? 2048 : 4096, window.innerWidth < 900 ? 2048 : 4096);
sunLight.shadow.camera.near = 200;
sunLight.shadow.camera.far = 12000;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.35;
sunLight.shadow.radius = 3.2;
sunLight.shadow.camera.left = -1800;
sunLight.shadow.camera.right = 1800;
sunLight.shadow.camera.top = 1800;
sunLight.shadow.camera.bottom = -1800;
sunLight.shadow.camera.updateProjectionMatrix();
scene.add(sunLight);
scene.add(sunLight.target);

const moonLight = new THREE.DirectionalLight('#adc6ed', 0.0);
moonLight.position.set(2500, 3200, 2200);
moonLight.target.position.set(0, 0, 0);
scene.add(moonLight);
scene.add(moonLight.target);

/* ------------------------------------------------------------------ table */
function makeTableTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(512, 512, 30, 512, 512, 512);
  g.addColorStop(0, '#3a342c');
  g.addColorStop(0.45, '#2b2621');
  g.addColorStop(0.8, '#1a1714');
  g.addColorStop(1, '#11100e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  const rng = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(255,240,215,${rng() * 0.022})`;
    ctx.fillRect(rng() * 1024, rng() * 1024, 1, 1);
  }
  return new THREE.CanvasTexture(c);
}
const tableTex = makeTableTexture();
tableTex.colorSpace = THREE.SRGBColorSpace;
const table = new THREE.Mesh(
  new THREE.CircleGeometry(13000, 128),
  new THREE.MeshStandardMaterial({ map: tableTex, color: '#b7aa97', roughness: 1, metalness: 0.02 })
);
table.rotation.x = -Math.PI / 2;
table.position.y = -46;
table.receiveShadow = true;
table.visible = false;
scene.add(table);

const tableRing = new THREE.Mesh(
  new THREE.RingGeometry(4600, 4622, 128),
  new THREE.MeshBasicMaterial({ color: '#c7a15d', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
);
tableRing.rotation.x = -Math.PI / 2;
tableRing.position.y = -44;
tableRing.visible = false;
scene.add(tableRing);

/* ------------------------------------------------------------------ environment */
let dayEnv, nightEnv;
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

function makeEnvTexture(night = false) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  if (night) {
    g.addColorStop(0, '#07101d');
    g.addColorStop(0.42, '#152236');
    g.addColorStop(0.53, '#27313c');
    g.addColorStop(0.6, '#12100e');
    g.addColorStop(1, '#090806');
  } else {
    g.addColorStop(0, '#8fb2d6');
    g.addColorStop(0.38, '#c8dce6');
    g.addColorStop(0.52, '#eef1e9');
    g.addColorStop(0.58, '#b7ac9b');
    g.addColorStop(1, '#6f6252');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // sun / moon glow
  const gx = 320, gy = night ? 150 : 160;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, night ? 40 : 105);
  glow.addColorStop(0, night ? 'rgba(215,228,243,.85)' : 'rgba(255,245,218,1)');
  glow.addColorStop(0.14, night ? 'rgba(205,220,240,.24)' : 'rgba(255,237,198,.45)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 512);
  if (!night) {
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 1024;
      const y = 100 + Math.random() * 140;
      const r = 25 + Math.random() * 80;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
      cg.addColorStop(0, 'rgba(255,255,255,.13)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildEnvironments() {
  const dtex = makeEnvTexture(false);
  dayEnv = pmrem.fromEquirectangular(dtex).texture;
  dtex.dispose();
  const ntex = makeEnvTexture(true);
  nightEnv = pmrem.fromEquirectangular(ntex).texture;
  ntex.dispose();
  scene.environment = dayEnv;
}
buildEnvironments();

/* ------------------------------------------------------------------ app state */
const state = {
  data: null,
  models: new Map(),
  active: 'handan',
  mode: 'detail',
  night: false,
  labels: true,
  started: false,
  selected: null,
  hovered: null,
};
let cameraTween = null;
let hintTimer = null;
let pointerDown = null;

/* ------------------------------------------------------------------ flash overlay */
const flash = document.createElement('div');
flash.className = 'scene-flash';
document.body.appendChild(flash);
function sceneFlash() {
  flash.classList.add('is-on');
  setTimeout(() => flash.classList.remove('is-on'), 180);
}

/* ------------------------------------------------------------------ textures & materials */
const createCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const textures = createTextureLibrary(createCanvas);
setTextureAnisotropy(textures, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const materials = createMaterials(textures, null);

/* ------------------------------------------------------------------ label layer */
const labelLayer = new LabelLayer(labelsRoot, {
  onSelect: (model, building) => selectBuilding(model, building),
  onCampus: (id) => switchCampus(id),
});
labelLayer.setVisible(false);

/* ------------------------------------------------------------------ data loading */
async function loadData() {
  const res = await fetch('./data/campuses.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`数据加载失败：${res.status}`);
  return res.json();
}

async function buildWorld() {
  setProgress(6, '读取公开地理数据');
  const data = await loadData();
  state.data = data;
  setProgress(18, '整理校区边界与建筑轮廓');
  await nextFrame();

  for (let i = 0; i < data.campuses.length; i++) {
    const c = data.campuses[i];
    setProgress(22 + i * 25, `生成${c.name}体块与树木`);
    await nextFrame();
    const model = new CampusModel(c, materials, { shadows: true });
    model.group.visible = false;
    scene.add(model.group);
    model.meshById = new Map();
    for (const m of model.pickMeshes) {
      if (m.userData.building) m.meshByIdKey = `${c.id}:${m.userData.building.id}`;
    }
    state.models.set(c.id, model);
    setProgress(42 + i * 25, `${c.name} · ${c.stats.buildings} 栋建筑 / ${c.trees.length} 棵树`);
    await nextFrame();
  }

  setProgress(98, '校准光影与场景');
  await nextFrame();
  setProgress(100, '准备就绪');
  await nextFrame();

  // initial detail view (hidden behind intro)
  const handan = state.models.get('handan');
  handan.group.visible = true;
  const view = detailCamera('handan');
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  controls.update();
  fitShadow('detail', handan.data);
  labelLayer.setCampus(handan, handan.data);
  setCampusUI(handan.data);

  loading.classList.add('is-done');
  setTimeout(() => { loading.hidden = true; }, 800);
  intro.querySelector('#enter-btn').disabled = false;
}

function setProgress(p, label) {
  loadFill.style.width = `${clamp(p, 0, 100)}%`;
  loadPercent.textContent = `${Math.round(p)}%`;
  if (label) loadStep.textContent = label;
}

/* ------------------------------------------------------------------ cameras */
function detailCamera(id) {
  const model = state.models.get(id);
  const data = model.data;
  const maxDim = Math.max(data.extent.width, data.extent.depth);
  const fit = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.86;
  const az = THREE.MathUtils.degToRad(33);
  const el = THREE.MathUtils.degToRad(25);
  const target = new THREE.Vector3(-maxDim * 0.06, Math.min(28, maxDim * 0.018), 0);
  const position = new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * fit,
    Math.sin(el) * fit,
    Math.cos(az) * Math.cos(el) * fit
  ).add(target);
  return { position, target };
}

function overviewCamera() {
  return {
    position: new THREE.Vector3(-180, 3150, 4450),
    target: new THREE.Vector3(-180, 40, 0),
  };
}

function tweenCamera(position, target, duration = 1600) {
  cameraTween = {
    fromPos: camera.position.clone(),
    toPos: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
    start: performance.now(),
    duration,
  };
}

function updateCameraTween(now) {
  if (!cameraTween) return;
  const t = clamp((now - cameraTween.start) / cameraTween.duration, 0, 1);
  const e = easeInOutCubic(t);
  camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
  if (t >= 1) cameraTween = null;
}
controls.addEventListener('start', () => { cameraTween = null; });

function fitShadow(mode, data) {
  const radius = mode === 'overview' ? 3900 : Math.max(data.extent.width, data.extent.depth) * 0.9 + 220;
  const cam = sunLight.shadow.camera;
  cam.left = -radius;
  cam.right = radius;
  cam.top = radius;
  cam.bottom = -radius;
  cam.near = 200;
  cam.far = 12000;
  cam.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ campus transforms */
function prepareDetailTransforms(activeId) {
  table.visible = false;
  tableRing.visible = false;
  for (const [id, model] of state.models) {
    if (id === activeId) {
      model.group.visible = true;
      model.group.position.set(0, 0, 0);
      model.group.scale.setScalar(1);
    } else {
      model.group.visible = false;
    }
  }
  scene.updateMatrixWorld(true);
}

function prepareOverviewTransforms() {
  table.visible = false;
  tableRing.visible = false;
  const tile = 1180;
  const layout = {
    handan: [-1120, 0, -520],
    jiangwan: [620, 0, -520],
    fenglin: [-260, 0, 860],
  };
  for (const [id, model] of state.models) {
    const maxDim = Math.max(model.data.extent.width, model.data.extent.depth);
    const s = tile / maxDim;
    model.group.visible = true;
    model.group.scale.setScalar(s);
    model.group.position.set(layout[id][0], 0, layout[id][2]);
  }
  scene.updateMatrixWorld(true);
  labelLayer.setOverview([
    { id: 'handan', model: null, name: '邯郸校区', sub: 'HANDAN · 1922', x: -1120, y: 210, z: -520 },
    { id: 'jiangwan', model: null, name: '江湾校区', sub: 'JIANGWAN · 2005', x: 620, y: 180, z: -520 },
    { id: 'fenglin', model: null, name: '枫林校区', sub: 'FENGLIN · 1937', x: -260, y: 200, z: 860 },
  ]);
}

/* ------------------------------------------------------------------ UI */
function campusCode(id) { return CAMPUS_CODES[id] || ''; }

function setCampusUI(data) {
  campusCard.hidden = false;
  overviewCard.hidden = true;
  $('#campus-code').textContent = campusCode(data.id);
  $('#campus-year').textContent = CAMPUS_YEARS[data.id] || '';
  $('#campus-title').textContent = data.name;
  $('#campus-en').textContent = data.en;
  $('#campus-tagline').textContent = data.tagline;
  $('#campus-desc').textContent = data.description;
  const mu = (data.areaLabel.match(/[\d,]+/) || ['—'])[0];
  $('#stat-area').textContent = mu;
  $('#stat-buildings').textContent = data.stats.buildings;
  $('#stat-height').textContent = Math.round(data.stats.maxHeight);
  setActiveTab(data.id);
  updateDirectoryCount();
}

function setOverviewUI() {
  campusCard.hidden = true;
  overviewCard.hidden = false;
  setActiveTab('overview');
  updateDirectoryCount();
}

function setActiveTab(id) {
  for (const tab of $$('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.campus === id);
  }
}

function clearSelection() {
  hideTooltip();
  state.selected = null;
  document.body.classList.remove('detail-open');
  detailPanel.classList.remove('is-open');
  setTimeout(() => {
    if (!state.selected) detailPanel.hidden = true;
  }, 350);
  if (selectionOverlay) {
    selectionOverlay.parent?.remove(selectionOverlay);
    selectionOverlay.material.dispose();
    selectionOverlay = null;
  }
}

function typeLabel(t) { return TYPE_LABEL[t] || '校园建筑'; }

function describeBuilding(b, campus) {
  if (b.desc) return b.desc;
  const h = Math.round(b.height);
  const lv = b.levels || Math.max(1, Math.round(h / 3.6));
  return `位于${campus.name}的${typeLabel(b.type)}建筑，高约 ${h} 米，地上约 ${lv} 层，占地约 ${Math.round(b.area).toLocaleString('zh-CN')} 平方米。该体块依据 OpenStreetMap 建筑轮廓整理，高度与层数结合公开资料推定。`;
}

function openDetail(model, b) {
  state.selected = { model, building: b };
  document.body.classList.add('detail-open');

  $('#detail-type').textContent = typeLabel(b.type);
  $('#detail-title').textContent = b.name || '校园建筑';
  $('#detail-en').textContent = b.en || 'FUDAN CAMPUS BUILDING';
  $('#detail-desc').textContent = describeBuilding(b, model.data);
  $('#detail-height').textContent = `${Math.round(b.height)} m`;
  $('#detail-levels').textContent = `${b.levels || '—'} F`;
  $('#detail-area').textContent = `${Math.round(b.area).toLocaleString('zh-CN')} m²`;

  detailPanel.hidden = false;
  requestAnimationFrame(() => detailPanel.classList.add('is-open'));
  placeSelectionOverlay(model, b);
}

let selectionOverlay = null;
let hoverOverlay = null;

function placeSelectionOverlay(model, b) {
  if (selectionOverlay) {
    selectionOverlay.parent?.remove(selectionOverlay);
    selectionOverlay.material.dispose();
    selectionOverlay = null;
  }
  const mesh = model.pickMeshes.find((m) => m.userData.building === b);
  if (!mesh) return;
  const mat = new THREE.MeshBasicMaterial({
    color: '#d9b56d', transparent: true, opacity: 0.22,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
  });
  const overlay = new THREE.Mesh(mesh.geometry, mat);
  overlay.position.copy(mesh.position);
  overlay.scale.setScalar(1.005);
  overlay.renderOrder = 4;
  overlay.material.polygonOffset = true;
  overlay.material.polygonOffsetFactor = -2;
  overlay.material.polygonOffsetUnits = -2;
  mesh.parent.add(overlay);
  selectionOverlay = overlay;
}

function placeHoverOverlay(model, b) {
  if (hoverOverlay) {
    hoverOverlay.parent?.remove(hoverOverlay);
    hoverOverlay.material.dispose();
    hoverOverlay = null;
  }
  if (!b) return;
  const mesh = model.pickMeshes.find((m) => m.userData.building === b);
  if (!mesh) return;
  const mat = new THREE.MeshBasicMaterial({
    color: '#f4dfb0', transparent: true, opacity: 0.13,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const overlay = new THREE.Mesh(mesh.geometry, mat);
  overlay.position.copy(mesh.position);
  overlay.scale.setScalar(1.003);
  overlay.renderOrder = 3;
  overlay.material.polygonOffset = true;
  overlay.material.polygonOffsetFactor = -1;
  overlay.material.polygonOffsetUnits = -1;
  mesh.parent.add(overlay);
  hoverOverlay = overlay;
}

/* ------------------------------------------------------------------ campus switching */
function switchCampus(id, { animate = true, flash: doFlash = true } = {}) {
  if (!state.models.has(id)) return;
  if (state.mode === 'overview' && state.active === id && state.started) {
    // entering from overview
  }
  const model = state.models.get(id);
  state.active = id;
  state.mode = 'detail';
  state.selected = null;
  if (doFlash) sceneFlash();
  prepareDetailTransforms(id);
  fitShadow('detail', model.data);
  setCampusUI(model.data);
  labelLayer.setCampus(model, model.data);
  labelLayer.setVisible(state.labels && state.started);
  clearSelection();
  const view = detailCamera(id);
  if (animate) tweenCamera(view.position, view.target, 1550);
  else {
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    controls.update();
  }
  hideTooltip();
}

function showOverview({ animate = true } = {}) {
  state.mode = 'overview';
  state.active = null;
  state.selected = null;
  sceneFlash();
  prepareOverviewTransforms();
  fitShadow('overview', null);
  setOverviewUI();
  labelLayer.setVisible(state.labels && state.started);
  clearSelection();
  const view = overviewCamera();
  if (animate) tweenCamera(view.position, view.target, 1700);
  else {
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    controls.update();
  }
  hideTooltip();
}

function resetView() {
  if (state.mode === 'overview') {
    const v = overviewCamera();
    tweenCamera(v.position, v.target, 1200);
  } else {
    const v = detailCamera(state.active);
    tweenCamera(v.position, v.target, 1200);
  }
}

function focusBuilding(model, b) {
  const base = new THREE.Vector3(b.center[0], Math.min(b.height * 0.45, 55), b.center[1]);
  if (model.group.parent) base.applyMatrix4(model.group.matrixWorld);
  const dist = clamp(b.height * 2.8 + 150, 300, 900);
  const az = THREE.MathUtils.degToRad(28);
  const el = THREE.MathUtils.degToRad(25);
  const pos = new THREE.Vector3(
    base.x + Math.sin(az) * Math.cos(el) * dist,
    base.y + Math.sin(el) * dist,
    base.z + Math.cos(az) * Math.cos(el) * dist
  );
  tweenCamera(pos, base, 1150);
}

/* ------------------------------------------------------------------ selection */
function selectBuilding(model, b) {
  hideTooltip();
  if (state.mode === 'overview') {
    switchCampus(model.data.id);
    setTimeout(() => {
      const m = state.models.get(model.data.id);
      openDetail(m, b);
      setTimeout(() => focusBuilding(m, b), 550);
    }, 500);
    return;
  }
  openDetail(model, b);
  setTimeout(() => focusBuilding(model, b), 260);
}

/* ------------------------------------------------------------------ picking */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pickScheduled = false;

function pickAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = state.mode === 'overview'
    ? [...state.models.values()].flatMap((m) => m.pickMeshes)
    : (state.models.get(state.active)?.pickMeshes || []);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const mesh = hits[0].object;
  const model = state.models.get(mesh.userData.campusId);
  return model && mesh.userData.building ? { model, building: mesh.userData.building, mesh } : null;
}

function schedulePick(clientX, clientY, callback) {
  if (pickScheduled) return;
  pickScheduled = true;
  requestAnimationFrame(() => {
    pickScheduled = false;
    callback(pickAt(clientX, clientY));
  });
}

function updateHover(clientX, clientY) {
  if (state.dragging) return;
  if (state.selected || document.body.classList.contains('detail-open')) { hideTooltip(); return; }
  schedulePick(clientX, clientY, (hit) => {
    if (state.selected || document.body.classList.contains('detail-open')) {
      hideTooltip();
      return;
    }
    if (!hit) {
      canvas.style.cursor = '';
      hideTooltip();
      if (hoverOverlay) {
        hoverOverlay.parent?.remove(hoverOverlay);
        hoverOverlay.material.dispose();
        hoverOverlay = null;
      }
      state.hovered = null;
      return;
    }
    canvas.style.cursor = 'pointer';
    if (state.hovered !== hit.building) {
      state.hovered = hit.building;
      placeHoverOverlay(hit.model, hit.building);
    }
    showTooltip(clientX, clientY, hit.building);
  });
}

function showTooltip(x, y, b) {
  tooltip.hidden = false;
  tooltip.innerHTML = `<strong>${escapeHtml(b.name || '校园建筑')}</strong><span>${Math.round(b.height)} m · ${b.levels || '—'} F · 点击查看</span>`;
  const pad = 16;
  const tw = tooltip.offsetWidth || 160;
  const th = tooltip.offsetHeight || 50;
  let left = x + 16;
  let top = y + 16;
  if (left + tw > window.innerWidth - 12) left = x - tw - 16;
  if (top + th > window.innerHeight - 12) top = y - th - 16;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------------ pointer */
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  state.dragging = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerDown) {
    const d = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    if (d > 5) state.dragging = true;
  }
  updateHover(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  const wasDrag = state.dragging || (pointerDown && Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5);
  pointerDown = null;
  state.dragging = false;
  if (wasDrag) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (hit) {
    selectBuilding(hit.model, hit.building);
  } else {
    clearSelection();
  }
});
canvas.addEventListener('pointerleave', () => {
  pointerDown = null;
  hideTooltip();
  canvas.style.cursor = '';
});
canvas.addEventListener('dblclick', (e) => {
  const hit = pickAt(e.clientX, e.clientY);
  if (hit) {
    if (state.mode === 'overview') switchCampus(hit.model.data.id);
    setTimeout(() => focusBuilding(state.models.get(hit.model.data.id) || hit.model, hit.building), state.mode === 'overview' ? 300 : 0);
  }
});

/* ------------------------------------------------------------------ lighting modes */
function setNight(night) {
  hideTooltip();
  state.night = night;
  document.body.classList.toggle('night', night);
  $('#btn-night').setAttribute('aria-pressed', String(night));
  if (night) {
    scene.background = nightSkyTexture;
    scene.fog.color.set('#111a25');
    scene.fog.density = 0.00018;
    scene.environment = nightEnv;
    sunLight.intensity = 0.0;
    moonLight.intensity = 1.05;
    hemi.color.set('#3c506d');
    hemi.groundColor.set('#14110f');
    hemi.intensity = 0.72;
    ambient.color.set('#7f93b4');
    ambient.intensity = 0.22;
    renderer.toneMappingExposure = 0.95;
  } else {
    scene.background = daySkyTexture;
    scene.fog.color.set('#a9cadb');
    scene.fog.density = 0.00012;
    scene.environment = dayEnv;
    sunLight.intensity = 3.9;
    moonLight.intensity = 0.0;
    hemi.color.set('#e4edf2');
    hemi.groundColor.set('#786b58');
    hemi.intensity = 0.48;
    ambient.color.set('#ffffff');
    ambient.intensity = 0.04;
    renderer.toneMappingExposure = 0.98;
  }
  for (const model of state.models.values()) model.setNight(night);
}

function setLabels(visible) {
  state.labels = visible;
  $('#btn-labels').setAttribute('aria-pressed', String(visible));
  labelLayer.setVisible(visible && state.started);
}

/* ------------------------------------------------------------------ HUD */
let hudFrame = 0;
function updateHUD() {
  hudFrame++;
  const dist = camera.position.distanceTo(controls.target);
  const mpp = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / window.innerHeight;
  const targetPx = Math.min(140, Math.max(74, window.innerWidth * 0.085));
  const raw = mpp * targetPx;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10].map((v) => v * pow);
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - raw);
    if (d < bestDiff) { best = c; bestDiff = d; }
  }
  const px = best / mpp;
  const label = best >= 1000 ? `${(best / 1000).toFixed(best >= 2000 ? 0 : 1)} km` : `${Math.round(best)} m`;
  $('#scale-label').textContent = label;
  $('#scale-fill').style.width = `${Math.min(180, px)}px`;
  $('.scale-track').style.width = `${Math.min(180, px)}px`;

  const dir = camera.position.clone().sub(controls.target);
  const angle = Math.atan2(dir.x, dir.z);
  const needle = $('#compass-needle');
  if (needle) needle.setAttribute('transform', `rotate(${(angle * 180 / Math.PI).toFixed(1)} 20 20)`);
}

/* ------------------------------------------------------------------ intro & modal */
function enterScene() {
  if (state.started) return;
  state.started = true;
  controls.enabled = true;
  intro.classList.add('is-leaving');
  setTimeout(() => { intro.hidden = true; }, 950);
  labelLayer.setVisible(state.labels);
  const v = detailCamera('handan');
  tweenCamera(v.position, v.target, 2200);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $('#hint').classList.add('is-hidden'), 9000);
}

function openAbout() {
  aboutModal.hidden = false;
  requestAnimationFrame(() => aboutModal.classList.add('is-open'));
}
function closeAbout() {
  aboutModal.classList.remove('is-open');
  setTimeout(() => { aboutModal.hidden = true; }, 350);
}

function isDirectoryBuilding(b) {
  if (!b.name || b.name === '校园建筑') return false;
  if (/^\d+号楼$/.test(b.name) || /^\d+#$/.test(b.name)) return false;
  if (b.type === 'dorm' && b.area < 600) return false;
  return b.name.length >= 2;
}

function directoryEntries() {
  const ids = state.mode === 'overview' ? CAMPUS_ORDER.filter((id) => state.models.has(id)) : [state.active];
  const entries = [];
  for (const id of ids) {
    const model = state.models.get(id);
    if (!model) continue;
    for (const b of model.data.buildings) {
      if (isDirectoryBuilding(b)) entries.push({ model, b });
    }
  }
  const typeOrder = { landmark: 0, library: 1, historic: 2, campus: 3, sports: 4, hospital: 5, default: 6, commercial: 7 };
  entries.sort((a, b) => {
    const ta = typeOrder[a.b.type] ?? 8;
    const tb = typeOrder[b.b.type] ?? 8;
    if (ta !== tb) return ta - tb;
    if (state.mode === 'overview' && a.model.data.id !== b.model.data.id) {
      return CAMPUS_ORDER.indexOf(a.model.data.id) - CAMPUS_ORDER.indexOf(b.model.data.id);
    }
    return (b.b.height || 0) - (a.b.height || 0);
  });
  return entries;
}

function updateDirectoryCount() {
  const el = $('#directory-count');
  if (!el) return;
  if (state.mode !== 'detail' || !state.active) {
    el.textContent = '';
    return;
  }
  const model = state.models.get(state.active);
  const count = model ? model.data.buildings.filter(isDirectoryBuilding).length : 0;
  el.textContent = `${count} 个可查询`;
}

function renderDirectory(filter = '') {
  const list = $('#directory-list');
  const entries = directoryEntries();
  const q = filter.trim().toLowerCase();
  list.replaceChildren();
  let found = 0;
  let currentCampus = null;
  for (const entry of entries) {
    const { model, b } = entry;
    const hay = `${b.name} ${typeLabel(b.type)} ${b.height}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    if (state.mode === 'overview' && currentCampus !== model.data.id) {
      currentCampus = model.data.id;
      const head = document.createElement('div');
      head.className = 'dir-group';
      head.innerHTML = `<span>${model.data.name}</span><span>${model.data.en.toUpperCase()}</span>`;
      list.appendChild(head);
    }
    const row = document.createElement('button');
    row.className = 'dir-row';
    row.type = 'button';
    row.dataset.campus = model.data.id;
    row.dataset.id = b.id;
    row.innerHTML = `
      <span class="dir-num">${String(found + 1).padStart(2, '0')}</span>
      <span class="dir-name"><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(describeDirectorySub(b))}</small></span>
      <span class="dir-type">${typeLabel(b.type)}</span>
      <span class="dir-h">${Math.round(b.height)} m</span>
      <span class="dir-a">定位 →</span>`;
    row.addEventListener('click', () => {
      closeDirectory();
      const targetModel = state.models.get(model.data.id);
      const target = targetModel.data.buildings.find((x) => x.id === b.id);
      if (state.mode === 'overview' || state.active !== model.data.id) {
        switchCampus(model.data.id);
        setTimeout(() => {
          openDetail(targetModel, target);
          setTimeout(() => focusBuilding(targetModel, target), 600);
        }, 500);
      } else {
        openDetail(targetModel, target);
        setTimeout(() => focusBuilding(targetModel, target), 260);
      }
    });
    list.appendChild(row);
    found++;
  }
  if (!found) {
    const empty = document.createElement('div');
    empty.className = 'directory-empty';
    empty.textContent = '没有匹配的建筑';
    list.appendChild(empty);
  }
  const scope = state.mode === 'overview' ? '三校区' : state.models.get(state.active)?.data.name || '';
  $('#directory-sub').textContent = `${scope} · ${found} 个可查询建筑 / 点击定位`;
}

function describeDirectorySub(b) {
  const parts = [];
  if (b.levels) parts.push(`${b.levels} 层`);
  if (b.area) parts.push(`${Math.round(b.area).toLocaleString('zh-CN')} m²`);

  return parts.join(' · ');
}

function openDirectory() {
  $('#directory-search').value = '';
  directoryModal.hidden = false;
  renderDirectory('');
  requestAnimationFrame(() => {
    directoryModal.classList.add('is-open');
    $('#directory-search').focus();
  });
}

function closeDirectory() {
  directoryModal.classList.remove('is-open');
  setTimeout(() => { directoryModal.hidden = true; }, 350);
}

/* ------------------------------------------------------------------ events */
$('#enter-btn').addEventListener('click', enterScene);
$('#intro-about').addEventListener('click', openAbout);
$('#btn-about').addEventListener('click', openAbout);
$('#btn-directory').addEventListener('click', openDirectory);
$('#directory-close').addEventListener('click', closeDirectory);
directoryModal.addEventListener('click', (e) => { if (e.target === directoryModal) closeDirectory(); });
$('#directory-search').addEventListener('input', (e) => renderDirectory(e.target.value));
$('#about-close').addEventListener('click', closeAbout);
aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

for (const tab of $$('.tab')) {
  tab.addEventListener('click', () => {
    if (tab.dataset.campus === 'overview') showOverview();
    else switchCampus(tab.dataset.campus);
  });
}
for (const btn of $$('#overview-list button')) {
  btn.addEventListener('click', () => switchCampus(btn.dataset.campus));
}
$('#brand-home').addEventListener('click', (e) => {
  e.preventDefault();
  if (!state.started) return;
  showOverview();
});
$('#btn-labels').addEventListener('click', () => setLabels(!state.labels));
$('#btn-night').addEventListener('click', () => setNight(!state.night));
$('#btn-reset').addEventListener('click', resetView);
$('#detail-close').addEventListener('click', clearSelection);
$('#campus-collapse').addEventListener('click', () => {
  const card = $('#campus-card');
  const collapsed = card.classList.toggle('is-collapsed');
  $('#campus-collapse').setAttribute('aria-expanded', String(!collapsed));
});
$('#detail-focus').addEventListener('click', () => {
  if (state.selected) focusBuilding(state.selected.model, state.selected.building);
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!state.started && e.key !== 'Escape') return;
  if (e.key === 'Escape') {
    if (!aboutModal.hidden) closeAbout();
    else if (!directoryModal.hidden) closeDirectory();
    else if (!detailPanel.hidden) clearSelection();
    return;
  }
  if (e.key === '0') showOverview();
  else if (e.key === '1') switchCampus('handan');
  else if (e.key === '2') switchCampus('jiangwan');
  else if (e.key === '3') switchCampus('fenglin');
  else if (e.key.toLowerCase() === 'n') setNight(!state.night);
  else if (e.key.toLowerCase() === 'l') setLabels(!state.labels);
  else if (e.key.toLowerCase() === 'r') resetView();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h);
});

/* ------------------------------------------------------------------ animate */
const clock = new THREE.Clock();
let lastHud = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;
  updateCameraTween(performance.now());
  controls.update();

  for (const model of state.models.values()) {
    if (model.group.visible) model.update(dt, elapsed);
  }

  if (state.started) {
    labelLayer.update(camera, { width: window.innerWidth, height: window.innerHeight });
  }
  if (now - lastHud > 120) {
    lastHud = now;
    updateHUD();
  }
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ boot */
(async () => {
  try {
    $('#enter-btn').disabled = true;
    await buildWorld();
    state.started = false;
    labelLayer.setVisible(false);
    requestAnimationFrame(animate);
    // precompile
    renderer.compile(scene, camera);
  } catch (err) {
    console.error(err);
    loadStep.textContent = '加载失败，请通过本地服务器打开';
    loadPercent.textContent = 'ERROR';
    loadFill.style.background = '#b02a3a';
    $('#enter-btn').disabled = true;
  }
})();

// Debug handle for screenshots / inspection.
window.__FUDAN__ = {
  state, scene, camera, controls, renderer, materials,
  switchCampus, showOverview, setNight, setLabels,
  selectBuilding, openDetail, focusBuilding, clearSelection, openDirectory,
  enterScene,
};
