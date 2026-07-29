# Demo Recorder Studio

## Goal

Create a lightweight desktop application for recording SaaS product demos.

The application must be extremely simple.

This is NOT a video editor.

It is a screen recorder with basic editing.

---

## Product Vision

Demo Recorder Studio is evolving from a single screen recorder into a full **AI Marketing Content Studio** for creators, freelancers, agencies, SaaS companies, and small businesses: one application, many independent modules, all reachable from the same Home Screen.

This vision does NOT change what Version 1 ships. Recorder, Video Snipping Tool, and Shorts Creator remain the only fully implemented modules, and every constraint and success criterion documented below for them still applies exactly as written. The sections below on **Planned Modules** and **Module Architecture** describe how the codebase is *prepared* for future modules — they are not a request to build those modules now. Only build what's explicitly asked for; everything else stays a disabled "Coming Soon" entry in the registry.

### Planned Modules

Only Recorder, Video Snipping Tool, and Shorts Creator are built today. The following are future modules — architecture is prepared for them (see Module Architecture below), but none of their functionality exists yet. Each appears on the Home Screen today only as a disabled "Coming Soon" card via the module registry.

**Spot Creator** — promotional videos for businesses, built from templates: Restaurant, Dentist, Gym, Barber, Beauty Salon, Real Estate, Lawyer, Product Promotion, Sales Promotion, Events, Local Business, SaaS Promotion.

**AI Copywriter** — generates marketing text: Hooks, Titles, Descriptions, CTAs, Hashtags, Video Scripts.

**Brand Kit** — stores a business's reusable identity: Logo, Colors, Fonts, Music, Overlays, Intro, Outro, Business information. Once built, other modules (Spot Creator, Shorts Creator, etc.) may read from it, but Brand Kit itself never depends on them.

**Social Export** — export presets tuned for each platform's format: YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, WhatsApp Status, LinkedIn.

None of these four are wired to any renderer flow, IPC handler, or logic yet. Building one means giving it its own module folder and flow, exactly like Recorder, Snip, and Shorts already have — see Module Architecture.

---

## Home Screen

The permanent entry point of the application.

The user chooses one workflow before entering the application.

Only one workflow is displayed at a time.

The Home Screen is **data-driven**: it renders one card per entry in the module registry (`src/shared/module-registry.js`), in registry order. It does not hardcode a workflow list — see Module Architecture below.

Enabled modules (Recorder, Video Snipping Tool, Shorts Creator today):

- 🎥 Record a New Demo
- ✂ Video Snipping Tool
- 📱 Shorts Creator

Planned modules (Spot Creator, AI Copywriter, Brand Kit, Social Export) render as disabled cards with a "Coming Soon" badge — this is the one sanctioned exception to "no placeholders": a module already committed to the product vision and listed in the registry, with no functionality behind it yet, is a disabled Coming Soon card, not a fake/interactive placeholder. An entry with no real product commitment behind it (e.g. a generic "Settings" card) still does not get added.

The Screen Recorder, the Video Snipping Tool, and Shorts Creator are completely independent internally. None of them depend on any other. Same rule for every future module.

This structure allows future modules (Spot Creator, AI Copywriter, Brand Kit, Social Export, and beyond) to be added later without changing the architecture or the Home Screen rendering code.

---

## Tech Stack

- Electron
- Node.js
- FFmpeg
- `msedge-tts` (Shorts Creator text-to-speech only — MIT licensed, free, keyless Microsoft Edge Read Aloud service)

Do NOT use TypeScript.

Use plain JavaScript.

---

## Recording Engine

Recording uses Electron's native `desktopCapturer` API combined with `MediaRecorder`.

Playwright is OUT OF SCOPE for Version 1.

Playwright may be introduced in Version 2 or later, for automated demo recording only.

---

## MVP

### Recording

The application records a selected application window (browser, VS Code, Chrome, etc.).

The user may select any application window.

Buttons:

- Start Recording
- Pause
- Stop

#### Audio

Microphone audio only.

No system audio in Version 1.

---

### Preview

When recording finishes:

Show the recorded video.

---

### Basic Editing

Allow only:

- Cut beginning
- Cut end
- Delete selected segment

