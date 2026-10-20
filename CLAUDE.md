# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a generative artwork template using p5.js with WEBGL renderer. The artwork accepts URL query parameters to control various visual aspects and supports saving the canvas as an image.

## Architecture

### Core Components

- **index.html**: Main HTML file that loads p5.js from CDN and includes the canvas element
- **index.js**: Main artwork logic with p5.js setup and draw functions, handles query parameters
- **lib.js**: Utility functions for saving canvas as image (triggered by 's' key)

### Query Parameter System

The artwork accepts 5 URL parameters (a, b, c, d, e) that control:
- `a` (0.1-1.0): Background hue multiplier
- `b` (0.1-1.0): Fill hue multiplier
- `c` (0.1-1.0): Stroke weight multiplier
- `d` (0.1-1.0): Shape size multiplier
- `e` (boolean): Toggle between box (true) and cylinder (false)

Example: `index.html?a=0.1&b=0.1&c=0.9&d=0.5&e=true`

## Development Commands

### Local Development Server
- `npm run dev` - Start live-server with hot reload (port 8080)
- `npm run dev:sync` - Start browser-sync with file watching and multi-device sync
- `npm start` - Start Python HTTP server without hot reload (port 8000)

Note: All commands use npx, so no dependencies need to be installed.

### Other Commands
- Press 's' key to save the current canvas as PNG image

## Development Process

### Browser-Based Error Checking
When developing with p5.js, always follow this iterative testing process:

1. **Start Development Server**: Run `npm run dev` to start live-server
2. **Open Browser DevTools**: Press F12 and navigate to Console tab
3. **Make Code Changes**: Edit files in your code editor
4. **Check Browser Immediately**: Live-server auto-reloads, check Console for errors
5. **Fix Errors Incrementally**: Address one error at a time, test after each fix
6. **Repeat Until Clean**: Continue until no errors appear in Console

### Error Checking Workflow
```
Code Change → Browser Auto-Reload → Check Console → Fix Errors → Repeat
```

### Common p5.js 2.x Issues to Watch For
- **Async/Await**: File loading requires `await` in `async function preload()`
- **Function Arguments**: Verify correct parameter order (e.g., `textToModel(str, x, y, width, height, options)`)
- **Shader Loading**: Use fallback embedded shaders if `loadStrings()` fails
- **WebGL Context**: Ensure WEBGL mode is properly initialized before using 3D features

### Best Practices
- Never commit code with console errors
- Test each feature incrementally
- Use console.log() for debugging during development
- Keep browser DevTools open during development sessions

## Key Technical Details

- Uses p5.js v2.0.5 loaded locally from lib/p5.min.js
- WEBGL renderer for 3D graphics
- Canvas ID must be `artCanvas` for save functionality
- HSB color mode for color calculations
- Automatic canvas resizing on window resize
- 3D text rendering using textToModel() function