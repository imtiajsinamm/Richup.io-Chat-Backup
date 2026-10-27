# Richup Chat Saver

A small Chrome extension that captures live Richup chat rooms and lets you reopen, copy, and export saved conversations.

## What it does

- Watches the active Richup room and stores all messages in `chrome.storage.local`
- Keeps room histories separate by room ID
- Opens a bundled viewer to browse saved rooms
- Exports chat data as plain text, JSON, or standalone HTML
- Works offline for the exported HTML bundle

## Install

1. Open Chrome and go to `chrome://extensions`
2. Enable Developer mode
3. Choose "Load unpacked"
4. Select this repository folder
5. Visit a Richup room and use the extension toolbar/button to open the saved chat viewer

## Project structure

- `content.js` — watches the Richup page and saves new messages
- `core.js` — message parsing and merge logic
- `render.js` — Richup-style chat renderer for the saved viewer
- `viewer.html` / `viewer.css` / `viewer.js` — exported saved-chat viewer UI
- `background.js` — opens the viewer from the extension action
- `manifest.json` — extension manifest

## Notes

This project is intentionally lightweight and uses the browser's storage API instead of a backend. It focuses on preserving the Richup chat style and making exported conversations easy to reuse.

## Local development

There are no build steps for this project. You can open the extension as unpacked and test it directly in Chrome.
