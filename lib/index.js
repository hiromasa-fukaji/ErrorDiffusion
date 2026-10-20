import { FloydSteinbergProcessor } from './floyd-steinberg-module.js';

/**
 *  Debug mode
 */
let debugMode = true;
let sliderContainer;
let sliderA, sliderB, sliderC, sliderD, sliderE, sliderF;
let checkboxCircles;
let showCircles = true;
let checkboxDither;
let ditherEnabled = true;
let sliderMeshDetail, sliderMeshNoise, sliderMeshHeight;
let sliderR, sliderBl;
let bgRed = 15;
let bgBlue = 17;
let meshDetail = 100;
let meshNoiseScale = 0.005;
let meshWaveHeight = 1000;
let redrawScheduled = false;

/**
 *  Query parameters
 */
const urlParams = new URLSearchParams(window.location.search);
let param_A = map_range(Math.max(Math.min(parseFloat(urlParams.get("a")) || 0.0, 1.0), 0.0), 0.0, 1.0, 15, 255);  //15, 255, 15
let param_B = map_range(Math.max(Math.min(parseFloat(urlParams.get("b")) || 0.0, 1.0), 1.0), 0.0, 1.0, 0.07, 0.67); // 0.4, 0.9, 0.66
let param_C = map_range(Math.max(Math.min(parseFloat(urlParams.get("c")) || 0.0, 1.0), 0.0), 0.0, 1.0, 3, 255); // 3, 15, 3
let param_D = map_range(Math.max(Math.min(parseFloat(urlParams.get("d")) || 0.0, 1.0), 0.0), 0.0, 1.0, 1, 100); // 1, 100, 1
let param_E = urlParams.get("e") === "true" ? 4 : 0;
let param_F = map_range(Math.max(Math.min(parseFloat(urlParams.get("f")) || 0.0, 1.0), 0.0), 0.0, 1.0, 1, 100);

window.onMonosParamsChanged = (data) => {
  param_A = map_range(Math.max(Math.min(data.param_A, 1.0), 0.0), 0.0, 1.0, 15, 255);
  param_B = map_range(Math.max(Math.min(data.param_B, 1.0), 0.0), 0.0, 1.0, 0.07, 0.67);
  param_C = map_range(Math.max(Math.min(data.param_C, 1.0), 0.0), 0.0, 1.0, 3, 15);
  param_D = map_range(Math.max(Math.min(data.param_D, 1.0), 0.0), 0.0, 1.0, 1, 100);
  param_E = data.param_E === true ? 4 : 0;
};

/**
 *  Artwork
 */
let graphicShader;
let vertSrc, fragSrc;
let myBuffer;
let cam;
const CANVAS_W = 630;
const CANVAS_H = 891;
let near = 10;
let far = 2000;
let processor;
let sourceImage;
let processedImage;
let nearestApplied = null; // NEAREST補間を設定済みの画像
let isProcessing = false;
let processFrameCount = 0; // フレームカウンター
let lastSettingsKey = null; // 設定の変更を検出
let colors = [];
let currentSettings = {
  weights: [7/16, 3/16, 5/16, 1/16], //[0.05, 0.15, 0.3, 0.05]

};

function map_range(value, low1, high1, low2, high2) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}


window.setup = async () => {
  try {
    console.log('Loading shader files and font...');
    vertSrc = await loadStrings('shaders/graphic.vert');
    fragSrc = await loadStrings('shaders/graphic.frag');
  } catch (error) {
    console.error('Error loading files:', error);
  }
  const cnv = createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  cnv.id('artCanvas');
  colors = [color(255, 255, 0), color(0, 0,150)];
  // Initialize dithering processor
  processor = new FloydSteinbergProcessor({
    useWebWorker: true,
    workerPath: 'lib/dithering-worker.js'
  });
  
  myBuffer = createFramebuffer();

  // Create shader from loaded files or fallback to embedded
  const vertSource = vertSrc.join('\n');
  const fragSource = fragSrc.join('\n');
  graphicShader = createShader(vertSource, fragSource);

  cam = createCamera();
  ortho(-width / 2, width / 2, -height / 2, height / 2, near, far);
  setCamera(cam);

  // Create slider container
  sliderContainer = createDiv('');
  sliderContainer.id('sliderContainer');

  // Create sliders
  createDebugSliders();
  sliderContainer.addClass('active');

  // Create text geometries only if font is loaded
  
  textureMode(IMAGE);

  noLoop(); 
};



