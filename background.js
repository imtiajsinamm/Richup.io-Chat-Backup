const open = room => chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") + (room ? "#" + encodeURIComponent(room) : "") });
chrome.action.onClicked.addListener(() => open());
chrome.runtime.onMessage.addListener(msg => { if (msg && msg.type === "open-viewer") open(msg.room); });
