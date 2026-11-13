# Fillora — mobile web / installable app (PWA)

Same codebase, two layouts: desktop (≥768px, mouse) is unchanged; phones/tablets get a touch UI.

**Install on Android:** open the deployed site in Chrome → ⋮ → *Install app* / *Add to Home screen*.
It then launches full-screen, works offline (after first load + first model download) and can share the exported PDF via the Android share sheet.

## What changed
- `MobileTopBar`, `MobileBottomBar`, `MobileSheet`, `MobileDetectPanel`: thumb-reach bottom bar (Pages · Detect · Add · Style), bottom sheets instead of side panels.
- Viewer: fit-to-width on open, two-finger pinch zoom (CSS-transform while pinching, one re-render on release), page pager, long-press to add a field.
- Field overlays: mouse → Pointer Events (touch + pen + mouse), larger invisible hit areas on resize handles, focused input scrolls above the keyboard.
- Performance: canvas pixel budget + DPR cap, in-flight render cancel (fixes a double-render error), export supersampling 8× → 4× on phones, 1 WASM thread on phones, FFDNet-L hidden on low-memory devices.
- PWA: `manifest.webmanifest`, `sw.js` (app shell/fonts/CDN cache; models are left to the existing Cache API logic), icons, `viewport-fit=cover`, `100dvh`.
- Export on phones uses `navigator.share` (files) with a download fallback.
