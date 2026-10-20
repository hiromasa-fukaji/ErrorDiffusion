import { FloydSteinbergProcessor } from './floyd-steinberg-module.js';

/**
 *  Control panel
 */
let panelVisible = true;
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
let checkboxMono;
let monoEnabled = false;
let savedThreshold = null;
let sceneBox;
let imageBox;
let sliderImgR, sliderImgG, sliderImgB;
let userImage = null; // 読み込んだ画像(nullならメッシュと円のシーン)

/**
 *  Initial values
 */
let param_A = 15;   // 背景の緑成分
let param_B = 0.67; // 解像度
let param_C = 3;    // 閾値
let param_D = 1;    // meshseed
let param_E = 0;    // 色チャンネル入れ替え (0: オフ, 4: オン)
let param_F = 1;    // 円seed

/**
 *  Artwork
 */
let graphicShader;
let vertSrc, fragSrc;
let myBuffer;
let cam;
const INITIAL_W = 630;
const INITIAL_H = 891;
const MAX_SIDE = 4096; // 画像は原寸で読み込む。長辺がこれを超える場合のみ縮小する
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

window.setup = async () => {
  try {
    console.log('Loading shader files and font...');
    vertSrc = await loadStrings('shaders/graphic.vert');
    fragSrc = await loadStrings('shaders/graphic.frag');
  } catch (error) {
    console.error('Error loading files:', error);
  }
  const cnv = createCanvas(INITIAL_W, INITIAL_H, WEBGL);
  cnv.id('artCanvas');
  cnv.drop(handleFile);
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
  // Toggle control panel with 'd' key
  if (key === 'd' || key === 'D') {
    panelVisible = !panelVisible;
    if (panelVisible) {
      sliderContainer.addClass('active');
    } else {
      sliderContainer.removeClass('active');
    }
  }
}


