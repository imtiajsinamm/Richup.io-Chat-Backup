// Pure logic: parsing and merging. No chrome.* or page side effects, so it is testable.
(function (root) {
  // Anchor on data-testid attributes (stable), never on hashed class names.
  const SEL = {
    row: '[data-testid="chat-message"]',
    name: '[data-testid="chat-sender-name"]',
    icon: '[data-testid="chat-sender-icon"]',
  };

  const clean = s => (s || "").replace(/\s+/g, " ").trim();

  function parseRow(row) {
    const nameEl = row.querySelector(SEL.name);
    const iconEl = row.querySelector(SEL.icon);
    let text = "";

    // Text = every sibling of the name element inside the same wrapper.
    if (nameEl && nameEl.parentElement) {
      text = clean(
        [...nameEl.parentElement.children]
          .filter(c => c !== nameEl)
          .map(c => c.textContent)
          .join(" ")
      );
    }
    // Fallback (e.g. own messages with no name label): whole row text minus the name.
    if (!text) {
      const all = clean(row.textContent);
      const n = nameEl ? clean(nameEl.textContent) : "";
      text = n && all.startsWith(n) ? clean(all.slice(n.length)) : all;
    }
    if (!text) return null;

    return {
      type: row.dataset.messageType || "unknown",
      senderId: row.dataset.senderId || "",
      name: nameEl ? clean(nameEl.textContent) : "",
      color: iconEl ? iconEl.dataset.appearance || "" : "",
      text,
    };
  }

  const same = (a, b) =>
    a.senderId === b.senderId && a.text === b.text && a.name === b.name && a.type === b.type;

  // Returns only the NEW messages. Finds the longest overlap where the tail of what we
  // already stored equals the head of what is on screen. This survives page re-renders
  // (new DOM nodes), site-side trimming of old messages, and legit repeated messages.
  function mergeMessages(stored, dom, now) {
    const max = Math.min(stored.length, dom.length);
    let k = 0;
    for (let n = max; n > 0; n--) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (!same(stored[stored.length - n + i], dom[i])) { ok = false; break; }
      }
      if (ok) { k = n; break; }
    }
    return dom.slice(k).map(m => ({ ...m, ts: now }));
  }

  const pad = n => String(n).padStart(2, "0");
  const fmtTime = ts => {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  function toText(msgs) {
    return msgs.map(m => `[${fmtTime(m.ts)}] ${m.name || "You"}: ${m.text}`).join("\n");
  }

  root.RCC = { SEL, parseRow, mergeMessages, toText, fmtTime };
  if (typeof module !== "undefined") module.exports = root.RCC;
})(typeof window !== "undefined" ? window : globalThis);
