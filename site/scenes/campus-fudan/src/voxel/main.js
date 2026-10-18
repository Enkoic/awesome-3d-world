import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createVoxelCampus } from './voxelScene.js';

const CAMPUS_ORDER = ['handan', 'jiangwan', 'fenglin'];
const CAMPUS_CODE = { handan: '01', jiangwan: '02', fenglin: '03' };
const CAMPUS_EN = { handan: 'HANDAN CAMPUS', jiangwan: 'JIANGWAN CAMPUS', fenglin: 'FENGLIN CAMPUS' };
const CAMPUS_SHORT = { handan: '邯郸校区', jiangwan: '江湾校区', fenglin: '枫林校区' };
const CAMPUS_EN_NAME = { handan: 'HANDAN', jiangwan: 'JIANGWAN', fenglin: 'FENGLIN' };
const CAMPUS_YEAR = { handan: '1922', jiangwan: '2005', fenglin: '1937' };
const DIR = new THREE.Vector3(1, 1.18, 1.52).normalize();
const HERO = {
  handan: { x: 60, y: 55, z: -200, size: 880 },
  jiangwan: { x: 45, y: 45, z: -30, size: 720 },
  fenglin: { x: 80, y: 42, z: -110, size: 520 },
};
const TOUR = [
  { campus: 'handan', name: '光华楼', text: '2005 年落成的双塔，142 m。体素版用竖向石材与玻璃带还原它的比例。' },
  { campus: 'handan', name: '老校门', text: '白墙、木柱、黑底金字的牌匾与深色瓦顶，燕园西侧的校园记忆。' },
  { campus: 'jiangwan', name: '李兆基图书馆', text: '日湖与月湖之间的石材图书馆，中央玻璃拱廊面向水面。' },
  { campus: 'fenglin', name: '东1号楼', text: '1936 年建成的医学院历史建筑，红砖、白线脚与坡屋顶。' },
];
const TYPE_LABEL = { campus: '教学科研', dorm: '学生生活', library: '图书馆', historic: '历史建筑', sports: '体育', hospital: '医疗', commercial: '商业', landmark: '校园地标', default: '校园建筑' };
const PHOTO = { 光华楼: 'references/ref_0.jpg', 老校门: 'references/ref_7.jpg', 李兆基图书馆: 'references/ref_4.jpg' };
const $ = (s) => document.querySelector(s);

const state = {
  mode: 'detail',
  active: 'handan',
  labels: true,
  autoRotate: false,
  models: new Map(),
  viewSize: 2100,
  targetViewSize: 2100,
  loaded: false,
  full: false,
  info: null,
  tour: -1,
  highlight: null,
};

const canvas = $('#voxel-scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8dfcf');

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 30000);
camera.position.copy(DIR).multiplyScalar(9000);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 70, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.75;
controls.screenSpacePanning = false;
controls.minZoom = 0.35;
controls.maxZoom = 3.4;
controls.minPolarAngle = THREE.MathUtils.degToRad(18);
controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
controls.enablePan = false;

const hemi = new THREE.HemisphereLight('#fff9e9', '#a68e72', 1.25);
scene.add(hemi);
const ambient = new THREE.AmbientLight('#fff4e2', 0.35);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff0d2', 3.1);
sun.position.set(2600, 4200, 2600);
sun.castShadow = true;
sun.shadow.mapSize.set(innerWidth < 800 ? 2048 : 4096, innerWidth < 800 ? 2048 : 4096);
sun.shadow.camera.left = -3200;
sun.shadow.camera.right = 3200;
sun.shadow.camera.top = 3200;
sun.shadow.camera.bottom = -3200;
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 12000;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.7;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight('#b9cce0', 0.75);
fill.position.set(-2600, 1800, -1800);
scene.add(fill);

/* ------------------------------------------------------------------ table */
const table = new THREE.Mesh(
  new THREE.PlaneGeometry(16000, 16000),
  new THREE.MeshStandardMaterial({ color: '#e7ddcc', roughness: 1, metalness: 0 })
);
table.rotation.x = -Math.PI / 2;
table.position.y = -44;
table.receiveShadow = true;
table.name = 'voxel-table';
scene.add(table);

