(() => {
  const { SEL, parseRow, mergeMessages, toText } = window.RCC;

  const roomIdFromUrl = () => {
    const m = location.pathname.match(/\/room\/([^/?#]+)/);
    return m ? m[1] : null;
  };
  const keyFor = id => `room:${id}`;

  const state = { roomId: null, createdAt: 0, messages: [] };
  let loading = false;
  let saveTimer = null;
  let observedList = null;
  let observer = null;

  // ---------- storage ----------
  async function loadRoom(id) {
    loading = true;
    try {
      const res = await chrome.storage.local.get(keyFor(id));
      const saved = res[keyFor(id)];
      state.roomId = id;
      state.createdAt = saved ? saved.createdAt : Date.now();
      state.messages = saved ? saved.messages : [];
    } catch (e) {
      state.roomId = id; state.createdAt = Date.now(); state.messages = [];
    }
    loading = false;
    updateUI();
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        chrome.storage.local.set({
          [keyFor(state.roomId)]: {
            roomId: state.roomId,
            createdAt: state.createdAt,
            updatedAt: Date.now(),
            messages: state.messages,
          },
        });
      } catch (e) { /* extension reloaded; page needs a refresh */ }
    }, 300);
  }

  // ---------- capture ----------
  function scan() {
    if (loading) return;
    const id = roomIdFromUrl();
    if (!id) return;
    if (id !== state.roomId) { loadRoom(id); return; }

    const dom = [...document.querySelectorAll(SEL.row)].map(parseRow).filter(Boolean);
    const added = mergeMessages(state.messages, dom, Date.now());
    if (added.length) {
      state.messages.push(...added);
      save();
      updateUI();
    }
  }

  // Watch the list for instant capture; heartbeat re-attaches if React replaces it.
  function attachObserver() {
    const first = document.querySelector(SEL.row);
    const list = first ? first.parentElement : null;
    if (list === observedList) return;
    if (observer) observer.disconnect();
    observedList = list;
    if (!list) return;
    observer = new MutationObserver(() => scan());
    observer.observe(list, { childList: true, subtree: true, characterData: true });
  }

  setInterval(() => { attachObserver(); scan(); }, 1000);

  // ---------- minimal UI (Stage 1; full Richup-styled viewer comes in Stage 3) ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .bar{display:flex;gap:6px;align-items:center;font:12px/16px Nunito,"Segoe UI",sans-serif;color:#e6e3f0}
      button{padding:6px 10px;border:0;border-radius:8px;background:#6647e0;color:#fff;cursor:pointer;font:inherit}
      button:hover{filter:brightness(1.1)}
      .count{padding:6px 8px;border-radius:8px;background:rgba(20,16,40,.85)}
    </style>
    <div class="bar">
      <span class="count" id="count">0 msgs</span>
      <button id="copy">Copy</button>
      <button id="txt">.txt</button>
      <button id="json">.json</button>
      <button id="view">View</button>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = id => root.getElementById(id);
  function updateUI() { $("count").textContent = `${state.messages.length} msgs`; }
  function flash(btn, t) { const o = btn.textContent; btn.textContent = t; setTimeout(() => (btn.textContent = o), 1200); }

  function download(name, data, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("copy").onclick = async () => {
    scan();
    try { await navigator.clipboard.writeText(toText(state.messages)); flash($("copy"), "Copied"); }
    catch { flash($("copy"), "Failed"); }
  };
  $("txt").onclick = () => { scan(); download(`richup-${state.roomId}.txt`, toText(state.messages), "text/plain"); };
  $("view").onclick = () => { try { chrome.runtime.sendMessage({ type: "open-viewer", room: state.roomId }); } catch (e) { flash($("view"), "Reload page"); } };
  $("json").onclick = () => { scan(); download(`richup-${state.roomId}.json`, JSON.stringify(state, null, 2), "application/json"); };
})();
