(() => {
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
    const side = $("rooms");
    side.textContent = "";
    ordered().forEach(r => {
      const b = document.createElement("button");
      b.className = "room" + (r.roomId === current ? " active" : "");
      b.type = "button";
      b.setAttribute("aria-pressed", String(r.roomId === current));
      b.textContent = `Room ${r.roomId}`;
      const s = document.createElement("small");
      s.textContent = `${r.messages.length} messages · ${new Date(r.updatedAt || r.createdAt).toLocaleString()}`;
      b.append(s);
      b.onclick = () => { current = r.roomId; location.hash = encodeURIComponent(current); render(); };
      side.append(b);
    });
    if (!side.children.length) side.innerHTML = '<div class="empty">Nothing saved yet. Open a Richup room and chat.</div>';

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
  }

  let t = null;
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && Object.keys(ch).some(k => k.startsWith("room:"))) { clearTimeout(t); t = setTimeout(loadAll, 200); }
  });
  window.addEventListener("hashchange", () => { current = decodeURIComponent(location.hash.slice(1)) || current; render(); });

  loadAll();
})();