window.keyPressed = function() {
  // Toggle debug mode with 'd' key
  if (key === 'd' || key === 'D') {
    debugMode = !debugMode;

    if (debugMode) {
      sliderContainer.addClass('active');
      console.log('Debug mode: ON - Using sliders');
    } else {
      sliderContainer.removeClass('active');
      console.log('Debug mode: OFF - Using URL parameters');
    }
  }
}


window.draw = () => {
  pixelDensity(1);
  
  if (debugMode) {
    // Use slider values
    param_A = sliderA.value();
    param_B = sliderB.value();
    param_C = sliderC.value();
    param_D = sliderD.value();
    param_F = sliderF.value();
    bgRed = sliderR.value();
    bgBlue = sliderBl.value();
    meshDetail = sliderMeshDetail.value();
    meshNoiseScale = sliderMeshNoise.value();
    meshWaveHeight = sliderMeshHeight.value();
    param_E = sliderE.checked() ? 4 : 0;
    showCircles = checkboxCircles.checked();
    ditherEnabled = checkboxDither.checked();
  }

  currentSettings.threshold = param_C;
  currentSettings.colorMode = param_E;

  drawImage();

  noStroke();
  graphicShader.setUniform('depth', myBuffer.depth);
  graphicShader.setUniform('color', myBuffer.color);
  graphicShader.setUniform('width', width);
  graphicShader.setUniform('height', height);
  shader(graphicShader);
  plane(width, height);

  if (!ditherEnabled) {
    // 毎フレーム再描画を続ける(ループは Worker 完了で駆動していたため)
    if (!redrawScheduled) {
      redrawScheduled = true;
      requestAnimationFrame(() => { redrawScheduled = false; redraw(); });
    }
    return;
  }

  if(sourceImage == null || (sourceImage.width !== Math.max(ceil(CANVAS_W * param_B), 1) || sourceImage.height !== Math.max(ceil(CANVAS_H * param_B),1))) {
    sourceImage = createImage(Math.max(ceil(CANVAS_W * param_B),1), Math.max(ceil(CANVAS_H * param_B),1));
  }
  // 現在の画面をsourceImageにコピー
  if (sourceImage && 
      sourceImage.width > 0 && 
      sourceImage.height > 0 &&
      typeof sourceImage.copy === 'function') {
    sourceImage.copy(get(), 0, 0, width, height, 0, 0, sourceImage.width, sourceImage.height);
  
    if (sourceImage && !isProcessing){
      processImage();
    }
  }

  // if (true) {
  if (processedImage) {
    resetShader();

    texture(processedImage);
    // ドットの境目を補間しない(初回と画像の作り直しのときだけ設定)
    if (nearestApplied !== processedImage) {
      p5.instance._renderer.getTexture(processedImage).setInterpolation(NEAREST, NEAREST);
      nearestApplied = processedImage;
    }
    plane(width, height);
  } else if (sourceImage) {
    print('sourceImage');
    // Display original image
    resetShader();
    // sourceImage.resize(width, height);
    texture(sourceImage);
    plane(width, height);
  }
};

window.drawImage = () => {
  myBuffer.begin();
  randomSeed(param_F);
  noiseSeed(param_D);

  // Framebuffer用のカメラをorthographicに設定
  ortho(-width / 2, width / 2, -height / 2, height / 2, near, far);

  resetShader(); // デフォルトシェーダーに戻す
  clear(); // Frame bufferをクリア
  background(255,100,100);

  push(); // 状態を保存

  // ライティングを有効化
  lights();

  fill(bgRed, param_A, bgBlue);
  noStroke(0);
  drawWavePlane(width, height, meshDetail, meshNoiseScale, meshWaveHeight);

  // === ランダムな2D円を描画 ===
  noStroke();

  let count = 22;     // 円の数
  let radius = 50;     // 円の大きさ

  if (showCircles) {
    for (let i = 0; i < count; i++) {
      // 毎フレーム位置と色をランダム生成
      let x = random(-CANVAS_W / 2, CANVAS_W / 2);
      let y = random(-CANVAS_H / 2, CANVAS_H / 2);
      let col = random(colors);

      fill(col);
      ellipse(x, y, radius, radius);
    }
  }

  pop();
  myBuffer.end();
};


