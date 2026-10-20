# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A p5.js (WEBGL) tool that applies Floyd-Steinberg error-diffusion dithering to either a generated 3D scene (triangle mesh + circles) or a user-loaded image. The result can be saved as PNG or SVG. User-facing documentation is in README.md (Japanese).

## Architecture

### Files

- **index.html**: Page, panel CSS. Loads `lib/p5.min.js`, `lib/lib.js`, and `lib/index.js` (ES module) in that order.
- **lib/index.js**: Main logic. p5 `setup`/`draw`, control panel (`createDebugSliders`), scene rendering (`drawImage`, `drawWavePlane`), image loading, and the dithering pipeline (`processImage`).
- **lib/lib.js**: Classic script exposing `window.saveCanvasPng` and `window.saveDitheredSvg` (called from panel buttons).
- **lib/floyd-steinberg-module.js**: `FloydSteinbergProcessor`. Sends pixels to the worker (falls back to synchronous processing).
- **lib/dithering-worker.js**: Web Worker running the dithering loop. Imported by path `lib/dithering-worker.js` (relative to the page).
- **lib/dithering-presets.js**: Presets imported by the module (not used by `index.js`, but the import must stay).
- **shaders/graphic.vert, graphic.frag**: Shade the scene by depth. Only used for the scene, not for loaded images.

### Pipeline

```
source (scene in myBuffer + shader | loaded image texture)
  -> get() canvas, copy downscaled into sourceImage (size = canvas * resolution slider)
  -> optional color offsets (image mode) and Mono (grayscale) on sourceImage
  -> worker dithering (per-channel threshold + error diffusion)
  -> processedImage drawn on a plane with NEAREST filtering
```

### Things to know before editing

- The sketch uses `noLoop()`. The loop is driven by `processImage()` calling `redraw()` when the worker finishes. When Dithering is off, `draw()` schedules its own `requestAnimationFrame` redraw.
- NEAREST filtering is set through p5 internals: `p5.instance._renderer.getTexture(img).setInterpolation(NEAREST, NEAREST)`. p5 is pinned to 2.0.5 in `lib/`; re-check this if p5 is upgraded. `noSmooth()` does not affect texture filtering in WEBGL.
- Canvas ID must be `artCanvas` (used by PNG save). Canvas size is 630x891 in scene mode and follows the loaded image in image mode (long side capped at `MAX_SIDE` = 4096).
- `saveDitheredSvg` reproduces the on-screen NEAREST cell edges (`ceil(i * out / src - 0.5)`) so the SVG matches the canvas pixel for pixel, including uneven cell widths when the scale is not an integer.
- Dithering is per channel (R, G, B independent) unless ColorModeChange (colorMode 4) is on, which rotates channels each time error is added. Mono works by converting `sourceImage` to gray before dithering; the worker is unchanged.
- The worker ignores alpha. Transparent image areas are composited on a white background before dithering.
- Scene-only and image-only sliders live in `sceneBox` / `imageBox` and are shown/hidden when an image is loaded or cleared.
- The `d` key only toggles panel visibility. Slider values are read every frame.

## Development Commands

- `npm run dev` - live-server with hot reload (port 8080)
- `npm run dev:sync` - browser-sync with file watching
- `npm start` - Python HTTP server (port 8000)

All commands use npx, so no dependencies need to be installed.

## Development Process

### Browser-Based Error Checking
1. Run `npm run dev`.
2. Open DevTools Console in the browser.
3. After each change, check the Console for errors and fix them one at a time.

Never commit code that logs console errors.

### Common p5.js 2.x Notes
- File/asset loading is async: `await loadStrings(...)`, `await loadImage(...)`.
- Verify argument order of p5 functions against the 2.x docs.
- WEBGL mode must be initialized before using 3D features.