See Version 1 Constraints for full restrictions.

---

### Export

Export as:

MP4

Resolution (user-selectable):

- 1080x1920
- 1920x1080

#### Resolution Fit Rules

The export must always preserve the complete recording.

Never crop the recorded window.

Never stretch the recorded window.

Always use proportional scaling with black padding ("Fit" mode) when the recording's aspect ratio does not match the export resolution.

The entire application window must always remain visible and readable.

---

### UI

Very clean.

Modern.

Light theme. White background, green accent (`#16A34A`).

Only one window.

---

## Video Snipping Tool

An independent workflow, entered from the Home Screen.

Operates on an existing video file already on disk — NOT a recording made by this application.

Supported input formats:

- MP4
- MOV
- MKV
- WEBM

Always exports as MP4.

Never modifies the original file.

Always creates a new output file.

Example: `demo.mp4` → `demo-cut.mp4`

Three independent operations are supported: Time Trim, Video Crop, and Multi Segment Remove.

### Time Trim

Select:

- Start time
- End time

using draggable markers on a timeline below the video.

Export contains only that time range.

### Video Crop

Behaves like the Windows Snipping Tool, but for video.

The user clicks "Crop".

A resizable rectangle appears over the video preview.

The user drags and resizes the rectangle.

Everything outside the rectangle is discarded.

The exported video contains ONLY the selected region.

No black borders.

No padding.

No surrounding content.

The output resolution matches the selected rectangle exactly — this is the opposite of the Screen Recorder's Export, which pads to a fixed target resolution. Video Crop never pads.

### Multi Segment Remove (Ripple Delete)

Allows the user to remove multiple unwanted portions from a video in a single export.

Example:

Video duration `0 ------------------------------------------- 60`

User removes `10–16` and `23–30`.

Exported video automatically becomes `0–10`, `16–23`, `30–60`, joined together automatically. The user does not export multiple times.

#### Workflow

Open Video → Preview → Timeline → Create multiple Remove Segments → Preview Final Result → Export MP4.

#### Timeline

The user can create multiple removable segments on the timeline. Each removable segment is visually different from the kept portions: a red translucent overlay.

#### Controls

- Add Remove Segment
- Delete Selected Segment
- Undo
- Redo
- Zoom Timeline
- Frame Step

#### Preview

The Preview simulates the final result: removed portions are skipped during playback, so the user can verify the result before exporting.

#### Export

Export generates ONE MP4. Internally: keep all remaining sections, concatenate them, export as one continuous video. No quality loss whenever possible. Reuses the existing FFmpeg architecture (the same `runFFmpeg` process runner used by Time Trim and Video Crop).

Multi Segment Remove is its own isolated module (`src/snip/remove-segments.js`), independent from `cut.js` (Time Trim) and `crop.js` (Video Crop). The Screen Recorder's own single Trim/Delete-segment editing is untouched by this feature — Multi Segment Remove exists only in the Video Snipping Tool.

### Combining Trim, Crop, and Remove Segments

Time Trim, Video Crop, and Multi Segment Remove are independent operations.

The user may apply any combination of them, including all three together, in a single export.

### Out of Scope (Video Snipping Tool)

See Version 1 Constraints for restrictions that apply globally (no AI, no transitions, no subtitles, no captions, etc.).

Also do NOT implement, specific to this tool:

- Filters
- Text overlays
- Multiple clips
- Merging videos
- Zoom or emphasis effects on the video content itself (Zoom Timeline, the navigation control for placing Remove Segments precisely, is not this — it zooms the timeline UI, not the video)
- Color correction
- Timeline effects (transitions, fades, keyframe-based effects — not to be confused with the Multi Segment Remove timeline itself, which is structural editing, not an effect)

---

## Shorts Creator

An independent workflow, entered from the Home Screen. "Shorts Creator Lite" — a lightweight, standalone, script-to-video generator. Does NOT depend on an existing recorded or opened video; it is entirely generative, from a script and a small set of bundled local assets.

The full AI-powered Shorts generator (AI-generated visuals, script assistance, etc.) is a separate, unrelated application. This module does not depend on it, does not share code with it, and does not attempt to replicate it.

### Constraints