// Wave plane function with triangular tiling
function drawWavePlane(planeWidth, planeHeight, detail, noiseScale, waveHeight) {
  const aspect = planeWidth / planeHeight;

  // 正三角形タイリングのための調整
  const yStep = planeHeight / detail * Math.sqrt(3) / 2; // 正三角形の高さ
  const xStep = yStep / Math.sqrt(3) * 2; // 正三角形の幅（高さから計算）

  const rows = Math.ceil(planeHeight / yStep) + 2; // 余分に行を追加
  const cols = Math.ceil(planeWidth / xStep) + 2; // 余分に列を追加

  const halfW = planeWidth / 2;
  const halfH = planeHeight / 2;

  beginShape(TRIANGLES);

  
  for (let y = -1; y <= rows; y++) {
    for (let x = -1; x <= cols; x++) {
      // 奇数行は半分ずらす（六角形グリッド）
      const xOffset = (y % 2) * xStep * 0.5;

      const xPos = -halfW - xStep + x * xStep + xOffset;
      const yPos = -halfH - yStep + y * yStep;

      // 隣接する頂点の座標
      const xPosRight = xPos + xStep;
      const xPosHalfRight = xPos + xStep * 0.5;
      const xPosHalfLeft = xPos - xStep * 0.5;

      const yPosDown = yPos + yStep;
      const yPosUp = yPos - yStep;

      // 各頂点のZ座標（ノイズベースの高さ）を計算
      let zCenter = -noise(
       (xPos + halfW) * noiseScale, // ← 横方向に動かす
       (yPos + halfH) * noiseScale,
       0
      ) * waveHeight;

      let zRight = -noise(
        (xPosRight + halfW) * noiseScale,
        (yPos + halfH) * noiseScale,
        0
      ) * waveHeight;

      let zDownRight = -noise(
        (xPosHalfRight + halfW) * noiseScale,
        (yPosDown + halfH) * noiseScale,
        0
      ) * waveHeight;

      let zDownLeft = -noise(
        (xPosHalfLeft + halfW) * noiseScale,
        (yPosDown + halfH) * noiseScale,
        0
      ) * waveHeight;

      // 上向き三角形
      if (x < cols && y < rows) {
        vertex(xPos, yPos, zCenter);
        vertex(xPosRight, yPos, zRight);
        vertex(xPosHalfRight, yPosDown, zDownRight);
      }

      // 下向き三角形
      if (x >= 0 && y < rows) {
        vertex(xPos, yPos, zCenter);
        vertex(xPosHalfRight, yPosDown, zDownRight);
        vertex(xPosHalfLeft, yPosDown, zDownLeft);
      }
    }
  }

  endShape();
}

