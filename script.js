const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const originalInfo = document.getElementById("originalInfo");
const compressedInfo = document.getElementById("compressedInfo");
const downloadBtn = document.getElementById("downloadBtn");
const modeRadios = document.querySelectorAll('input[name="mode"]');

const cardControls = document.getElementById("cardControls");
const offsetXInput = document.getElementById("cardOffsetX");
const offsetYInput = document.getElementById("cardOffsetY");
const zoomInput = document.getElementById("cardZoom");

const ctx = canvas.getContext("2d");

let compressedBlob = null;
let currentImg = null;
let currentFile = null;

// トレカ用の定数
const CARD_WIDTH = 600;
const CARD_HEIGHT = 900;
const FRAME_MARGIN = 30; // 白フチ

// 今選ばれているモードを返す
function getCurrentMode() {
  for (const r of modeRadios) {
    if (r.checked) return r.value; // "compress" or "card"
  }
  return "compress";
}

// モードが変わったら表示を調整（トレカコントロールの表示/非表示など）
modeRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    const mode = getCurrentMode();
    if (mode === "card") {
      cardControls.style.display = "block";
      // 画像が読み込まれていれば、トレカ描画をやり直す
      if (currentImg && currentFile) processCard(currentImg, currentFile);
    } else {
      cardControls.style.display = "none";
      if (currentImg && currentFile) processCompress(currentImg, currentFile);
    }
  });
});

// ダウンロードボタン
downloadBtn.addEventListener("click", () => {
  if (!compressedBlob) return;

  const url = URL.createObjectURL(compressedBlob);
  const a = document.createElement("a");
  const mode = getCurrentMode();

  a.href = url;
  a.download = mode === "card" ? "oshi-card.jpg" : "compressed.jpg";

  a.click();
  URL.revokeObjectURL(url);
});

// 画像が選ばれたとき
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  compressedBlob = null;
  preview.style.display = "none";
  downloadBtn.style.display = "none";
  compressedInfo.textContent = "";

  originalInfo.textContent = `元画像: ${(file.size / 1024).toFixed(1)} KB`;

  const mode = getCurrentMode();

  const img = new Image();
  img.onload = () => {
    currentImg = img;
    currentFile = file;

    // スライダーをリセット
    offsetXInput.value = "0";
    offsetYInput.value = "0";
    zoomInput.value = "0";

    if (mode === "card") {
      cardControls.style.display = "block";
      processCard(currentImg, currentFile);
    } else {
      cardControls.style.display = "none";
      processCompress(currentImg, currentFile);
    }
  };

  const reader = new FileReader();
  reader.onload = (event) => {
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// ★ モード1：通常圧縮（画質ほぼそのまま）
function processCompress(img, file) {
  const maxSize = 1200; // 長辺の最大サイズ

  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const targetWidth = Math.round(img.width * ratio);
  const targetHeight = Math.round(img.height * ratio);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      compressedBlob = blob;

      compressedInfo.textContent =
        `圧縮後: ${(blob.size / 1024).toFixed(1)} KB（${(blob.size / file.size * 100).toFixed(1)}%）`;

      const url = URL.createObjectURL(blob);
      preview.src = url;
      preview.style.display = "block";
      downloadBtn.style.display = "block";
    },
    "image/jpeg",
    0.8
  );
}

// ★ モード2：トレカ加工（2:3比率＋白フチ＋位置/拡大調整）
function processCard(img, file) {
  const targetAspect = CARD_HEIGHT / CARD_WIDTH;
  const imgAspect = img.height / img.width;

  // まずは「ちょうど収まる」基本のトリミングサイズを計算
  let baseW, baseH;
  if (imgAspect > targetAspect) {
    // 縦長すぎ → 上下カット
    baseW = img.width;
    baseH = Math.round(img.width * targetAspect);
  } else {
    // 横長すぎ → 左右カット
    baseH = img.height;
    baseW = Math.round(img.height / targetAspect);
  }

  // 拡大（ズーム）スライダー：0〜100 → 1〜約2.5倍に
  const zoomVal = Number(zoomInput.value); // 0〜100
  const zoomFactor = 1 + (zoomVal / 100) * 1.5; // 1〜2.5

  const srcW = Math.round(baseW / zoomFactor);
  const srcH = Math.round(baseH / zoomFactor);

  // 画像の中で切り抜ける最大範囲
  const maxX = img.width - srcW;
  const maxY = img.height - srcH;

  // スライダー値（-100〜100）を -1〜1 に正規化
  const relX = Number(offsetXInput.value) / 100; // -1〜1
  const relY = Number(offsetYInput.value) / 100; // -1〜1

  // 中央を基準に、左右/上下に動かす
  const centerX = maxX / 2;
  const centerY = maxY / 2;

  let srcX = Math.round(centerX + relX * centerX);
  let srcY = Math.round(centerY + relY * centerY);

  // 念のため範囲からはみ出ないようにクリップ
  srcX = Math.max(0, Math.min(srcX, maxX));
  srcY = Math.max(0, Math.min(srcY, maxY));

  // キャンバスにトレカサイズで描画
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  // 背景（フチ部分）を白で塗る
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const drawX = FRAME_MARGIN;
  const drawY = FRAME_MARGIN;
  const drawW = CARD_WIDTH - FRAME_MARGIN * 2;
  const drawH = CARD_HEIGHT - FRAME_MARGIN * 2;

  ctx.drawImage(
    img,
    srcX,
    srcY,
    srcW,
    srcH,
    drawX,
    drawY,
    drawW,
    drawH
  );

  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      compressedBlob = blob;

      compressedInfo.textContent =
        `トレカ画像: ${(blob.size / 1024).toFixed(1)} KB（元の ${(blob.size / file.size * 100).toFixed(1)}%）`;

      const url = URL.createObjectURL(blob);
      preview.src = url;
      preview.style.display = "block";
      downloadBtn.style.display = "block";
    },
    "image/jpeg",
    0.85
  );
}

// ★ スライダーを動かしたらリアルタイムでトレカを描き直す
[offsetXInput, offsetYInput, zoomInput].forEach(input => {
  input.addEventListener("input", () => {
    if (getCurrentMode() === "card" && currentImg && currentFile) {
      processCard(currentImg, currentFile);
    }
  });
});