No OpenAI. No Playwright. No cloud services requiring payment, an account, or an API key.

Text-to-speech uses Microsoft Edge's free, keyless "Read Aloud" service (via the `msedge-tts` package). This makes a real network call to a Microsoft-operated endpoint — it is not literally offline — but it requires no account, no API key, and no payment. "No cloud services" in this project means no paid cloud services, no accounts, no API keys — not zero network activity.

No AI-generated visuals. The visual background always comes from a small, fixed set of locally bundled assets (see Assets below), never generated per-request and never fetched from the network.

### Workflow

The project is built from **segments**, not one flat script. It always starts with exactly one segment; the user adds more only when needed.

Per segment: Script → (optional Voice/Music override) → Overlay → Preview this segment → Accept (or change something and preview again) → move on / add another segment.

Once every segment is accepted: Generate Final Video (concatenates the accepted segments into one MP4) → Preview → Export MP4.

### Segments

- The project always starts with exactly **one** segment. The user adds more with ➕ and removes them with ➖ (➖ is disabled when only one segment remains — there is always at least one).
- ➕ adds a new blank segment directly below the segment it was clicked on, not always at the end.
- Each segment has its own **Script**, **Overlay**, and optionally its own **Voice** and **Music** (see Inputs below). When a segment doesn't override Voice/Music, it uses the project's default Voice/Music.
- 👁 **Preview** renders *only that segment* (its own script, effective voice, effective music, its own overlay) to a small MP4 and shows it inline in that segment's card.
- After a preview, the user either **Accepts** it (segment is marked approved and that rendered clip is what gets used in the final video), or discards it (**Cancel**, if never accepted, or **Preview Again** once already approved) and keeps editing.
- Editing any part of an already-previewed/approved segment (script, voice override, music override, overlay, or the project's default Voice/Music/Music Volume if this segment doesn't override them) invalidates that segment's preview and approval — it must be previewed and accepted again before it counts as ready.
- **Generate Final Video** is disabled until every segment is approved. It does not re-render anything — it concatenates the already-accepted per-segment clips (identical encode settings across segments, so this is a lossless stream-copy join, not a re-encode).

### Inputs

- **Script** — one text box per segment. The narration for that segment.
- **Voice** — a project-wide default, chosen from a fixed list of Edge TTS voices (id, display name, language; voice data only — no code, UI, or logic of any kind is shared with any other project). Any segment may opt in to a different voice for itself via a per-segment checkbox + selector.
- **Music** — a project-wide default, one track chosen from the locally bundled tracks in `assets/shorts/music/`. The list is discovered dynamically at runtime (whatever `.mp3` files are in that folder), not hardcoded per file — dropping in a new track makes it selectable with no code change. Display names come from the file's embedded ID3 title when present, otherwise a name derived from the filename. Any segment may opt in to a different track for itself via a per-segment checkbox + selector.
- **Music Volume** — a single project-wide slider (0–100%), not overridable per segment. Narration stays fixed at 100% and is not user-adjustable. Music automatically ducks (roughly -18dB to -24dB below its base level) for the real, detected duration of speech in that segment's narration, and restores to its base level during actual silence gaps between sentences — not a flat reduction for the whole clip.
- **Overlay** — per segment, always (no global default/inherit — every segment picks its own). The entire visual canvas of that segment, not a decorative layer on top of other footage. Two source modes, chosen with a radio toggle:
  - **Built-in Library** — one of the small, fixed set of locally bundled backgrounds.
  - **Choose from my PC** — an image (PNG/JPG/JPEG/WEBP/GIF) or video (MP4/MOV/WEBM) picked from the user's own computer via a native file dialog. A GIF is decoded by ffmpeg as a (short) video stream, not a single frame, so it's looped with the same `-stream_loop -1` strategy as a video file, not the still-image `-loop 1` flag — internal detail only, it's still offered to the user as an image. The file is used directly from its original location and is never copied into the app. A preview is shown after picking, with a "Change Overlay" control to pick a different file. The dialog remembers the last folder used, stored locally (`shorts-overlay-folder.json` in the app's userData folder). This is a deliberate, intentional Version 1 scope addition — see Out of Scope below for what it does *not* include.