function createDebugSliders() {
  const addSlider = (label, min, max, value, step, digits) => {
    const div = createDiv('');
    div.parent(sliderContainer);
    createElement('label', label).parent(div);
    const slider = createSlider(min, max, value, step);
    slider.parent(div);
    slider.style('width', '150px');
    const span = createSpan(value.toFixed(digits));
    span.parent(div);
    slider.input(() => {
      span.html(slider.value().toFixed(digits));
    });
    return slider;
  };

  // Slider R
  sliderR = addSlider('赤成分:', 0, 255, bgRed, 1, 0);

  // Slider A
  const divA = createDiv('');
  divA.parent(sliderContainer);
  const labelA = createElement('label', '緑成分:');
  labelA.parent(divA);
  sliderA = createSlider(15, 255, param_A, 1);
  sliderA.parent(divA);
  sliderA.style('width', '150px');
  const spanA = createSpan(param_A.toFixed(0));
  spanA.parent(divA);
  spanA.id('valueA');

  // Update slider values on change
  sliderA.input(() => {
    document.getElementById('valueA').textContent = sliderA.value().toFixed(0);
  });

  // Slider Bl
  sliderBl = addSlider('青成分:', 0, 255, bgBlue, 1, 0);

  // Slider B
  const divB = createDiv('');
  divB.parent(sliderContainer);
  const labelB = createElement('label', '解像度:');
  labelB.parent(divB);
  sliderB = createSlider(0.07, 0.67, param_B, 0.01);
  sliderB.parent(divB);
  sliderB.style('width', '150px');
  const spanB = createSpan(param_B.toFixed(2));
  spanB.parent(divB);
  spanB.id('valueB');

  // Update slider values on change
  sliderB.input(() => {
    document.getElementById('valueB').textContent = sliderB.value().toFixed(2);
  });
  
  // Slider C
  const divC = createDiv('');
  divC.parent(sliderContainer);
  const labelC = createElement('label', '閾値:');
  labelC.parent(divC);
  sliderC = createSlider(3, 255, param_C, 1);
  sliderC.parent(divC);
  sliderC.style('width', '150px');
  const spanC = createSpan(param_C.toFixed(0));
  spanC.parent(divC);
  spanC.id('valueC');

  // Update slider values on change
  sliderC.input(() => {
    document.getElementById('valueC').textContent = sliderC.value().toFixed(0);
  });


  // Slider F (circle seed)
  const divF = createDiv('');
  divF.parent(sliderContainer);
  const labelF = createElement('label', '円seed:');
  labelF.parent(divF);
  sliderF = createSlider(1, 100, param_F, 1);
  sliderF.parent(divF);
  sliderF.style('width', '150px');
  const spanF = createSpan(param_F.toFixed(0));
  spanF.parent(divF);
  spanF.id('valueF');

  // Update slider values on change
  sliderF.input(() => {
    document.getElementById('valueF').textContent = sliderF.value().toFixed(0);
  });

  // Slider D
  const divD = createDiv('');
  divD.parent(sliderContainer);
  const labelD = createElement('label', 'meshseed:');
  labelD.parent(divD);
  sliderD = createSlider(1, 100, param_D, 1);
  sliderD.parent(divD);
  sliderD.style('width', '150px');
  const spanD = createSpan(param_D.toFixed(0));
  spanD.parent(divD);
  spanD.id('valueD');

  // Update slider values on change
  sliderD.input(() => {
    document.getElementById('valueD').textContent = sliderD.value().toFixed(0);
  });

  // Mesh sliders
  sliderMeshDetail = addSlider('分割数:', 10, 200, meshDetail, 1, 0);
  sliderMeshNoise = addSlider('ノイズ密度:', 0.001, 0.02, meshNoiseScale, 0.001, 3);
  sliderMeshHeight = addSlider('高低差:', 0, 1000, meshWaveHeight, 10, 0);

  // Slider E (checkbox style)
  const divE = createDiv('');
  divE.parent(sliderContainer);

  // param_E が 0 のとき → チェックON, param_E が 4 のとき → チェックOFF
  sliderE = createCheckbox('ColorModeChange', param_E === 4);
  sliderE.parent(divE);

  // Circles toggle
  const divCircles = createDiv('');
  divCircles.parent(sliderContainer);
  checkboxCircles = createCheckbox('Circles', true);
  checkboxCircles.parent(divCircles);

  // Dithering toggle
  const divDither = createDiv('');
  divDither.parent(sliderContainer);
  checkboxDither = createCheckbox('Dithering', true);
  checkboxDither.parent(divDither);

  // Save buttons
  const divSave = createDiv('');
  divSave.parent(sliderContainer);
  createButton('Save PNG').parent(divSave).mousePressed(() => window.saveCanvasPng());
  createButton('Save SVG').parent(divSave).mousePressed(() => {
    if (!ditherEnabled || !processedImage) {
      alert('ディザリングをオンにしてください');
      return;
    }
    window.saveDitheredSvg(processedImage.pixels, processedImage.width, processedImage.height, CANVAS_W, CANVAS_H);
  });
}

function applyPreset(presetName) {
  if (!preset) {
    console.error(`Preset ${presetName} not found`);
    return;
  }

  console.log(`Applying preset: ${preset.name}`);

  // Update slider values
  //sliderE.value(preset.colorMode);

  // Update param values
  //param_E = preset.colorMode;

  // Update display values
  document.getElementById('valueE').textContent = param_E_toFixed(0);
}

async function processImage() {
  if (!sourceImage || isProcessing) {
    return;
  }

  try {
      isProcessing = true;
      // 初回またはサイズ変更時のみ新規作成
      if ((!processedImage ||
          processedImage.width !== sourceImage.width ||
          processedImage.height !== sourceImage.height)) {
        
        // console.log(`Creating new processedImage: ${sourceImage.width}x${sourceImage.height}`);
        processedImage = createImage(sourceImage.width, sourceImage.height);
        processedImage.loadPixels();
      }

      // 処理結果を取得
      const result = await processor.processImage(sourceImage, currentSettings);

      // 既存オブジェクトのpixels配列のみ更新
      processedImage.pixels.set(result.pixels);
      processedImage.updatePixels();
      // console.log('Reused existing processedImage, updated pixels only');
      processFrameCount++;
  } catch (error) {
      console.error('Processing error:', error);
      // processedImage オブジェクトは保持し続ける
  } finally {
      redraw(); 
      isProcessing = false;
      
  }
}