---
name: RecordButton Portal Fix
description: Why RecordButton overlays must use createPortal — backdrop-blur-sm on the app header traps fixed elements
---

## Rule
All overlays rendered by `RecordButton` (PreflightDialog, CountdownOverlay, WebcamPip, recording bars, minimized pill, panel) must use `createPortal(…, document.body)`.

**Why:** The app `TopBar` header has `backdrop-blur-sm` which creates a CSS compositing context. Any `position: fixed` element rendered as a descendant of that header is positioned relative to the compositing layer, not the viewport — causing clipping, wrong offsets, and inability to cover the full screen.

**How to apply:** Any time a component inside a header/navbar with `backdrop-blur`, `filter`, `transform`, or `perspective` needs to render full-screen overlays, those overlays must escape via `createPortal`. Use `z-[9000]` or higher (not `z-50`/`z-[500]`) so they sit above all app chrome.

The early-return pattern (`if (showDialog) return <Dialog/>`) was also problematic because it hid the header button, creating a "stuck" state with no escape. The fix renders the button always and portals overlays conditionally.
