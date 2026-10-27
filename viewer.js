(() => {
  const { toText } = window.RCC;
  const { buildPanel } = window.RCCView;
  const $ = id => document.getElementById(id);

  let rooms = {};
  let current = decodeURIComponent(location.hash.slice(1)) || null;

  const ordered = () => Object.values(rooms).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  async function loadAll() {
    const all = await chrome.storage.local.get(null);
    rooms = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("room:") && v && Array.isArray(v.messages)) rooms[k.slice(5)] = v;
    }
    if (!current || !rooms[current]) current = (ordered()[0] || {}).roomId || null;
    render();
  }

  function render() {
    // sidebar
    const side = $("rooms");
    side.textContent = "";
    ordered().forEach(r => {
      const b = document.createElement("button");
      b.className = "room" + (r.roomId === current ? " active" : "");
      b.textContent = `Room ${r.roomId}`;
      const s = document.createElement("small");
      s.textContent = `${r.messages.length} messages · ${new Date(r.updatedAt || r.createdAt).toLocaleString()}`;
      b.append(s);
      b.onclick = () => { current = r.roomId; location.hash = encodeURIComponent(current); render(); };
      side.append(b);
    });
    if (!side.children.length) side.innerHTML = '<div class="empty">Nothing saved yet. Open a Richup room and chat.</div>';

    // chat (keep scroll position; stick to bottom if you were at the bottom = live follow)
    const host = $("chatHost");
    const prev = host.querySelector(".list");
    const atBottom = !prev || prev.scrollHeight - prev.scrollTop - prev.clientHeight < 40;
    const oldTop = prev ? prev.scrollTop : 0;
    host.textContent = "";
    const msgs = current && rooms[current] ? rooms[current].messages : [];
    const panel = buildPanel(msgs);
    host.append(panel);
    const list = panel.querySelector(".list");
    list.scrollTop = atBottom ? list.scrollHeight : oldTop;

    ["copy", "txt", "json", "html", "del"].forEach(id => ($(id).disabled = !current));
  }

  // ----- exports -----
  const flash = (btn, t) => { const o = btn.textContent; btn.textContent = t; setTimeout(() => (btn.textContent = o), 1200); };
  function download(name, data, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const room = () => rooms[current];

  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(toText(room().messages)); flash($("copy"), "Copied"); }
    catch { flash($("copy"), "Failed"); }
  };
  $("txt").onclick = () => download(`richup-${current}.txt`, toText(room().messages), "text/plain");
  $("json").onclick = () => download(`richup-${current}.json`, JSON.stringify(room(), null, 2), "application/json");

  // Self-contained HTML: CSS + fonts (base64) + the rendered panel. Opens anywhere, offline.
  async function inlineFonts(css) {
    const urls = [...new Set([...css.matchAll(/url\(["']?(fonts\/[^"')]+)["']?\)/g)].map(m => m[1]))];
    for (const u of urls) {
      const buf = await (await fetch(chrome.runtime.getURL(u))).arrayBuffer();
      const dataUrl = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(new Blob([buf], { type: "font/woff2" }));
      });
      css = css.split(u).join(dataUrl);
    }
    return css;
  }
  $("html").onclick = async () => {
    const btn = $("html");
    try {
      const css = await inlineFonts(await (await fetch(chrome.runtime.getURL("viewer.css"))).text());
      const panel = $("chatHost").querySelector(".panel").cloneNode(true);
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Richup chat ${current}</title><style>${css}</style></head><body class="export"><div class="export-wrap">${panel.outerHTML}</div></body></html>`;
      download(`richup-chat-${current}.html`, html, "text/html");
    } catch (e) { flash(btn, "Failed"); }
  };

  $("del").onclick = async () => {
    if (!current || !confirm(`Delete the saved chat for room ${current}? This cannot be undone.`)) return;
    await chrome.storage.local.remove(`room:${current}`);
    current = null;
    loadAll();
  };

  // live updates while you are playing
  let t = null;
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && Object.keys(ch).some(k => k.startsWith("room:"))) { clearTimeout(t); t = setTimeout(loadAll, 200); }
  });
  window.addEventListener("hashchange", () => { current = decodeURIComponent(location.hash.slice(1)) || current; render(); });

  loadAll();
})();