const grid = new THREE.GridHelper(16000, 200, 0xbab09f, 0xcfc5b5);
grid.position.y = -43.96;
grid.material.transparent = true;
grid.material.opacity = 0.3;
grid.material.depthWrite = false;
scene.add(grid);

/* ------------------------------------------------------------------ labels */
class LabelLayer {
  constructor(root) { this.root = root; this.items = []; this.visible = true; }
  clear() { this.root.replaceChildren(); this.items = []; }
  setVisible(v) { this.visible = v; if (!v) this.items.forEach((i) => i.el.classList.remove('is-visible')); }
  setCampus(model) {
    this.clear();
    this.mode = 'detail';
    this.model = model;
    const labels = [...model.voxel.labels]
      .filter((l) => ['building', 'area', 'gate'].includes(l.kind))
      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
      .slice(0, 13);
    for (const l of labels) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `voxel-label kind-${l.kind}`;
      const name = document.createElement('span'); name.className = 'name'; name.textContent = l.text;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = l.sub || '';
      el.append(name, sub);
      el.addEventListener('click', () => onLabelClick(l));
      this.root.appendChild(el);
      this.items.push({ el, label: l, w: 0, h: 0, visible: false });
    }
  }
  setOverview(entries) {
    this.clear();
    this.mode = 'overview';
    this.model = null;
    for (const e of entries) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'voxel-label campus';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = e.name;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = `${e.en} · ${e.year}`;
      el.append(name, sub);
      el.addEventListener('click', () => switchCampus(e.id));
      this.root.appendChild(el);
      this.items.push({ el, label: { x: e.x, y: e.y, z: e.z, kind: 'campus' }, w: 0, h: 0, visible: false, campusId: e.id, group: e.group });
    }
  }
  update() {
    if (!this.visible) { this.items.forEach((i) => i.el.classList.remove('is-visible')); return; }
    const W = innerWidth, H = innerHeight;
    const accepted = [];
    for (const item of this.items) {
      const l = item.label;
      const v = new THREE.Vector3(l.x, l.y || 4, l.z);
      if (item.group) v.applyMatrix4(item.group.matrixWorld);
      else if (this.model) v.applyMatrix4(this.model.group.matrixWorld);
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      let show = v.z > -1 && v.z < 1 && sx > -80 && sx < W + 80 && sy > 60 && sy < H - 10;
      if (!item.w) { item.w = item.el.offsetWidth || 80; item.h = item.el.offsetHeight || 20; }
      const rect = { x1: sx - item.w / 2 - 4, x2: sx + item.w / 2 + 4, y1: sy - item.h - 4, y2: sy + 4 };
      if (show && accepted.some((r) => !(rect.x2 < r.x1 || rect.x1 > r.x2 || rect.y2 < r.y1 || rect.y1 > r.y2))) show = false;
      if (show) accepted.push(rect);
      if (show) {
        item.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        item.el.classList.toggle('near', state.targetViewSize < 1500);
      }
      if (show !== item.visible) {
        item.el.classList.toggle('is-visible', show);
        item.visible = show;
      }
    }
  }
}
const labelLayer = new LabelLayer($('#voxel-labels'));
labelLayer.setVisible(false);

