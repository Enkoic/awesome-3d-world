"use strict";
(() => {
  const REPO = "https://github.com/Enkoic/awesome-3d-world";
  const categories = {
    campus: "大学与校园",
    scenic: "景区与自然景观",
    urban: "城市与街区",
    landmark: "地标与公共空间",
    historical: "历史复原",
    fictional: "架空与文学世界",
  };
  const symbols = {
    campus: "⌂",
    scenic: "△",
    urban: "▥",
    landmark: "◇",
    historical: "◷",
    fictional: "✧",
  };
  const statuses = {
    ready: "已验证可浏览",
    external: "外部项目",
    planned: "待收录场景",
    unavailable: "资源不可用",
  };
  const worlds = {
    real: "现实地点",
    historical: "历史复原",
    fictional: "架空世界",
  };
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const safeURL = (u) =>
    /^https:\/\//.test(u) ||
    (/^[a-z0-9][a-z0-9_/.\-]*$/i.test(u) && !u.includes(".."))
      ? u
      : "#";
  const ext = 'target="_blank" rel="noopener noreferrer"';
  let data,
    results = [],
    page = 1,
    savedOnly = false,
    activeEntry = null,
    toastTimer;
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem("a3w-saved") || "[]");
    if (!Array.isArray(saved)) saved = [];
  } catch {
    saved = [];
  }
  const params = new URLSearchParams(location.search);
  const state = {
    category: params.get("category") || "all",
    q: params.get("q") || "",
    status: params.get("status") || "all",
    region: params.get("region") || "all",
    world: params.get("world") || "all",
    sort: "recommended",
  };
  const PAGE_SIZE = 24;
  const dn = new Intl.DisplayNames(["zh-CN"], { type: "region" });
  const locationText = (e) =>
    e.heritage
      ? e.countries
          .map((c) => {
            try {
              return dn.of(c);
            } catch {
              return c;
            }
          })
          .join(" · ")
      : e.location;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3000,
    );
  }
  function download(name, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function writeURL() {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v && v !== "all" && k !== "sort") p.set(k, v);
    });
    if (activeEntry) p.set("scene", activeEntry.id);
    history.replaceState(
      null,
      "",
      location.pathname + (p.size ? "?" + p : "") + location.hash,
    );
  }
  function illustration(cat) {
    const shapes = {
      scenic:
        '<path d="m20 76 43-50 29 50 28-33 35 33"/><path d="m63 26 8 23 9-7M94 76l26-33 6 17 9-2"/><path d="M12 83h154M32 88h65M133 88h23"/><circle cx="130" cy="25" r="10"/>',
      campus:
        '<path d="M20 78h140M30 78V48h120v30M44 48V35l46-20 46 20v13M40 35h100M83 78V57h14v21M39 57h13v12H39zM61 57h13v12H61zM106 57h13v12h-13zM127 57h13v12h-13z"/><path d="M90 15V7h21l-4 5H90M22 83h138"/>',
      urban:
        '<path d="M15 80h150M26 80V42h26v38M61 80V22h33v58M104 80V35h25v45M139 80V55h18v25M33 51h12m-12 10h12M70 32h15m-15 12h15m-15 12h15m-15 12h15M111 45h11m-11 11h11m-11 11h11M20 86h140"/>',
      landmark:
        '<path d="M29 79h122M39 72h102M43 68h94M52 64V40m20 24V40m36 24V40m20 24V40M43 40h94M38 35l52-25 52 25H38ZM48 30l42-14 42 14M44 69v8m92-8v8"/><circle cx="90" cy="27" r="4"/>',
      historical:
        '<path d="M17 80h148M29 80V31h24v49M30 31V20h8v7h8v-7h8v11M127 80V31h24v49M127 31V20h8v7h8v-7h8v11M53 45h74M53 50h74M74 80V65a16 16 0 0 1 32 0v15M38 40h8v12h-8zM135 40h8v12h-8zM58 61h9M114 61h8M25 86h130"/>',
      fictional:
        '<path d="m40 70 25-18 26 12 23-19 31 19-22 19-30 7-36-7Z"/><path d="m40 70 18 23 35 8 30-8 22-29M66 53V31l11-15 11 15v29M62 31h30M104 48V24l10-13 10 13v25M101 24h26M89 63V39l10-10 10 10v10M72 38h9v9M109 30h8v9M32 31h9m-4-5v10M142 22h9m-4-5v10"/>',
    };
    return `<svg viewBox="0 0 180 110" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${shapes[cat] || shapes.scenic}</svg>`;
  }
  function filter() {
    if (!data) return;
    const q = state.q.trim().toLocaleLowerCase();
    results = data.entries.filter(
      (e) =>
        (state.category === "all" || e.category === state.category) &&
        (!savedOnly || saved.includes(e.id)) &&
        (state.world === "all" || e.world === state.world) &&
        (state.region === "all" ||
          (state.region === "CN"
            ? e.countries.includes("CN")
            : state.region === "fictional"
              ? e.world === "fictional"
              : state.region === "international"
                ? e.countries.length && !e.countries.includes("CN")
                : e.countries.includes(state.region))) &&
        (state.status === "all" ||
          (state.status === "download"
            ? e.resources.some((r) => r.kind === "download")
            : e.status === state.status)) &&
        (!q ||
          [
            e.name,
            e.name_en,
            e.location,
            locationText(e),
            e.id,
            ...e.tags,
            ...(e.aliases || []),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q)),
    );
    const first = [
      "daguanyuan",
      "whc-439",
      "whc-813",
      "whc-547",
      "whc-438",
      "whc-637",
      "campus-fudan",
      "campus-xjtlu",
      "whc-880",
      "whc-1334",
      "whc-1003",
      "whc-252",
    ];
    const priority = (e) =>
      e.status === "ready"
        ? -1000 + (first.includes(e.id) ? first.indexOf(e.id) : 100)
        : first.includes(e.id)
          ? first.indexOf(e.id)
          : e.countries.includes("CN")
            ? 100
            : e.category === "fictional"
              ? 200
              : e.category === "campus"
                ? 300
                : 1000;
    results.sort(
      state.sort === "name"
        ? (a, b) => a.name.localeCompare(b.name, "zh-CN")
        : state.sort === "newest"
          ? (a, b) =>
              b.added_at.localeCompare(a.added_at) || priority(a) - priority(b)
          : (a, b) => priority(a) - priority(b),
    );
    page = 1;
    render();
    writeURL();
  }
  function render() {
    const count = results.length,
      start = (page - 1) * PAGE_SIZE;
    $("#result-count").textContent = count.toLocaleString();
    $("#category-title").firstChild.textContent = savedOnly
      ? "本机收藏"
      : state.category === "all"
        ? "发现一个新的世界"
        : categories[state.category];
    $("#catalog-grid").innerHTML =
      results
        .slice(start, start + PAGE_SIZE)
        .map(
          (e) =>
            `<article class="card"><button class="favorite ${saved.includes(e.id) ? "saved" : ""}" data-save="${esc(e.id)}" aria-label="${saved.includes(e.id) ? "取消收藏" : "收藏"} ${esc(e.name)}" aria-pressed="${saved.includes(e.id)}">${saved.includes(e.id) ? "♥" : "♡"}</button><button class="card-main" data-detail="${esc(e.id)}" aria-label="查看 ${esc(e.name)} 的来源与资源"><div class="card-art art-${e.category}">${e.thumbnail ? `<img src="${esc(safeURL(e.thumbnail))}" alt="${esc(e.name)}实际场景截图" loading="lazy">` : illustration(e.category)}<span class="card-index">${esc(e.id.toUpperCase())}</span><span class="art-label">${e.thumbnail ? "实际场景截图" : "分类示意 · 非场景预览"}</span></div><div class="card-info"><span class="card-category">${categories[e.category]} / ${worlds[e.world]}</span><h3>${esc(e.name)}</h3><p class="card-location">${esc(locationText(e))}</p><div class="card-bottom"><span class="badge badge-${e.status}">${e.status === "ready" ? "● " : ""}${statuses[e.status]}</span><span class="card-arrow">查看档案 ↗</span></div></div></button></article>`,
        )
        .join("") ||
      '<div class="empty"><h3>这里还没有匹配的场景</h3><p>试试其他关键词、地区或资源状态，也欢迎补充这个地方。</p><button class="button ghost small" data-action="reset">清空筛选</button></div>';
    $("#page-info").textContent = count
      ? `${start + 1}–${Math.min(start + PAGE_SIZE, count)} / ${count.toLocaleString()} 个档案`
      : "0 个匹配档案";
    $("#prev-page").disabled = page === 1;
    $("#next-page").disabled = page * PAGE_SIZE >= count;
    $('[data-count="all"]').textContent = data.entries.length.toLocaleString();
    $("#saved-count").textContent = saved.filter((id) =>
      data.entries.some((e) => e.id === id),
    ).length;
    document
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          !savedOnly && b.dataset.category === state.category,
        ),
      );
    $("#saved-filter").classList.toggle("selected", savedOnly);
    document
      .querySelectorAll("[data-status]")
      .forEach((b) =>
        b.classList.toggle("selected", b.dataset.status === state.status),
      );
  }
  function openDetail(id) {
    const e = data.entries.find((x) => x.id === id);
    if (!e) {
      toast("未找到这个条目");
      return;
    }
    activeEntry = e;
    writeURL();
    const preview = e.resources.find((r) => r.kind === "preview"),
      downloads = e.resources.filter((r) => r.kind === "download");
    const license = [
      "LicenseRef-Not-Specified",
      "not-applicable",
      "per-source",
    ].includes(e.license)
      ? null
      : e.license;
    const facts = [
      ["覆盖范围", e.scope, true],
      ["来源与重建方法", e.accuracy.method],
      ["视觉表现", e.accuracy.visual],
      ["几何 / 测量精度", e.accuracy.geometry],
      [
        "资源格式",
        e.resources.length
          ? e.resources
              .map((r) => r.format)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(" · ")
          : null,
      ],
      ["重构说明", e.accuracy.limitations, true],
      ["作者 / 提供者", e.author],
      ["许可", license],
      ["来源依据", e.notability.basis],
      ["浏览验证日期", e.verified_at],
    ].filter((x) => x[1]);
    $("#detail-content").innerHTML =
      `<div class="detail-top">${e.thumbnail ? `<img src="${esc(safeURL(e.thumbnail))}" alt="${esc(e.name)}实际场景截图">` : illustration(e.category)}</div><div class="dialog-body"><span class="eyebrow">${esc(e.id.toUpperCase())} / ${categories[e.category]}</span><h2 id="detail-title">${esc(e.name)}</h2><div class="detail-meta"><span>${esc(locationText(e))}</span><span>· ${worlds[e.world]}</span><span class="badge badge-${e.status}">${statuses[e.status]}</span></div><p class="detail-description">${esc(e.description)}</p><div class="dialog-actions">${preview ? `<a class="button primary" href="viewer.html?id=${encodeURIComponent(e.id)}">进入三维场景 ↗</a>` : ""}${e.resources
        .filter((r) => r.kind === "preview")
        .slice(1)
        .map(
          (r, i) =>
            `<a class="button ghost" href="viewer.html?id=${encodeURIComponent(e.id)}&view=${i + 1}">${esc(r.label)} ↗</a>`,
        )
        .join(
          "",
        )}${downloads.map((r) => `<a class="button ghost" href="${esc(safeURL(r.url))}" download="${esc(e.id)}.${r.url.toLowerCase().endsWith(".zip") ? "zip" : r.url.toLowerCase().endsWith(".glb") ? "glb" : "html"}" ${r.url.startsWith("https:") ? ext : ""}>${esc(r.label)} ↓</a>`).join("")}${!preview ? `<button class="button primary" data-contribute="${esc(e.id)}">为这里补充场景 ＋</button>` : ""}</div><div class="fact-grid">${facts.map(([label, value, wide]) => `<div class="fact ${wide ? "wide" : ""}"><small>${esc(label)}</small>${esc(value)}</div>`).join("")}</div><h3 class="detail-section-title">来源与资源</h3><ul class="source-list">${e.sources.map((s) => `<li><a href="${esc(safeURL(s.url))}" ${ext}>${esc(s.label)} ↗</a><small>${s.role === "asset" ? "场景 / 模型来源" : "地点 / 作品资料"}</small></li>`).join("")}${e.resources
        .filter((r) => r.kind === "source" || r.kind === "dataset")
        .map(
          (r) =>
            `<li><a href="${esc(safeURL(r.url))}" ${ext}>${esc(r.label)} ↗</a><small>外部项目</small></li>`,
        )
        .join(
          "",
        )}</ul>${downloads.length ? `<div class="notice">${downloads.map((r) => `${esc(r.format)} · ${r.bytes ? (r.bytes / 1024).toFixed(1) + " KB" : ""}`).join(" / ")}。按文件所示格式下载完整资源。</div>` : ""}<div class="detail-foot"><button data-share="${esc(e.id)}">复制条目链接</button><button data-export="${esc(e.id)}">下载条目 JSON</button><a href="${REPO}/issues/new?template=correction.yml&title=${encodeURIComponent("[更正] " + e.name)}" ${ext}>报告问题 ↗</a></div></div>`;
    if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
    $("#detail-dialog").scrollTop = 0;
  }
  function reset() {
    Object.assign(state, {
      category: "all",
      q: "",
      status: "all",
      region: "all",
      world: "all",
      sort: "recommended",
    });
    savedOnly = false;
    syncControls();
    filter();
  }
  function syncControls() {
    $("#search").value = state.q;
    $("#region-filter").value = state.region;
    $("#world-filter").value = state.world;
    $("#sort").value = state.sort;
  }
  function contribution(id) {
    if (id) {
      const e = data.entries.find((e) => e.id === id);
      const f = $("#contribution-form");
      f.elements.name.value = e.name;
      f.elements.category.value = e.category;
      f.elements.world.value = e.world;
      f.elements.location.value = locationText(e);
      f.elements.source.value = e.sources[0].url;
      $("#detail-dialog").close();
    }
    $("#contribute-dialog").showModal();
  }
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button,[data-open]");
    if (!b) return;
    if (b.dataset.open) {
      if (b.dataset.open === "contribute-dialog") contribution();
      else $("#" + b.dataset.open).showModal();
    }
    if (b.classList.contains("dialog-close")) b.closest("dialog").close();
    if (b.dataset.category) {
      state.category = b.dataset.category;
      savedOnly = false;
      filter();
      $("#catalog").scrollIntoView({ behavior: "smooth" });
    }
    if (b.dataset.status) {
      state.status = b.dataset.status;
      filter();
    }
    if (b.dataset.detail) openDetail(b.dataset.detail);
    if (b.dataset.save) {
      const id = b.dataset.save;
      saved = saved.includes(id)
        ? saved.filter((x) => x !== id)
        : [...saved, id];
      try {
        localStorage.setItem("a3w-saved", JSON.stringify(saved));
      } catch {
        toast("浏览器未允许持久保存，收藏只在当前页面有效");
      }
      if (savedOnly) filter();
      else render();
    }
    if (b.dataset.contribute) contribution(b.dataset.contribute);
    if (b.dataset.share) {
      const u = new URL(location.href);
      u.search = "?scene=" + b.dataset.share;
      u.hash = "";
      try {
        await navigator.clipboard.writeText(u.href);
        toast("条目链接已复制");
      } catch {
        toast("可直接复制浏览器地址栏中的条目链接");
      }
    }
    if (b.dataset.export)
      download(
        b.dataset.export + ".json",
        data.entries.find((e) => e.id === b.dataset.export),
      );
    if (b.dataset.action === "reset") reset();
  });
  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    });
  });
  $("#detail-dialog").addEventListener("close", () => {
    activeEntry = null;
    writeURL();
  });
  $("#search").addEventListener("input", () => {
    state.q = $("#search").value;
    filter();
  });
  $("#region-filter").addEventListener("change", () => {
    state.region = $("#region-filter").value;
    filter();
  });
  $("#world-filter").addEventListener("change", () => {
    state.world = $("#world-filter").value;
    filter();
  });
  $("#sort").addEventListener("change", () => {
    state.sort = $("#sort").value;
    filter();
  });
  $("#reset").addEventListener("click", reset);
  $("#saved-filter").addEventListener("click", () => {
    savedOnly = !savedOnly;
    filter();
  });
  function layout(list) {
    $("#catalog-grid").classList.toggle("list", list);
    $("#grid-view").classList.toggle("selected", !list);
    $("#list-view").classList.toggle("selected", list);
    $("#grid-view").setAttribute("aria-pressed", String(!list));
    $("#list-view").setAttribute("aria-pressed", String(list));
  }
  $("#grid-view").addEventListener("click", () => layout(false));
  $("#list-view").addEventListener("click", () => layout(true));
  $("#prev-page").addEventListener("click", () => {
    if (page > 1) {
      page--;
      render();
      $("#catalog").scrollIntoView();
    }
  });
  $("#next-page").addEventListener("click", () => {
    if (page * PAGE_SIZE < results.length) {
      page++;
      render();
      $("#catalog").scrollIntoView();
    }
  });
  $("#export-results").addEventListener("click", () =>
    download("awesome-3d-world-filtered.json", {
      filters: state,
      updated_at: data.updated_at,
      entries: results,
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      !document.querySelector("dialog[open]") &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
    ) {
      e.preventDefault();
      $("#search").focus();
    }
  });
  $("#contribution-category").innerHTML = Object.entries(categories)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  function draft() {
    const f = $("#contribution-form");
    if (!f.reportValidity()) return null;
    const v = Object.fromEntries(new FormData(f));
    for (const key of ["source", "resource"])
      if (v[key] && !v[key].startsWith("https://")) {
        toast("来源和资源请使用 HTTPS 链接");
        return null;
      }
    return {
      name: v.name.trim(),
      category: v.category,
      world: v.world,
      location: v.location.trim(),
      source: v.source,
      resource: v.resource,
      license: v.license,
      notes: v.notes,
      status: v.resource ? "external" : "planned",
    };
  }
  $("#contribution-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = draft();
    if (!v) return;
    const body = `### 场景名称\n${v.name}\n\n### 分类 / 世界属性\n${categories[v.category]} / ${worlds[v.world]}\n\n### 地点或作品\n${v.location}\n\n### 地点来源\n${v.source}\n\n### 浏览或下载资源\n${v.resource || "待补充"}\n\n### 作者与许可\n${v.license}\n\n### 覆盖范围、来源方法与局限\n${v.notes}\n\n建议初始状态：${statuses[v.status]}。请维护者核验后合并。`;
    const u =
      REPO +
      "/issues/new?title=" +
      encodeURIComponent("[场景] " + v.name) +
      "&body=" +
      encodeURIComponent(body);
    window.open(u, "_blank", "noopener,noreferrer");
    $("#form-status").textContent =
      "已打开 GitHub 草稿窗口，请在 GitHub 确认提交。若被浏览器拦截，可下载 JSON 后手动提交 Issue。";
  });
  $("#download-draft").addEventListener("click", () => {
    const v = draft();
    if (v) {
      download("scene-contribution.json", v);
      $("#form-status").textContent =
        "已下载投稿资料；这是投稿草稿，经核验并整理成标准条目后才能加入目录。";
    }
  });
  async function init() {
    try {
      const res = await fetch("data/catalog.json");
      if (!res.ok) throw new Error("目录文件读取失败");
      data = await res.json();
      if (state.category !== "all" && !categories[state.category])
        state.category = "all";
      if (
        ![
          "all",
          "ready",
          "external",
          "planned",
          "unavailable",
          "download",
        ].includes(state.status)
      )
        state.status = "all";
      const codes = [...new Set(data.entries.flatMap((e) => e.countries))];
      if (
        !["all", "international", "fictional", ...codes].includes(state.region)
      )
        state.region = "all";
      $("#region-filter").insertAdjacentHTML(
        "beforeend",
        '<optgroup label="国家 / 地区">' +
          codes
            .filter((c) => c !== "CN")
            .sort((a, b) => dn.of(a).localeCompare(dn.of(b), "zh-CN"))
            .map((c) => `<option value="${esc(c)}">${esc(dn.of(c))}</option>`)
            .join("") +
          "</optgroup>",
      );
      if (!["all", "real", "historical", "fictional"].includes(state.world))
        state.world = "all";
      const scene = params.get("scene");
      $("#category-nav").innerHTML = Object.entries(categories)
        .map(
          ([k, v]) =>
            `<button class="side-item" data-category="${k}"><span class="nav-symbol">${symbols[k]}</span><span>${v}</span><b>${(data.stats.by_category[k] || 0).toLocaleString()}</b></button>`,
        )
        .join("");
      for (const k of ["total", "countries", "ready", "external"])
        $("#metric-" + k).textContent = data.stats[k].toLocaleString();
      $("#snapshot-date").textContent =
        "目录快照 " + data.updated_at + " · 以原始来源为准";
      syncControls();
      filter();
      if (scene) openDetail(scene);
    } catch (err) {
      $("#catalog-grid").innerHTML =
        '<div class="empty"><h3>目录暂时未能打开</h3><p>请刷新重试，或到 GitHub 阅读分类目录。</p><a class="button primary" href="' +
        REPO +
        '/tree/main/catalog">打开 GitHub 目录 ↗</a></div>';
      console.error(err);
    }
    try {
      const res = await fetch("assets/hubs.json");
      if (!res.ok) throw new Error("资源导航读取失败");
      const hubs = await res.json();
      $("#hubs-list").innerHTML = hubs
        .map(
          (h) =>
            `<a class="hub" href="${esc(safeURL(h.url))}" ${ext}><small>${esc(h.type)}</small><h3>${esc(h.name)} ↗</h3><p>${esc(h.description)}</p></a>`,
        )
        .join("");
    } catch {
      $("#hubs-list").textContent = "资源导航暂不可用，请刷新重试。";
    }
  }
  init();
})();