### Captions

Captions are generated automatically from the script and burned into the video. Timing is a heuristic (proportional to character count against the narration's measured duration), not real speech alignment — this keeps the tool dependency-free, at the cost of not matching natural pauses precisely. One fixed caption style in Version 1; no customization.

### Assets

Overlay backgrounds are original, locally bundled files generated with FFmpeg's own synthesis filters (`gradients`) specifically to avoid any licensing or redistribution question. Music tracks in `assets/shorts/music/` are a mix of the original FFmpeg-synthesized tracks (`sine`/`amix`) and additional locally bundled tracks the user has confirmed they own the rights to redistribute within this application. All assets live in `assets/shorts/`. Bundled system fonts (e.g. Arial) are referenced live from the OS at render time and are never copied into the project — font files are not redistributable.

### Export

Each segment's Preview renders that segment to a temporary file. Generate Final Video concatenates the accepted segments' temp files (lossless stream copy) into one temporary combined file, which is what gets previewed before committing. Export copies that combined temp file to the location the user chooses; nothing is re-rendered at export time. Vertical 1080×1920 only — no resolution choice, since Shorts are vertical by definition.

### Out of Scope (Shorts Creator V1)

See Version 1 Constraints for restrictions that apply globally.

Also do NOT implement, specific to this tool, in Version 1:

- AI-generated visuals or B-roll
- Script writing assistance (e.g. LLM-generated scripts)
- User-uploaded/custom music (selection is limited to the bundled `assets/shorts/music/` library)
- Per-track volume/ducking tuning controls beyond the single Music Volume slider (duck amount and detection thresholds are fixed internals, not user-facing settings)
- Multiple simultaneous overlays, decorative overlays layered on top of the background (logos, stickers, brand kits), overlay editing/cropping/positioning controls, or copying the picked file into the app — a custom overlay is a single full-canvas background used directly from its original location (see Inputs above for what *is* in scope: picking one from the user's PC)
- Caption styling customization (fonts, colors, position, animation)
- Voice cloning, voice style/emotion controls
- Multiple aspect ratios, batch generation, templates
- Any dependency on an existing recorded or opened video
- Reordering/drag-and-drop of segments, duplicating a segment, or exporting a single segment on its own (segments are added below a given position, removed, previewed, and accepted — that's the full set of segment operations in V1)
- Transitions or crossfades between segments (segments are concatenated back-to-back; see the global no-transitions constraint)

---

## Module Architecture

The application stays modular forever. Every module — built or planned — follows the same shape:

- Its own logic folder at `src/<module>/` (ffmpeg pipelines, data, business logic — plain Node, no Electron/DOM APIs).
- Its own IPC file at `src/main/ipc/<module>.ipc.js`, registered in `src/main/main.js`.
- Its own `contextBridge` namespace in `src/main/preload.js` (e.g. `recorderAPI`, `snipAPI`, `shortsAPI`).
- Its own renderer flow at `src/renderer/flows/<module>-flow.js` (a self-contained state machine, mounted into the shared `#app` container) plus any module-specific components under `src/renderer/components/`.

No module imports another module's internals. The only shared code lives in `src/shared/` (small, generic utilities and the module registry below) — modules never reach into each other's `src/<module>/` folders, IPC files, or flows.

The Recorder module is the one naming exception: its logic predates this convention and is split across `src/recording/` (capture), `src/editor/` (trim metadata), and `src/export/` (ffmpeg encode) instead of a single `src/recorder/` folder. This is historical, the three folders are still fully isolated from every other module, and it is not being renamed (see: do not rewrite existing modules). Every module built from here on (Snip, Shorts, and future modules) uses a single `src/<module>/` folder.

### The module registry

`src/shared/module-registry.js` exports `MODULE_REGISTRY`, an array that is the single source of truth for the Home Screen. Each entry has:

- `id` — stable key, matched against a flow-starter in `src/renderer/app.js`.
- `title`, `tag`, `description`, `icon`, `accent` — card content.
- `enabled` — whether the card is clickable.
- `comingSoon` — whether the card shows a "Coming Soon" badge.

`src/renderer/components/home-menu/home-menu.js` is purely presentational — it renders whatever `workflows` array it's handed and knows nothing about specific modules. `src/renderer/app.js` builds that array from `MODULE_REGISTRY`, mapping each `id` to a starter function in its `FLOW_STARTERS` map. A registry entry with no matching starter (every planned-but-unbuilt module today) simply renders disabled — there is no error, no special-casing.

### Adding a future module

1. Build `src/<module>/` (logic), `src/main/ipc/<module>.ipc.js` (register it in `main.js`), a `<module>API` namespace in `preload.js`, and `src/renderer/flows/<module>-flow.js` plus its components — exactly like Snip or Shorts.
2. In `src/shared/module-registry.js`, flip that module's `enabled: true` and `comingSoon: false`.
3. In `src/renderer/app.js`, add one entry to `FLOW_STARTERS` mapping the module's `id` to a function that mounts its flow.

Nothing else changes. The Home Screen needs no edits — it already renders every registry entry.

---

## Project Structure

```
demo-recorder/
├── package.json
├── CLAUDE.md
├── src/
│   ├── main/                  # Electron main process
│   │   ├── main.js            # app lifecycle, single BrowserWindow
│   │   ├── preload.js         # contextBridge-exposed API only
│   │   └── ipc/
│   │       ├── recording.ipc.js
│   │       ├── export.ipc.js
│   │       ├── snip.ipc.js    # open-file, save-as, cut (trim + crop + remove segments)
│   │       └── shorts.ipc.js  # get-options, generate, export
│   ├── renderer/               # UI (plain HTML/CSS/JS, single window)
│   │   ├── index.html
│   │   ├── app.js              # thin router: builds Home Screen cards from MODULE_REGISTRY, maps enabled ids to flow starters
│   │   ├── styles/
│   │   ├── flows/
│   │   │   ├── record-flow.js  # Screen Recorder state machine
│   │   │   ├── snip-flow.js    # Video Snipping Tool state machine
│   │   │   └── shorts-flow.js  # Shorts Creator state machine
│   │   │   # future: spots-flow.js, copywriter-flow.js, brand-flow.js, social-flow.js -- not created yet
│   │   └── components/
│   │       ├── home-menu/
│   │       ├── recorder-controls/
│   │       ├── window-picker/
│   │       ├── preview-player/
│   │       ├── editor-timeline/
│   │       ├── snip-timeline/               # Time Trim draggable range bar
│   │       ├── crop-selector/               # Video Crop resizable rectangle
│   │       └── remove-segments-timeline/    # Multi Segment Remove: red overlay segments
│   ├── recording/               # desktopCapturer + mic capture logic
│   ├── editor/                  # Screen Recorder trim metadata logic
│   ├── export/                  # Screen Recorder ffmpeg fit/pad/encode pipeline
│   ├── snip/                    # Video Snipping Tool ffmpeg logic
│   │   ├── run-ffmpeg.js        # shared spawn helper + audio-stream probing
│   │   ├── cut.js               # Time Trim: stream-copy first, auto re-encode fallback
│   │   ├── crop.js              # Video Crop: ffmpeg crop filter
│   │   ├── remove-segments.js   # Multi Segment Remove: ripple-delete keep-range math
│   │   └── process.js           # orchestrator: combines trim + crop + remove segments
│   ├── shorts/                  # Shorts Creator logic (fully isolated, own ffmpeg spawn wrapper)
│   │   ├── run-ffmpeg.js        # own copy -- not shared with snip/ or export/, by design; also ID3 title + silence probing
│   │   ├── voices.js            # plain voice data (id/name/language) -- data only, no shared code
│   │   ├── assets.js            # built-in overlay registry + dynamic music-folder scan
│   │   ├── overlay-folder-store.js # remembers the last folder used for a custom (from-PC) overlay
│   │   ├── synthesize-speech.js # Edge TTS wrapper (msedge-tts)
│   │   ├── caption-timing.js    # heuristic caption cue timing
│   │   ├── wrap-text.js         # caption line-wrapping
│   │   └── render.js            # renderShort: one segment -> one MP4 (TTS + captions + overlay + ducked music); concatenateSegments: joins accepted segment clips (stream copy) -> final MP4
│   │   # future modules (not created yet): spots/, copywriter/, brand/, social/ -- same isolation pattern as snip/ and shorts/
│   └── shared/                  # constants, small utils shared across flows
│       └── module-registry.js   # Home Screen data source -- see Module Architecture
├── assets/
│   └── shorts/                  # see Shorts Creator section
│       ├── music/                 # bundled tracks, loaded dynamically (ffmpeg-synthesized + user-licensed)
│       └── overlays/              # 3 original animated backgrounds (ffmpeg-synthesized)
└── output/                      # exported MP4s (gitignored)
```

`contextIsolation: true` and `nodeIntegration: false` are required. The renderer never accesses Node or Electron APIs directly — only through `preload.js`.

---

## Version 1 Scope

Must work like this:

1.

Open application.

2.

Select an application window.

3.

Click Start Recording.

4.

Record screen (Pause available).

5.

Click Stop.

6.

Preview video.

7.

Cut unwanted parts.

8.

Export MP4.

Nothing else.

---

## Version 1 Constraints

Keep Version 1 extremely simple.

No AI, except Shorts Creator's text-to-speech (Edge TTS) — used narrowly for narration, not for generating scripts, visuals, or any other content.

No automation.

No transitions.

No visual effects.

No subtitles, except Shorts Creator's auto-generated burned-in captions, which are core to that tool, not a general subtitle feature applied elsewhere.

No captions, with the same Shorts Creator exception as above. The Screen Recorder and Video Snipping Tool have no captions or subtitles of any kind.

---

## Version 1 Success Criteria

### Screen Recorder

The Screen Recorder is considered complete when a user can:

1. Open the application.
2. Select any application window.
3. Record.
4. Pause.
5. Stop.
6. Preview.
7. Trim.
8. Export to MP4.

Nothing more.

### Video Snipping Tool

The Video Snipping Tool is considered complete when a user can:

1. Open an existing video file.
2. Select a start time and an end time (Time Trim).
3. Draw and adjust a crop rectangle over the video preview (Video Crop).
4. Mark multiple unwanted portions for removal on the timeline (Multi Segment Remove), with Undo/Redo, timeline zoom, and frame stepping.
5. Preview the final result, including skipped removed portions, before exporting.
6. Apply any combination of Trim, Crop, and Remove Segments together.
7. Export a new MP4 containing only the selected time range, region, and remaining segments after ripple delete.

Nothing more.

### Shorts Creator

The Shorts Creator is considered complete when a user can:

1. Start a project with one segment, write its script, choose its overlay (built-in or from their PC), and optionally override the default voice/music for that segment.
2. Preview that one segment, narrated with Edge TTS, captioned, scored with music (auto-ducked under narration), over its overlay — and Accept it, or change something and preview again.
3. Add more segments as needed, each with its own script/overlay/optional voice-music override, repeating the preview → accept cycle for each.
4. Generate the Final Video once every segment is accepted, combining them into one MP4.
5. Preview the combined result before exporting.
6. Export a new vertical MP4.

Nothing more.

---

## Future Versions

V2

Mouse highlight.

Zoom.

Blur.

V3

Automatic camera movement.

V4

Shorts Creator V2: music/overlay libraries, caption styling, voice controls, more music/overlay choices (see Shorts Creator's Out of Scope list).

Note: a Lite version of Shorts Creator (script + Edge TTS + one bundled music track + one bundled overlay + auto-captions) shipped in Version 1, not V4 as originally planned here. The full AI-powered Shorts generator (AI-generated visuals, script assistance) remains a separate, unrelated application and is not on this project's roadmap.

---

## Rules

Never add features outside the current version.

Keep the code simple.

Keep the architecture modular.

Every feature must be isolated.

Do not optimize for future features until they are requested.

Always produce production-quality code.

No placeholders.

No fake implementations.

Every module gets its own folder — never let one module import another module's internals (see Module Architecture).

New modules on the Home Screen are added by editing `src/shared/module-registry.js`, never by hand-editing card markup — see Module Architecture for the exact steps.

Do not build a planned module (Spot Creator, AI Copywriter, Brand Kit, Social Export) until it is explicitly requested — until then it stays a disabled "Coming Soon" entry in the registry.