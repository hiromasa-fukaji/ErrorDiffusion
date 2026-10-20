/**
 *  Download helper
 */
const downloadFile = (href, filename) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 *  Save canvas tag as PNG image
 */
window.saveCanvasPng = () => {
  const canvas = document.getElementById('artCanvas');
  if (!canvas) {
    return;
  }
  downloadFile(canvas.toDataURL('image/png'), `monos_${new Date().getTime()}.png`);
};

/**
 *  Save dithered pixels as SVG
 *  Horizontal runs of the same color are merged, and each color becomes one <path>.
 *  Cell edges follow the NEAREST sampling used on screen, so the SVG matches the canvas
 *  (outWidth x outHeight) pixel for pixel, including uneven cell sizes.
 */
window.saveDitheredSvg = (pixels, width, height, outWidth, outHeight) => {
  const paths = new Map();

  // Canvas-pixel boundaries of each source column/row
  const xEdges = Array.from({ length: width + 1 }, (_, i) => Math.max(0, Math.ceil(i * outWidth / width - 0.5)));
  const yEdges = Array.from({ length: height + 1 }, (_, i) => Math.max(0, Math.ceil(i * outHeight / height - 0.5)));

  for (let y = 0; y < height; y++) {
    const cellH = yEdges[y + 1] - yEdges[y];
    if (cellH <= 0) {
      continue;
    }
    let x = 0;
    while (x < width) {
      const i = (x + y * width) * 4;
      if (pixels[i + 3] < 128) {
        x++;
        continue;
      }
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      let end = x + 1;
      while (end < width) {
        const j = (end + y * width) * 4;
        if (pixels[j + 3] < 128 || pixels[j] !== r || pixels[j + 1] !== g || pixels[j + 2] !== b) {
          break;
        }
        end++;
      }
      const key = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      const cellW = xEdges[end] - xEdges[x];
      if (cellW > 0) {
        paths.set(key, (paths.get(key) || '') + `M${xEdges[x]} ${yEdges[y]}h${cellW}v${cellH}h-${cellW}z`);
      }
      x = end;
    }
  }

  let body = '';
  for (const [key, d] of paths) {
    body += `<path fill="#${key}" d="${d}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}" shape-rendering="crispEdges">${body}</svg>`;

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  downloadFile(url, `monos_${new Date().getTime()}.svg`);
  URL.revokeObjectURL(url);
};