/* ------------------------------------------------------------------ view */
function applyFrustum() {
  const aspect = innerWidth / innerHeight;
  const v = state.viewSize;
  camera.left = -v * aspect / 2;
  camera.right = v * aspect / 2;
  camera.top = v / 2;
  camera.bottom = -v / 2;
  camera.updateProjectionMatrix();
}
function setViewSize(v, immediate = false) {
  state.targetViewSize = v;
  if (immediate) { state.viewSize = v; applyFrustum(); }
}
function moveTarget(target, immediate = false) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(target);
  camera.position.copy(target).add(dir.multiplyScalar(8000));
  controls.update();
  if (immediate) applyFrustum();
}
function fitDetail(id, immediate = false, { full = false } = {}) {
  const model = state.models.get(id);
  if (!model) return;
  state.full = full;
  const d = model.data;
  const maxDim = Math.max(d.extent.width, d.extent.depth);
  const aspect = innerWidth / Math.max(1, innerHeight);
  const hero = HERO[id];
  if (!full && hero) {
    const hx = hero.x + (aspect < 0.8 ? 90 : 0);
    moveTarget(new THREE.Vector3(hx, hero.y, hero.z), immediate);
    setViewSize(aspect < 0.8 ? hero.size * 1.45 : hero.size, immediate);
  } else {
    moveTarget(new THREE.Vector3(0, 70, 0), immediate);
    const fit = aspect < 0.8 ? maxDim * 1.08 : maxDim * 0.94;
    setViewSize(fit, immediate);
  }
  const btn = $('#voxel-fit');
  if (btn) {
    btn.hidden = state.mode === 'overview';
    btn.querySelector('strong').textContent = full ? '地标视图 ↙' : '全校区 ↗';
  }
}
function fitOverview(immediate = false) {
  setViewSize(4700, immediate);
}

function prepareDetail(id) {
  for (const [key, model] of state.models) {
    if (key === id) {
      model.group.visible = true;
      model.group.position.set(0, 0, 0);
      model.group.scale.setScalar(1);
    } else model.group.visible = false;
  }
  scene.updateMatrixWorld(true);
}
function prepareOverview() {
  const tile = 1180;
  const layout = {
    handan: [-1090, 0, -470],
    jiangwan: [650, 0, -470],
    fenglin: [-230, 0, 840],
  };
  for (const [id, model] of state.models) {
    const maxDim = Math.max(model.data.extent.width, model.data.extent.depth);
    model.group.visible = true;
    model.group.scale.setScalar(tile / maxDim);
    model.group.position.set(layout[id][0], 0, layout[id][2]);
  }
  scene.updateMatrixWorld(true);
  labelLayer.setOverview(CAMPUS_ORDER.map((id) => {
    const model = state.models.get(id);
    return {
      id, name: CAMPUS_SHORT[id], en: CAMPUS_EN[id].split(' ')[0], year: CAMPUS_YEAR[id],
      x: layout[id][0], y: 260, z: layout[id][2], group: null,
    };
  }));
}

