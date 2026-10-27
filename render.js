// Builds Richup-style chat DOM from stored messages. Pure DOM, no chrome.* calls.
(function (root) {
  const AVATAR = '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#character_svg__a)"><path d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16Z" fill="currentColor"></path><path opacity="0.1" fill-rule="evenodd" clip-rule="evenodd" d="M16 15.927c8.837 0 16-8.836 16 0a16 16 0 0 1-32 0c0-8.836 7.163 0 16 0Z" fill="#000"></path><path d="M17.586 22.927a4.414 4.414 0 1 0 8.828 0 4.414 4.414 0 0 0-8.828 0ZM5.804 22.927c0 2.438 1.966 4.414 4.391 4.414s4.391-1.976 4.391-4.414c0-2.437-1.966-4.413-4.39-4.413-2.426 0-4.392 1.976-4.392 4.413Z" fill="#fff"></path><path d="M20.414 24.747c0 .88.71 1.594 1.586 1.594a1.59 1.59 0 0 0 1.587-1.594c0-.88-.71-1.594-1.587-1.594a1.59 1.59 0 0 0-1.586 1.594ZM8.602 24.747a1.594 1.594 0 1 0 3.188 0 1.594 1.594 0 0 0-3.188 0Z" fill="#000"></path></g><defs><clipPath id="character_svg__a"><path fill="#fff" d="M0 0h32v32H0z"></path></clipPath></defs></svg>';

  const safeColor = c => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#8a7fb0");
  const el = (doc, tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text; // user text is never parsed as HTML
    return e;
  };

  function buildMessage(m, doc = document) {
    if (m.type && m.type !== "player") return el(doc, "div", "msg msg-system", m.text);
    const own = !m.name; // your own messages have no name label on Richup
    const row = el(doc, "div", "msg" + (own ? " own" : ""));
    if (m.ts) row.title = new Date(m.ts).toLocaleString();
    const icon = el(doc, "div", "icon");
    icon.style.color = safeColor(m.color);
    icon.innerHTML = AVATAR; // constant markup only
    const bubble = el(doc, "div", "bubble");
    if (!own) bubble.append(el(doc, "div", "name", m.name));
    bubble.append(el(doc, "div", "text", m.text));
    row.append(icon, bubble);
    return row;
  }

  function buildPanel(messages, doc = document) {
    const panel = el(doc, "div", "panel");
    panel.append(el(doc, "div", "panel-head", "Chat"));
    const list = el(doc, "div", "list");
    if (!messages.length) list.append(el(doc, "div", "empty", "No messages captured yet."));
    messages.forEach(m => list.append(buildMessage(m, doc)));
    panel.append(list);
    return panel;
  }

  root.RCCView = { buildMessage, buildPanel };
  if (typeof module !== "undefined") module.exports = root.RCCView;
})(typeof window !== "undefined" ? window : globalThis);
