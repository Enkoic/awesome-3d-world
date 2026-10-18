import * as THREE from 'three';

const KIND_ORDER = { campus: 0, gate: 1, building: 2, area: 3, road: 4 };

export class LabelLayer {
  constructor(root, { onSelect, onCampus }) {
    this.root = root;
    this.onSelect = onSelect;
    this.onCampus = onCampus;
    this.items = [];
    this.visible = true;
    this.mode = 'detail';
    this._v = new THREE.Vector3();
  }

  clear() {
    this.root.replaceChildren();
    this.items = [];
  }

  setVisible(v) {
    this.visible = v;
    if (!v) {
      for (const item of this.items) item.el.classList.remove('is-visible');
    }
  }

  setCampus(model, data) {
    this.clear();
    this.mode = 'detail';
    this.model = model;
    this.data = data;
    const byName = new Map();
    for (const b of data.buildings) {
      if (b.name && !byName.has(b.name)) byName.set(b.name, b);
    }
    const labels = [...data.labels].sort((a, b) => {
      const ka = KIND_ORDER[a.kind] ?? 9;
      const kb = KIND_ORDER[b.kind] ?? 9;
      if (ka !== kb) return ka - kb;
      return (a.priority || 99) - (b.priority || 99);
    });

    for (const l of labels) {
      const el = document.createElement('div');
      el.className = `map-label kind-${l.kind}`;
      el.dataset.kind = l.kind;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = l.text;
      el.appendChild(name);
      if (l.sub) {
        const sub = document.createElement('span');
        sub.className = 'sub';
        sub.textContent = l.sub;
        el.appendChild(sub);
      }
      const building = l.kind === 'building' ? byName.get(l.text) : null;
      if (building) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onSelect?.(model, building);
        });
        el.title = `${building.name} · 点击查看`;
      }
      this.root.appendChild(el);
      this.items.push({
        el,
        label: l,
        building,
        width: 0,
        height: 0,
        visible: false,
      });
    }
  }

  setOverview(entries) {
    this.clear();
    this.mode = 'overview';
    this.model = null;
    this.data = null;
    for (const entry of entries) {
      const el = document.createElement('div');
      el.className = 'map-label campus-label';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = entry.name;
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = entry.sub;
      el.appendChild(name);
      el.appendChild(sub);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCampus?.(entry.id);
      });
      this.root.appendChild(el);
      this.items.push({
        el,
        label: { text: entry.name, x: entry.x, y: entry.y, z: entry.z, kind: 'campus', priority: 0 },
        model: entry.model,
        building: null,
        width: 0,
        height: 0,
        visible: false,
        campusId: entry.id,
      });
    }
  }

  measure() {
    for (const item of this.items) {
      item.width = item.el.offsetWidth || 90;
      item.height = item.el.offsetHeight || 20;
    }
  }

  update(camera, viewport) {
    if (!this.items.length) return;
    if (!this.visible) {
      for (const item of this.items) item.el.classList.remove('is-visible');
      return;
    }
    const w = viewport.width;
    const h = viewport.height;
    const accepted = [];
    const maxDist = this.mode === 'detail' ? Math.max(1200, (this.data?.extent?.width || 1600) * 1.75) : 20000;

    for (const item of this.items) {
      const l = item.label;
      this._v.set(l.x, l.y ?? 3, l.z);
      if (item.model) this._v.applyMatrix4(item.model.group.matrixWorld);
      const world = this._v.clone();
      const dist = camera.position.distanceTo(world);
      this._v.project(camera);
      const sx = (this._v.x * 0.5 + 0.5) * w;
      const sy = (-this._v.y * 0.5 + 0.5) * h;

      let show = this._v.z > -1 && this._v.z < 1;
      if (sx < -120 || sx > w + 120 || sy < 70 || sy > h + 30) show = false;
      if (this.mode === 'detail') {
        if (l.kind === 'road' && dist > 1900) show = false;
        if (l.kind === 'area' && dist > 2600) show = false;
        if (l.kind === 'gate' && dist > 2300) show = false;
        if (l.kind === 'building' && dist > maxDist) show = false;
      }

      if (!item.width) {
        item.width = item.el.offsetWidth || 90;
        item.height = item.el.offsetHeight || 20;
      }
      const pad = 6;
      const rect = {
        x1: sx - item.width / 2 - pad,
        x2: sx + item.width / 2 + pad,
        y1: sy - item.height - pad,
        y2: sy + pad,
        priority: KIND_ORDER[l.kind] ?? 9,
      };
      if (show && accepted.some((r) => !(rect.x2 < r.x1 || rect.x1 > r.x2 || rect.y2 < r.y1 || rect.y1 > r.y2))) {
        show = false;
      }
      if (show) accepted.push(rect);

      if (show) {
        item.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        item.el.classList.toggle('near', dist < 1200);
      }
      if (show !== item.visible) {
        item.el.classList.toggle('is-visible', show);
        item.visible = show;
      }
    }
  }
}