/* ------------------------------------------------------------------ ui */
const numberFmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${n}`;
function setActiveTab(id) {
  document.querySelectorAll('.voxel-tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.campus === id));
}
function setDetailUI(id) {
  const model = state.models.get(id);
  const d = model.data;
  $('#voxel-card').hidden = false;
  $('#voxel-code').textContent = `VOXEL STUDY ${CAMPUS_CODE[id]} / ${CAMPUS_EN_NAME[id]}`;
  $('#voxel-title').textContent = d.name;
  $('#voxel-en').textContent = CAMPUS_EN[id];
  $('#voxel-tagline').textContent = d.tagline;
  $('#voxel-count').textContent = numberFmt(model.voxel.boxes.length);
  $('#voxel-buildings').textContent = d.stats.buildings;
  $('#voxel-height').textContent = Math.round(d.stats.maxHeight);
  $('#voxel-desc').textContent = d.description;
  $('#voxel-legend').hidden = false;
  $('#overview-campuses').hidden = true;
  const fitBtn = $('#voxel-fit');
  if (fitBtn) fitBtn.hidden = false;
  setActiveTab(id);
}
function setOverviewUI() {
  const total = [...state.models.values()].reduce((n, m) => n + m.voxel.boxes.length, 0);
  $('#voxel-card').hidden = false;
  $('#voxel-code').textContent = 'VOXEL STUDY 00 / THREE CAMPUSES';
  $('#voxel-title').textContent = '一校三区';
  $('#voxel-en').textContent = 'ONE UNIVERSITY / THREE CAMPUSES';
  $('#voxel-tagline').textContent = '邯郸 · 江湾 · 枫林：以公开影像和 OSM 数据为参考的三维体素档案。';
  $('#voxel-count').textContent = numberFmt(total);
  $('#voxel-buildings').textContent = 420;
  $('#voxel-height').textContent = 142;
  $('#voxel-desc').textContent = '体素不是照片贴图：建筑轮廓、屋面、道路、水系、树木与重点地标都由方块重新拼合。总览为等幅展示，非实际相对尺度。';
  $('#voxel-legend').hidden = true;
  $('#overview-campuses').hidden = false;
  const fitBtn = $('#voxel-fit');
  if (fitBtn) fitBtn.hidden = true;
  setActiveTab('overview');
}

function focusLabel(l) {
  const old = controls.target.clone();
  const dir = camera.position.clone().sub(old).normalize();
  const next = new THREE.Vector3(l.x, Math.min(l.y || 20, 100), l.z);
  controls.target.copy(next);
  camera.position.copy(next).add(dir.multiplyScalar(8000));
  controls.update();
  state.targetViewSize = Math.max(360, Math.min(760, (l.kind === 'area' ? 380 : 430)));
}
function onLabelClick(l) {
  const info = findInfo(state.active, l.text);
  if (info) openInfo(info);
  else focusLabel(l);
}

function switchCampus(id, { immediate = false, keepTour = false } = {}) {
  if (!state.models.has(id)) return;
  if (!keepTour) stopTourUI();
  closeInfo({ keepUrl: true });
  state.mode = 'detail';
  state.active = id;
  prepareDetail(id);
  fitDetail(id, immediate);
  setDetailUI(id);
  labelLayer.setCampus(state.models.get(id));
  labelLayer.setVisible(state.labels);
  syncUrl();
  sceneFlash();
}
function showOverview({ immediate = false } = {}) {
  stopTourUI();
  closeInfo({ keepUrl: true });
  state.mode = 'overview';
  state.active = null;
  prepareOverview();
  moveTarget(new THREE.Vector3(0, 70, 0), immediate);
  fitOverview(immediate);
  setOverviewUI();
  labelLayer.setVisible(state.labels);
  syncUrl();
  sceneFlash();
}

function findInfo(campus, name) {
  const model = state.models.get(campus);
  if (!model?.pickMesh) return null;
  return model.pickMesh.userData.infos.find((i) => i.name === name) || null;
}

function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set('campus', state.mode === 'overview' ? 'overview' : state.active || 'overview');
  if (state.info) u.searchParams.set('b', state.info.name);
  else u.searchParams.delete('b');
  history.replaceState(null, '', u.pathname + '?' + u.searchParams.toString() + u.hash);
}

function clearHighlight() {
  if (!state.highlight) return;
  scene.remove(state.highlight);
  state.highlight.geometry?.dispose();
  state.highlight.material?.dispose();
  state.highlight = null;
}

function highlightInfo(info) {
  clearHighlight();
  const geo = new THREE.BoxGeometry(info.width * 1.08, info.height * 1.03, info.depth * 1.08);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = new THREE.LineBasicMaterial({ color: 0xc5a05c, transparent: true, opacity: 0.95, depthTest: false });
  const line = new THREE.LineSegments(edges, mat);
  line.position.set(info.center[0], info.height / 2 + 0.2, info.center[1]);
  line.renderOrder = 8;
  scene.add(line);
  state.highlight = line;
}

function focusInfo(info) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const target = new THREE.Vector3(info.center[0], Math.min(info.height * 0.55, 90), info.center[1]);
  controls.target.copy(target);
  camera.position.copy(target).add(dir.multiplyScalar(7200));
  controls.update();
  state.full = false;
  state.targetViewSize = Math.max(190, Math.min(620, Math.max(info.height * 1.7, Math.max(info.width, info.depth) * 1.15)));
}

function openInfo(info, { fromTour = false } = {}) {
  if (!info) return;
  if (state.tour >= 0 && !fromTour) stopTourUI();
  state.info = info;
  const type = TYPE_LABEL[info.type] || TYPE_LABEL.default;
  $('#voxel-info').hidden = false;
  $('#voxel-info-kicker').textContent = `${CAMPUS_EN_NAME[state.active]} / ${type.toUpperCase()}`;
  $('#voxel-info-type').textContent = type;
  $('#voxel-info-title').textContent = info.name || '未命名建筑';
  $('#voxel-info-en').textContent = info.en || '';
  $('#voxel-info-desc').textContent = info.desc || '该体块由 OSM 轮廓与公开资料推定；可拖动模型继续观察。';
  $('#voxel-info-height').textContent = `${Math.round(info.height)} m`;
  $('#voxel-info-levels').textContent = info.levels ? `${info.levels} F` : '—';
  $('#voxel-info-area').textContent = info.area ? `${Math.round(info.area).toLocaleString()} ㎡` : '—';
  const img = $('#voxel-info-photo');
  const photo = PHOTO[info.name];
  if (photo) {
    img.hidden = false; img.src = `./${photo}`; img.alt = `${info.name}参考影像`;
    img.onerror = () => { img.hidden = true; };
  } else {
    img.hidden = true; img.removeAttribute('src');
  }
  document.body.classList.add('info-open');
  highlightInfo(info);
  focusInfo(info);
  syncUrl();
}

function closeInfo({ keepUrl = false } = {}) {
  $('#voxel-info').hidden = true;
  state.info = null;
  document.body.classList.remove('info-open');
  clearHighlight();
  if (!keepUrl) syncUrl();
}

function stopTourUI() {
  state.tour = -1;
  $('#voxel-tour').hidden = true;
  document.body.classList.remove('tour-open');
}

function updateTourBar() {
  if (state.tour < 0) return;
  const stop = TOUR[state.tour];
  $('#tour-step').textContent = `${String(state.tour + 1).padStart(2, '0')} / ${String(TOUR.length).padStart(2, '0')}`;
  $('#tour-title').textContent = stop.name;
  $('#tour-text').textContent = stop.text;
  $('#tour-next').textContent = state.tour === TOUR.length - 1 ? '结束导览 →' : '下一站 →';
}

function goTour(i) {
  if (i < 0 || i >= TOUR.length) { endTour(); return; }
  state.tour = i;
  const stop = TOUR[i];
  if (state.active !== stop.campus) {
    switchCampus(stop.campus, { immediate: true, keepTour: true });
  }
  const info = findInfo(stop.campus, stop.name);
  if (!info) return;
  openInfo(info, { fromTour: true });
  $('#voxel-tour').hidden = false;
  document.body.classList.add('tour-open');
  updateTourBar();
}
function startTour() { goTour(0); }
function endTour() {
  stopTourUI();
  closeInfo();
  if (state.active) fitDetail(state.active, false, { full: false });
}

async function shareCurrent() {
  syncUrl();
  const url = location.href;
  try {
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      await navigator.share({ title: '复旦大学 · 3D 体素校园', text: '一校三区体素模型', url });
      return;
    }
  } catch { /* fall through to clipboard */ }
  try {
    await navigator.clipboard.writeText(url);
    toast('链接已复制');
  } catch {
    toast('请复制浏览器地址栏链接');
  }
}

let toastTimer = null;
function toast(text) {
  const el = $('#voxel-toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

let flashEl = null;
function sceneFlash() {
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.className = 'voxel-flash';
    document.body.appendChild(flashEl);
    const style = document.createElement('style');
    style.textContent = '.voxel-flash{position:fixed;inset:0;z-index:5;background:#e8dfcf;opacity:0;pointer-events:none;transition:opacity .15s ease}.voxel-flash.on{opacity:1}';
    document.head.appendChild(style);
  }
  flashEl.classList.add('on');
  setTimeout(() => flashEl.classList.remove('on'), 150);
}

/* ------------------------------------------------------------------ reference modal */
const REF_ORDER = [0, 2, 4, 7, 1, 5];
const cleanAuthor = (a) => !a || a.startsWith('No machine-readable') ? 'Whw / Wikimedia Commons' : a.replace(/<[^>]+>/g, '').trim();
const REF_TITLE = {
  0: '光华楼 · 日景', 1: '光华楼 · 暮色', 2: '江湾校区正门', 3: '江湾校区',
  4: '李兆基图书馆', 5: '枫林 · 公共卫生学院', 6: '复旦侧门', 7: '老校门',
};
let credits = null;
async function loadCredits() {
  if (credits) return credits;
  try {
    credits = await fetch('./references/credits.json').then((r) => r.json());
  } catch { credits = {}; }
  return credits;
}
async function openReferences() {
  const modal = $('#reference-modal');
  modal.hidden = false;
  const c = await loadCredits();
  const grid = $('#reference-grid');
  if (!grid.children.length) {
    const keys = Object.keys(c);
    for (const idx of REF_ORDER) {
      const key = keys[idx];
      const item = c[key];
      if (!item) continue;
      const a = document.createElement('a');
      a.className = 'ref-item';
      a.href = item.page; a.target = '_blank'; a.rel = 'noreferrer';
      a.innerHTML = `
        <img class="ref-image" src="./${item.file}" alt="${REF_TITLE[idx] || item.title}" loading="lazy" />
        <div class="ref-caption">
          <strong>${REF_TITLE[idx] || item.title}</strong>
          <span>${item.license || ''}</span>
          <small>${cleanAuthor(item.artist)} · <a href="${item.page}" target="_blank" rel="noreferrer">来源 ↗</a></small>
        </div>`;
      a.querySelectorAll('a').forEach((inner) => inner.addEventListener('click', (e) => e.stopPropagation()));
      grid.appendChild(a);
    }
  }
  requestAnimationFrame(() => modal.classList.add('is-open'));
}
function closeReferences() {
  const modal = $('#reference-modal');
  modal.classList.remove('is-open');
  setTimeout(() => { modal.hidden = true; }, 250);
}
document.querySelectorAll('#btn-refs, #btn-refs-2').forEach((b) => b.addEventListener('click', openReferences));
$('#reference-close').addEventListener('click', closeReferences);
$('#reference-modal').addEventListener('click', (e) => { if (e.target.id === 'reference-modal') closeReferences(); });

/* ------------------------------------------------------------------ interactions */
for (const tab of document.querySelectorAll('.voxel-tabs button')) {
  tab.addEventListener('click', () => tab.dataset.campus === 'overview' ? showOverview() : switchCampus(tab.dataset.campus));
}
for (const b of document.querySelectorAll('#overview-campuses button')) {
  b.addEventListener('click', () => switchCampus(b.dataset.campus));
}
$('#voxel-home').addEventListener('click', (e) => { e.preventDefault(); showOverview(); });
$('#btn-labels').addEventListener('click', () => {
  state.labels = !state.labels;
  $('#btn-labels').setAttribute('aria-pressed', String(state.labels));
  document.body.classList.toggle('no-labels', !state.labels);
  labelLayer.setVisible(state.labels && state.loaded);
});
$('#btn-rotate').addEventListener('click', () => {
  state.autoRotate = !state.autoRotate;
  controls.autoRotate = state.autoRotate;
  controls.autoRotateSpeed = 0.55;
  $('#btn-rotate').setAttribute('aria-pressed', String(state.autoRotate));
});
$('#voxel-fit').addEventListener('click', () => {
  if (state.mode !== 'detail') return;
  closeInfo();
  fitDetail(state.active, false, { full: !state.full });
});
$('#btn-tour').addEventListener('click', () => {
  if (state.tour >= 0) endTour();
  else startTour();
});
$('#tour-prev').addEventListener('click', () => { if (state.tour > 0) goTour(state.tour - 1); });
$('#tour-next').addEventListener('click', () => {
  if (state.tour < 0) return;
  if (state.tour >= TOUR.length - 1) endTour();
  else goTour(state.tour + 1);
});
$('#tour-close').addEventListener('click', endTour);
$('#voxel-info-close').addEventListener('click', () => closeInfo());
$('#voxel-info-focus').addEventListener('click', () => { if (state.info) focusInfo(state.info); });
$('#voxel-info-copy').addEventListener('click', shareCurrent);
$('#btn-share').addEventListener('click', shareCurrent);

const raycaster = new THREE.Raycaster();
let pointerDown = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointerDown = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown || !state.loaded || state.mode !== 'detail') { pointerDown = null; return; }
  const dx = e.clientX - pointerDown.x, dy = e.clientY - pointerDown.y;
  pointerDown = null;
  if (dx * dx + dy * dy > 36) return;
  const model = state.models.get(state.active);
  if (!model?.pickMesh) return;
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  scene.updateMatrixWorld(true);
  const hits = raycaster.intersectObject(model.pickMesh, false);
  if (hits.length) {
    const info = model.pickMesh.userData.infos[hits[0].instanceId];
    if (info) openInfo(info);
  } else {
    closeInfo();
  }
});
// compass + scale
let lastHud = 0;
function updateHUD(now) {
  if (now - lastHud < 120) return;
  lastHud = now;
  const dir = camera.position.clone().sub(controls.target);
  const angle = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
  const needle = $('#voxel-needle');
  if (needle) needle.setAttribute('transform', `rotate(${angle.toFixed(1)} 20 20)`);
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (!$('#reference-modal').hidden) closeReferences();
    else if (state.tour >= 0) endTour();
    else if (state.info) closeInfo();
    return;
  }
  if (e.key === '0') showOverview();
  else if (e.key === '1') switchCampus('handan');
  else if (e.key === '2') switchCampus('jiangwan');
  else if (e.key === '3') switchCampus('fenglin');
  else if (e.key.toLowerCase() === 'l') $('#btn-labels').click();
  else if (e.key.toLowerCase() === 'a') $('#btn-rotate').click();
  else if (e.key.toLowerCase() === 't') $('#btn-tour').click();
  else if (e.key.toLowerCase() === 'f') $('#voxel-fit').click();
});
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  applyFrustum();
});

/* ------------------------------------------------------------------ animate */
function animate(now) {
  requestAnimationFrame(animate);
  controls.update();
  state.viewSize += (state.targetViewSize - state.viewSize) * 0.12;
  if (Math.abs(state.targetViewSize - state.viewSize) > 0.25) applyFrustum();
  labelLayer.update();
  updateHUD(now || performance.now());
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ boot */
const progressEl = $('#voxel-progress');
const barEl = $('#voxel-progress-fill');
function progress(p) {
  progressEl.textContent = `${Math.round(p)}%`;
  barEl.style.width = `${p}%`;
}
(async () => {
  try {
    const data = await fetch('./data/campuses.json').then((r) => r.json());
    let p = 5;
    progress(p);
    for (const c of data.campuses) {
      const model = createVoxelCampus(c, { mode: 'instanced' });
      model.group.visible = false;
      scene.add(model.group);
      state.models.set(c.id, model);
      p += 27;
      progress(p);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    progress(95);
    const params = new URLSearchParams(location.search);
    const requested = params.get('campus');
    const initial = requested === 'overview' || state.models.has(requested) ? requested : 'handan';
    state.loaded = true;
    if (initial === 'overview') {
      showOverview({ immediate: true });
    } else {
      switchCampus(initial, { immediate: true });
      const bname = params.get('b');
      if (bname) {
        const info = findInfo(initial, bname);
        if (info) openInfo(info);
      }
    }
    labelLayer.setVisible(state.labels);
    applyFrustum();
    progress(100);
    setTimeout(() => {
      const loading = $('#voxel-loading');
      loading.classList.add('is-done');
      setTimeout(() => { loading.hidden = true; }, 650);
    }, 300);
    requestAnimationFrame(animate);
    renderer.compile(scene, camera);
    window.__VOXEL__ = { state, scene, camera, controls, renderer, switchCampus, showOverview, openReferences, labelLayer, openInfo, closeInfo, startTour, endTour };
  } catch (e) {
    console.error(e);
    progressEl.textContent = 'ERROR';
    progressEl.parentElement.nextElementSibling?.remove();
  }
})();
