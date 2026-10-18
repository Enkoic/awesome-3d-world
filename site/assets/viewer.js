"use strict";
(async () => {
  const q = (s) => document.querySelector(s);
  const id = new URLSearchParams(location.search).get("id");
  try {
    const response = await fetch("data/catalog.json");
    if (!response.ok) throw new Error("目录加载失败");
    const data = await response.json();
    const entry = data.entries.find((e) => e.id === id);
    if (!entry || entry.status !== "ready")
      throw new Error("这个条目尚未提供已验证的三维场景。");
    const previews = entry.resources.filter((r) => r.kind === "preview");
    const variant = Number(
      new URLSearchParams(location.search).get("view") || 0,
    );
    const preview =
      previews[Number.isInteger(variant) ? variant : 0] || previews[0];
    if (!preview || !/^scenes\/[a-z0-9-]+\/[a-z0-9-]+\.html$/.test(preview.url))
      throw new Error("此资源请通过详情页访问。");
    document.title = entry.name + " · Awesome 3D World";
    q("#viewer-title").textContent = entry.name;
    q("#viewer-name").textContent = entry.name;
    q("#viewer-meta").textContent = entry.accuracy.geometry || "";
    q("#viewer-details").href = "./?scene=" + encodeURIComponent(id);
    q("#viewer-note").textContent = entry.description;
    if (/^assets\/[a-z0-9-]+\.(webp|png|jpg)$/.test(entry.thumbnail || ""))
      q(".viewer-cover").style.backgroundImage =
        `linear-gradient(#0f281c55,#0f281c99),url("${new URL(entry.thumbnail, location.href).href}")`;
    const file = entry.resources.find((r) => r.kind === "download");
    if (file) {
      q("#viewer-download").hidden = false;
      q("#viewer-download").href = file.url;
      q("#viewer-download").download =
        id +
        (file.url.endsWith(".zip")
          ? ".zip"
          : file.url.endsWith(".glb")
            ? ".glb"
            : ".html");
      q("#viewer-download").textContent = file.format.includes("ZIP")
        ? "下载运行包 ↓"
        : file.format === "GLB"
          ? "下载 GLB ↓"
          : "下载 HTML ↓";
    }
    const b = q("#load-scene");
    b.disabled = false;
    b.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.title = entry.name + "三维交互场景";
      frame.src = preview.url + "?nointro=1";
      frame.allow = "fullscreen";
      frame.setAttribute(
        "sandbox",
        entry.self_contained === false
          ? "allow-scripts allow-same-origin allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox"
          : "allow-scripts allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox",
      );
      q("#viewer-stage").replaceChildren(frame);
    });
  } catch (e) {
    q("#viewer-name").textContent = "场景暂不可浏览";
    q("#viewer-note").textContent = e.message;
  }
})();