window.draw = () => {
  pixelDensity(1);
  
  // Read slider values
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
  monoEnabled = checkboxMono.checked();

  currentSettings.threshold = param_C;
  currentSettings.colorMode = param_E;

  if (userImage) {
    // 読み込んだ画像を白背景の上にそのまま描く(透明部分は白になる)
    resetShader();
    noStroke();
    background(255);
    texture(userImage);
    plane(width, height);
  } else {
    drawImage();

    noStroke();
    graphicShader.setUniform('depth', myBuffer.depth);
    graphicShader.setUniform('color', myBuffer.color);
    graphicShader.setUniform('width', width);
    graphicShader.setUniform('height', height);
    shader(graphicShader);
    plane(width, height);
  }

  if (!ditherEnabled) {
    // 毎フレーム再描画を続ける(ループは Worker 完了で駆動していたため)
    if (!redrawScheduled) {
      redrawScheduled = true;
      requestAnimationFrame(() => { redrawScheduled = false; redraw(); });
    }
    return;
  }

  if(sourceImage == null || (sourceImage.width !== Math.max(ceil(width * param_B), 1) || sourceImage.height !== Math.max(ceil(height * param_B),1))) {
    sourceImage = createImage(Math.max(ceil(width * param_B),1), Math.max(ceil(height * param_B),1));
  }
  // 現在の画面をsourceImageにコピー
  if (sourceImage && 
      sourceImage.width > 0 && 
      sourceImage.height > 0 &&
      typeof sourceImage.copy === 'function') {
    sourceImage.copy(get(), 0, 0, width, height, 0, 0, sourceImage.width, sourceImage.height);

    // 画像モードの色の足し引き(0なら変化なし)
    const offR = userImage ? sliderImgR.value() : 0;
    const offG = userImage ? sliderImgG.value() : 0;
    const offB = userImage ? sliderImgB.value() : 0;

    if (monoEnabled || offR || offG || offB) {
      sourceImage.loadPixels();
      const px = sourceImage.pixels;
      for (let i = 0; i < px.length; i += 4) {
        const r = Math.min(255, Math.max(0, px[i] + offR));
        const g = Math.min(255, Math.max(0, px[i + 1] + offG));
        const b = Math.min(255, Math.max(0, px[i + 2] + offB));
        if (monoEnabled) {
          // 明るさだけのグレーにしてからディザリングすると、白黒の結果になる
          px[i] = px[i + 1] = px[i + 2] = 0.299 * r + 0.587 * g + 0.114 * b;
        } else {
          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
        }
      }
      sourceImage.updatePixels();
    }

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
      let x = random(-width / 2, width / 2);
      let y = random(-height / 2, height / 2);
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

function setSliderValue(slider, value) {
  slider.value(value);
  slider.elt.dispatchEvent(new Event('input')); // 値の表示を更新する
}

function resizeArtCanvas(w, h) {
  resizeCanvas(w, h);
  ortho(-width / 2, width / 2, -height / 2, height / 2, near, far);
}

function handleFile(file) {
  if (file.type !== 'image') {
    alert('画像ファイルを選んでください');
    return;
  }
  loadUserImage(file.data);
}

async function loadUserImage(src) {
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    userImage = img;
    resizeArtCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    sceneBox.hide();
    imageBox.show();
  } catch (error) {
    console.error('Image load error:', error);
    alert('画像を読み込めませんでした');
  }
}

function clearUserImage() {
  userImage = null;
  resizeArtCanvas(INITIAL_W, INITIAL_H);
  sceneBox.show();
  imageBox.hide();
}

function createDebugSliders() {
  const addRow = (parent = sliderContainer) => {
    const div = createDiv('');
    div.parent(parent);
    return div;
  };

  const addSlider = (label, min, max, value, step, digits, parent = sliderContainer) => {
    const div = addRow(parent);
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

  // Image source
  const divImage = addRow();
  const fileInput = createFileInput(handleFile);
  fileInput.attribute('accept', 'image/*');
  fileInput.parent(divImage);
  createButton('Clear Image').parent(divImage).mousePressed(clearUserImage);

  // Mono toggle (閾値は白黒向けに128へ。オフに戻すと元の値へ)
  checkboxMono = createCheckbox('Mono', false);
  checkboxMono.parent(addRow());
  checkboxMono.changed(() => {
    if (checkboxMono.checked()) {
      savedThreshold = sliderC.value();
      setSliderValue(sliderC, 128);
    } else if (savedThreshold !== null) {
      setSliderValue(sliderC, savedThreshold);
      savedThreshold = null;
    }
  });

  sliderB = addSlider('解像度:', 0.07, 1, param_B, 0.01, 2);
  sliderC = addSlider('閾値:', 3, 255, param_C, 1, 0);

  // Slider E (checkbox style)
  // param_E が 0 のとき → チェックON, param_E が 4 のとき → チェックOFF
  sliderE = createCheckbox('ColorModeChange', param_E === 4);
  sliderE.parent(addRow());

  // Dithering toggle
  checkboxDither = createCheckbox('Dithering', true);
  checkboxDither.parent(addRow());

  // Save buttons
  const divSave = addRow();
  createButton('Save PNG').parent(divSave).mousePressed(() => window.saveCanvasPng());
  createButton('Save SVG').parent(divSave).mousePressed(() => {
    if (!ditherEnabled || !processedImage) {
      alert('ディザリングをオンにしてください');
      return;
    }
    window.saveDitheredSvg(processedImage.pixels, processedImage.width, processedImage.height, width, height);
  });

  // Image-only controls (画像モードのみ表示。各色に足し引きする)
  imageBox = addRow();
  imageBox.hide();
  sliderImgR = addSlider('画像 赤:', -255, 255, 0, 1, 0, imageBox);
  sliderImgG = addSlider('画像 緑:', -255, 255, 0, 1, 0, imageBox);
  sliderImgB = addSlider('画像 青:', -255, 255, 0, 1, 0, imageBox);

  // Scene-only controls (画像モードでは非表示)
  sceneBox = addRow();
  sliderR = addSlider('赤成分:', 0, 255, bgRed, 1, 0, sceneBox);
  sliderA = addSlider('緑成分:', 15, 255, param_A, 1, 0, sceneBox);
  sliderBl = addSlider('青成分:', 0, 255, bgBlue, 1, 0, sceneBox);
  sliderF = addSlider('円seed:', 1, 100, param_F, 1, 0, sceneBox);
  sliderD = addSlider('meshseed:', 1, 100, param_D, 1, 0, sceneBox);
  sliderMeshDetail = addSlider('分割数:', 10, 200, meshDetail, 1, 0, sceneBox);
  sliderMeshNoise = addSlider('ノイズ密度:', 0.001, 0.02, meshNoiseScale, 0.001, 3, sceneBox);
  sliderMeshHeight = addSlider('高低差:', 0, 1000, meshWaveHeight, 10, 0, sceneBox);

  // Circles toggle
  checkboxCircles = createCheckbox('Circles', true);
  checkboxCircles.parent(addRow(sceneBox));
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