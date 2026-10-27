(() => {
  const { buildPanel } = window.RCCView;
  const $ = id => document.getElementById(id);

  let rooms = {};
  let current = decodeURIComponent(location.hash.slice(1)) || null;
  let selected = new Set();

  const ordered = () => Object.values(rooms).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const downloadFile = (filename, data, type) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const roomListIds = () => ordered().map(r => r.roomId);

  function normalizeImportedRooms(data) {
    const imported = {};
    if (!data || typeof data !== "object") return imported;

    if (Array.isArray(data.rooms)) {
      for (const room of data.rooms) {
        if (room && room.roomId && Array.isArray(room.messages)) imported[room.roomId] = room;
      }
      return imported;
    }

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("room:") && value && Array.isArray(value.messages)) {
        imported[key.slice(5)] = value;
      } else if (value && value.roomId && Array.isArray(value.messages)) {
        imported[value.roomId] = value;
      }
    }

    return imported;
  }

  async function loadAll() {
    const all = await chrome.storage.local.get(null);
    rooms = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("room:") && v && Array.isArray(v.messages)) rooms[k.slice(5)] = v;
    }
    if (!current || !rooms[current]) current = roomListIds()[0] || null;
    render();
  }

  function render() {
    const side = $("rooms");
    side.textContent = "";
    ordered().forEach(r => {
      const row = document.createElement("div");
      row.className = "room-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "room-select";
      checkbox.checked = selected.has(r.roomId);
      checkbox.setAttribute("aria-label", `Select room ${r.roomId}`);
      checkbox.addEventListener("change", event => {
        if (event.target.checked) selected.add(r.roomId);
        else selected.delete(r.roomId);
      });

      const b = document.createElement("button");
      b.className = "room" + (r.roomId === current ? " active" : "");
      b.type = "button";
      b.setAttribute("aria-pressed", String(r.roomId === current));
      b.textContent = `Room ${r.roomId}`;
      const s = document.createElement("small");
      s.textContent = `${r.messages.length} messages · ${new Date(r.updatedAt || r.createdAt).toLocaleString()}`;
      b.append(s);
      b.onclick = () => {
        current = r.roomId;
        location.hash = encodeURIComponent(current);
        render();
      };

      row.append(checkbox, b);
      side.append(row);
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

  function verifySelection() {
    const ids = [...selected].filter(id => rooms[id]);
    if (!ids.length) {
      alert("Select at least one saved room to export.");
      return null;
    }
    return ids;
  }

  function exportBackup(roomIds) {
    const ids = roomIds && roomIds.length ? roomIds : roomListIds();
    const roomsToExport = ids.map(id => rooms[id]).filter(Boolean);

    if (!roomsToExport.length) {
      alert("There are no saved chats to export yet.");
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      rooms: roomsToExport,
      storage: Object.fromEntries(roomsToExport.map(room => [`room:${room.roomId}`, room]))
    };

    downloadFile(
      roomsToExport.length === 1 ? `richup-room-${roomsToExport[0].roomId}.json` : "richup-chats-backup.json",
      JSON.stringify(payload, null, 2),
      "application/json"
    );
  }

  function exportSelected() {
    const ids = verifySelection();
    if (!ids) return;
    exportBackup(ids);
  }

  function exportAll() {
    exportBackup(roomListIds());
  }

  function exportHtml() {
    const room = current && rooms[current] ? rooms[current] : null;
    if (!room) {
      alert("Select a saved room before exporting it as HTML.");
      return;
    }

    const title = `Richup Chat - Room ${room.roomId}`;
    const chatHtml = buildPanel(room.messages).outerHTML;
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="viewer.css">
    <style>
      body { background: #130f1d; color: #fff; font-family: Arial, sans-serif; margin: 0; }
      .app { max-width: 700px; margin: 24px auto; padding: 0 12px; }
      .panel { margin: 0 auto; }
    </style>
  </head>
  <body>
    <div class="app">
      ${chatHtml}
    </div>
  </body>
</html>`;

    downloadFile(`richup-room-${room.roomId}.html`, html, "text/html");
  }

  async function deleteCurrentRoom() {
    if (!current || !rooms[current]) {
      alert("Select a saved room to delete.");
      return;
    }

    if (!window.confirm(`Delete the saved chat for room ${current}?`)) return;

    await chrome.storage.local.remove(`room:${current}`);
    selected.delete(current);
    await loadAll();
  }

  async function importBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const imported = normalizeImportedRooms(data);

        if (!Object.keys(imported).length) {
          alert("No valid saved rooms were found in that file.");
          return;
        }

        const shouldReplace = window.confirm("Importing this backup will replace your current saved chats. Continue?");
        if (!shouldReplace) return;

        await chrome.storage.local.clear();
        await chrome.storage.local.set(Object.fromEntries(
          Object.entries(imported).map(([roomId, room]) => [`room:${roomId}`, room])
        ));

        selected.clear();
        current = null;
        await loadAll();
        if (roomListIds().length) {
          current = roomListIds()[0];
          location.hash = encodeURIComponent(current);
          render();
        }
      } catch (error) {
        console.error(error);
        alert("That backup file could not be imported. Please choose a valid Richup export file.");
      }
    });

    input.click();
  }

  function bindControls() {
    $("import").addEventListener("click", importBackup);
    $("exportSelected").addEventListener("click", exportSelected);
    $("exportAll").addEventListener("click", exportAll);
    $("html").addEventListener("click", exportHtml);
    $("del").addEventListener("click", deleteCurrentRoom);
  }

  let t = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && Object.keys(changes).some(k => k.startsWith("room:"))) {
      clearTimeout(t);
      t = setTimeout(loadAll, 200);
    }
  });

  window.addEventListener("hashchange", () => {
    current = decodeURIComponent(location.hash.slice(1)) || current;
    render();
  });

  bindControls();
  loadAll();
})();
