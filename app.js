// Default Export Dimensions (6.9" Landscape)
const DEFAULT_EXPORT_WIDTH = 2736;
const DEFAULT_EXPORT_HEIGHT = 1260;
const APP_STORE_EXPORT_BACKGROUND = '#111827';

// Device Presets Map (Width x Height)
const DEVICE_PRESETS = {
  'iphone-6.9': { width: 2736, height: 1260, label: 'iPhone 6.9" Landscape (2736 × 1260 px)' },
  'iphone-6.5': { width: 2778, height: 1284, label: 'iPhone 6.5" Landscape (2778 × 1284 px)' },
  'iphone-6.9-portrait': { width: 1290, height: 2796, label: 'iPhone 6.9" Portrait (1290 × 2796 px)' },
  'iphone-5.5-portrait': { width: 1242, height: 2208, label: 'iPhone 5.5" Portrait (1242 × 2208 px)' },
  'ipad-13': { width: 2064, height: 2752, label: 'iPad Pro 13" (2064 × 2752 px)' },
  'mac-appstore': { width: 1280, height: 800, label: 'Mac App Store (1280 × 800 px)' },
  'google-play': { width: 1080, height: 1920, label: 'Google Play Phone (1080 × 1920 px)' }
};

// DOM Elements
const modeSelectionScreen = document.getElementById('modeSelectionScreen');
const appInterface = document.getElementById('appInterface');
const activeModeBadge = document.getElementById('activeModeBadge');
const exportPanelControls = document.getElementById('exportPanelControls');

const browseFilesButton = document.getElementById('browseFilesButton');
const mainContainer = document.getElementById('mainContainer');
const layersList = document.getElementById('layersList');
const viewport = document.getElementById('viewport');
const dimensionInfo = document.getElementById('dimensionInfo');

const camRotateX = document.getElementById('camRotateX');
const camRotateY = document.getElementById('camRotateY');
const layerGap = document.getElementById('layerGap');
const previewZoom = document.getElementById('previewZoom');
const resetCamBtn = document.getElementById('resetCamBtn');
const exportRadius = document.getElementById('exportRadius');
const exportFormatSelect = document.getElementById('exportFormatSelect');
const exportCompositeBtn = document.getElementById('exportCompositeBtn');
const exportAllLayersBtn = document.getElementById('exportAllLayersBtn');
const appStoreModeBtn = document.getElementById('appStoreModeBtn');
const depthModeBtn = document.getElementById('depthModeBtn');
const resetModeBtn = document.getElementById('resetModeBtn');

// Typography & Preset Control Elements
const devicePresetSelect = document.getElementById('devicePresetSelect');
const headlineTextInput = document.getElementById('headlineTextInput');
const fontSelect = document.getElementById('fontSelect');
const fontSizeInput = document.getElementById('fontSizeInput');
const textColorInput = document.getElementById('textColorInput');

let activeMode = null;
let layers = [];

// Text Overlay State
let textOverlay = {
  text: '',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 80,
  color: '#FFFFFF'
};

// Active Export Dimensions
let currentExportWidth = DEFAULT_EXPORT_WIDTH;
let currentExportHeight = DEFAULT_EXPORT_HEIGHT;

/**
 * Mode Selection
 */
window.selectMode = function(mode) {
  activeMode = mode;
  modeSelectionScreen.style.display = 'none';
  appInterface.style.display = 'block';

  if (activeMode === 'depth') {
    activeModeBadge.textContent = 'Mode: 2D Layer Depth Tester';
    if (exportPanelControls) exportPanelControls.style.display = 'none';
  } else {
    activeModeBadge.textContent = 'Mode: App Store Screenshot Resizer';
    if (exportPanelControls) exportPanelControls.style.display = 'block';
  }

  if (layers.length > 0) {
    calculateAndSetDimensions();
    updateLayersAndDOM();
  }
};

window.resetModeSelection = function() {
  modeSelectionScreen.style.display = 'flex';
  appInterface.style.display = 'none';
};


appStoreModeBtn?.addEventListener('click', () => window.selectMode('appstore'));
depthModeBtn?.addEventListener('click', () => window.selectMode('depth'));
resetModeBtn?.addEventListener('click', () => window.resetModeSelection());

/**
 * File Loading & Event Listeners
 */
async function openNativeImages() {
  const tauri = window.__TAURI__;
  if (!tauri?.dialog?.open || !tauri?.core?.invoke) {
    throw new Error('Native Tauri APIs are unavailable. Please launch App Store Studio as a desktop application.');
  }

  const selected = await tauri.dialog.open({
    multiple: true,
    directory: false,
    filters: [{
      name: 'Images',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
    }]
  });

  if (!selected) return true;
  const paths = Array.isArray(selected) ? selected : [selected];
  await handleNativePaths(paths);
  return true;
}

if (browseFilesButton) {
  browseFilesButton.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await openNativeImages();
    } catch (error) {
      reportFileLoadError(error);
    }
  });
}



async function registerTauriDragDrop() {
  const tauri = window.__TAURI__;
  if (!tauri?.event?.listen) return;

  await tauri.event.listen('tauri://drag-drop', async (event) => {
    const payload = event.payload || {};
    const paths = Array.isArray(payload) ? payload : payload.paths;
    if (!Array.isArray(paths) || paths.length === 0) return;

    try {
      await handleNativePaths(paths);
    } catch (error) {
      reportFileLoadError(error);
    }
  });
}

registerTauriDragDrop().catch(reportFileLoadError);

[camRotateX, camRotateY, layerGap, previewZoom].forEach(ctrl => {
  if (ctrl) ctrl.addEventListener('input', updateViewportTransform);
});

if (exportRadius) exportRadius.addEventListener('input', syncCornerRadius);

function syncCornerRadius() {
  if (!exportRadius) return;
  const radPx = `${exportRadius.value / 6}px`;
  document.documentElement.style.setProperty('--stage-radius', radPx);
}

if (resetCamBtn) {
  resetCamBtn.addEventListener('click', () => {
    if (camRotateX) camRotateX.value = 0;
    if (camRotateY) camRotateY.value = 0;
    if (layerGap) layerGap.value = 0;
    if (previewZoom) previewZoom.value = 1;
    updateViewportTransform();
  });
}

function reportExportError(error) {
  console.error('Export failed:', error);
  const message = error instanceof Error ? error.message : String(error);
  window.alert(`Export failed: ${message}`);
}

if (exportCompositeBtn) {
  exportCompositeBtn.addEventListener('click', () => {
    exportToAppStore(true).catch(reportExportError);
  });
}
if (exportAllLayersBtn) {
  exportAllLayersBtn.addEventListener('click', () => {
    exportToAppStore(false).catch(reportExportError);
  });
}

/**
 * Device Preset Listeners
 */
if (devicePresetSelect) {
  devicePresetSelect.addEventListener('change', (e) => {
    const presetKey = e.target.value;
    if (DEVICE_PRESETS[presetKey]) {
      currentExportWidth = DEVICE_PRESETS[presetKey].width;
      currentExportHeight = DEVICE_PRESETS[presetKey].height;
    } else {
      currentExportWidth = DEFAULT_EXPORT_WIDTH;
      currentExportHeight = DEFAULT_EXPORT_HEIGHT;
    }
    calculateAndSetDimensions();
    updateLayersAndDOM();
  });
}

if (headlineTextInput) headlineTextInput.addEventListener('input', (e) => { textOverlay.text = e.target.value; updateTextOverlayDOM(); });
if (fontSelect) fontSelect.addEventListener('change', (e) => { textOverlay.fontFamily = e.target.value; updateTextOverlayDOM(); });
if (fontSizeInput) fontSizeInput.addEventListener('input', (e) => { textOverlay.fontSize = parseInt(e.target.value, 10) || 80; updateTextOverlayDOM(); });
if (textColorInput) textColorInput.addEventListener('input', (e) => { textOverlay.color = e.target.value; updateTextOverlayDOM(); });

function reportFileLoadError(error) {
  console.error('Image loading failed:', error);
  const message = error instanceof Error ? error.message : String(error);
  window.alert(`Image loading failed: ${message}`);
}

function getFileName(path) {
  return path.split(/[\\/]/).pop() || 'image';
}

async function loadImageEntries(entries) {
  const baseZ = layers.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const { width, height, imgObj } = await getImageData(entry.url);
      layers.push({
        id: `layer-${Date.now()}-${i}`,
        name: entry.name,
        url: entry.url,
        imgObj,
        naturalWidth: width,
        naturalHeight: height,
        opacity: 1,
        flipX: false,
        flipY: false,
        zIndex: baseZ + (entries.length - i)
      });
    } catch (error) {
      console.error('Failed to load image:', entry.name, error);
    }
  }

  if (layers.length > 0) {
    if (mainContainer) mainContainer.style.display = 'flex';
    calculateAndSetDimensions();
    updateLayersAndDOM();
  }
}


async function handleNativePaths(paths) {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) {
    throw new Error('Native Tauri APIs are unavailable. Please launch App Store Studio as a desktop application.');
  }

  const entries = await Promise.all(paths.map(async (path) => ({
    name: getFileName(path),
    url: await tauri.core.invoke('read_image_file', { path })
  })));
  await loadImageEntries(entries);
}

function getImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, imgObj: img });
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Calculates and scales the interactive viewport based on screen mode and presets
 */
function calculateAndSetDimensions() {
  if (activeMode === 'appstore') {
    const targetWidth = 520;
    const targetHeight = targetWidth / (currentExportWidth / currentExportHeight);

    viewport.style.width = `${Math.round(targetWidth)}px`;
    viewport.style.height = `${Math.round(targetHeight)}px`;
    syncCornerRadius();
    if (dimensionInfo) {
      dimensionInfo.textContent = `Target Export Scale: ${currentExportWidth}px × ${currentExportHeight}px (App Store Specs)`;
    }
  } else {
    let minWidth = Infinity, minHeight = Infinity;
    layers.forEach(l => {
      if (l.naturalWidth < minWidth) minWidth = l.naturalWidth;
      if (l.naturalHeight < minHeight) minHeight = l.naturalHeight;
    });

    if (minWidth === Infinity) { minWidth = 1280; minHeight = 720; }

    let finalWidth, finalHeight;
    const targetAspect = 16 / 9;
    const currentAspect = minWidth / minHeight;

    if (currentAspect > targetAspect) {
      finalHeight = minHeight;
      finalWidth = minHeight * targetAspect;
    } else {
      finalWidth = minWidth;
      finalHeight = minWidth / targetAspect;
    }

    viewport.style.width = `${Math.round(finalWidth)}px`;
    viewport.style.height = `${Math.round(finalHeight)}px`;
    document.documentElement.style.setProperty('--stage-radius', '0px');
    if (dimensionInfo) {
      dimensionInfo.textContent = `Auto-Scaled Viewport: ${Math.round(finalWidth)}px × ${Math.round(finalHeight)}px (Smallest Asset)`;
    }
  }
}

/**
 * Re-renders DOM elements for layer management and text overlay
 */
function updateLayersAndDOM() {
  layers.sort((a, b) => b.zIndex - a.zIndex);
  if (layersList) layersList.innerHTML = '';

  layers.forEach((layer) => {
    let imgEl = document.getElementById(`img-${layer.id}`);
    if (!imgEl) {
      imgEl = document.createElement('img');
      imgEl.src = layer.url;
      imgEl.id = `img-${layer.id}`;
      imgEl.className = 'stage-layer';
      viewport.appendChild(imgEl);
    }
    imgEl.style.zIndex = layer.zIndex;
    imgEl.style.opacity = layer.opacity;

    if (layersList) {
      const controlWidget = document.createElement('div');
      controlWidget.className = 'layer-item';
      controlWidget.innerHTML = `
        <div class="layer-header">
          <span class="layer-name" title="${layer.name}">${layer.name}</span>
          <div class="btn-group">
            <button onclick="moveLayer('${layer.id}', 'up')" title="Up">▲</button>
            <button onclick="moveLayer('${layer.id}', 'down')" title="Down">▼</button>
            <button onclick="removeLayer('${layer.id}')" title="Delete" style="background:#b91c1c;">✕</button>
          </div>
        </div>
        <div class="control-row">
          <label>Flips:</label>
          <div class="btn-group">
            <button onclick="toggleFlip('${layer.id}', 'X')" style="background: ${layer.flipX ? 'var(--accent-color)' : '#3a3a4a'}">Flip X</button>
            <button onclick="toggleFlip('${layer.id}', 'Y')" style="background: ${layer.flipY ? 'var(--accent-color)' : '#3a3a4a'}">Flip Y</button>
          </div>
        </div>
        <div class="control-row">
          <label>Opacity:</label>
          <input type="range" min="0" max="1" step="0.05" value="${layer.opacity}" oninput="adjustOpacity('${layer.id}', this.value)">
        </div>
      `;
      layersList.appendChild(controlWidget);
    }
  });

  updateTextOverlayDOM();
  updateViewportTransform();
}

/**
 * Manages live HTML text overlay over the 3D viewport
 */
function updateTextOverlayDOM() {
  let textEl = document.getElementById('viewport-text-overlay');
  if (!textOverlay.text) {
    if (textEl) textEl.remove();
    return;
  }

  if (!textEl) {
    textEl = document.createElement('div');
    textEl.id = 'viewport-text-overlay';
    textEl.style.position = 'absolute';
    textEl.style.top = '8%';
    textEl.style.left = '50%';
    textEl.style.transform = 'translateX(-50%)';
    textEl.style.width = '85%';
    textEl.style.textAlign = 'center';
    textEl.style.pointerEvents = 'none';
    textEl.style.zIndex = '999';
    viewport.appendChild(textEl);
  }

  const viewportWidth = parseFloat(viewport.style.width) || 520;
  const fontRatio = textOverlay.fontSize / currentExportWidth;
  const scaledFontSize = Math.max(12, fontRatio * viewportWidth);

  textEl.style.fontFamily = `"${textOverlay.fontFamily}", sans-serif`;
  textEl.style.fontSize = `${scaledFontSize}px`;
  textEl.style.color = textOverlay.color;
  textEl.style.fontWeight = 'bold';
  textEl.style.lineHeight = '1.2';
  textEl.textContent = textOverlay.text;
}

/**
 * Updates 3D CSS perspective transforms on the viewport
 */
function updateViewportTransform() {
  const rx = camRotateX ? camRotateX.value : 0;
  const ry = camRotateY ? camRotateY.value : 0;
  const zoom = previewZoom ? previewZoom.value : 1;
  const gap = layerGap ? parseFloat(layerGap.value) : 0;

  viewport.style.transform = `scale(${zoom}) rotateX(${rx}deg) rotateY(${ry}deg)`;

  layers.forEach((layer, index) => {
    const imgEl = document.getElementById(`img-${layer.id}`);
    if (!imgEl) return;
    const offsetX = index * gap * 0.5;
    const offsetY = -(index * gap * 0.5);

    let transformStr = `translate(${offsetX}px, ${offsetY}px) `;
    if (layer.flipX) transformStr += 'scaleX(-1) ';
    if (layer.flipY) transformStr += 'scaleY(-1) ';
    imgEl.style.transform = transformStr;
  });
}

function getModBaseName(filename, suffix = "_mod") {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return `${filename}${suffix}`;
  return `${filename.substring(0, lastDotIndex)}${suffix}`;
}

/**
 * Export Engine: Center-crop (edge shaving) to fit precise App Store dimensions
 */
async function exportToAppStore(compositeOnly = true) {
  await document.fonts.ready;

  const requestedRadius = exportRadius ? parseFloat(exportRadius.value) : 0;
  const radius = Math.min(
    Math.max(Number.isFinite(requestedRadius) ? requestedRadius : 0, 0),
    Math.min(currentExportWidth, currentExportHeight) / 2
  );
  const gap = layerGap ? parseFloat(layerGap.value) : 0;
  const exportFormat = exportFormatSelect?.value === 'jpeg' ? 'jpeg' : 'png';
  const fileExtension = exportFormat === 'jpeg' ? 'jpeg' : 'png';

  const renderLayer = async (layerList, filename) => {
    const canvas = document.createElement('canvas');
    canvas.width = currentExportWidth;
    canvas.height = currentExportHeight;
    const ctx = canvas.getContext('2d');

    // App Store screenshots cannot contain transparency or an alpha channel.
    // The preview is one rounded viewport, not a set of independently rounded
    // layers. Paint the same opaque viewport color first, then use one shared
    // clip for every layer and the text overlay.
    ctx.fillStyle = APP_STORE_EXPORT_BACKGROUND;
    ctx.fillRect(0, 0, currentExportWidth, currentExportHeight);

    const clipToViewport = () => {
      ctx.beginPath();
      ctx.roundRect(0, 0, currentExportWidth, currentExportHeight, radius);
      ctx.clip();
    };

    ctx.save();
    clipToViewport();

    const renderOrder = [...layerList].sort((a, b) => a.zIndex - b.zIndex);

    renderOrder.forEach((layer) => {
      const listIndex = layers.findIndex(l => l.id === layer.id);
      const scaleX = layer.flipX ? -1 : 1;
      const scaleY = layer.flipY ? -1 : 1;

      const offsetMultiplier = currentExportWidth / parseFloat(viewport.style.width);
      const offsetX = listIndex * gap * 0.5 * offsetMultiplier;
      const offsetY = -(listIndex * gap * 0.5 * offsetMultiplier);

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(currentExportWidth / 2 + offsetX, currentExportHeight / 2 + offsetY);
      ctx.scale(scaleX, scaleY);

      // Edge Shaving / Cover Calculations
      const imgAspect = layer.naturalWidth / layer.naturalHeight;
      const targetAspect = currentExportWidth / currentExportHeight;
      let drawW, drawH;

      if (imgAspect > targetAspect) {
        // Input is wider: shave off left and right outer edges
        drawH = currentExportHeight;
        drawW = currentExportHeight * imgAspect;
      } else {
        // Input is taller: shave off top and bottom outer edges
        drawW = currentExportWidth;
        drawH = currentExportWidth / imgAspect;
      }

      ctx.drawImage(layer.imgObj, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    });

    // Render Typography Overlay onto the same clipped viewport.
    if (textOverlay.text) {
      ctx.save();
      ctx.fillStyle = textOverlay.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `bold ${textOverlay.fontSize}px "${textOverlay.fontFamily}", sans-serif`;

      const maxWidth = currentExportWidth * 0.85;
      const words = textOverlay.text.split(' ');
      const lines = [];
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);

      const lineHeight = textOverlay.fontSize * 1.2;
      let startY = currentExportHeight * 0.08;

      lines.forEach((line) => {
        ctx.fillText(line, currentExportWidth / 2, startY);
        startY += lineHeight;
      });

      ctx.restore();
    }

    ctx.restore();

    const dataUrl = exportFormat === 'jpeg'
      ? canvas.toDataURL('image/jpeg', 0.95)
      : canvas.toDataURL('image/png');

    // Tauri uses the native Rust encoder. This is important for PNG: browsers
    // may emit an RGBA PNG even when every pixel is opaque, while App Store
    // exports must have PNG color type 2 (RGB, with no alpha channel).
    const tauri = window.__TAURI__;
    if (tauri?.core?.invoke && tauri?.dialog?.save) {
      const selectedPath = await tauri.dialog.save({
        defaultPath: `${filename}.${fileExtension}`,
        filters: [{
          name: exportFormat === 'jpeg' ? 'JPEG Image' : 'PNG Image',
          extensions: [fileExtension]
        }]
      });

      if (!selectedPath) return;

      // Enforce the selected format even if the user types a different or no
      // extension into the native save dialog.
      const outputPath = selectedPath.replace(/\.(png|jpe?g)$/i, '') + `.${fileExtension}`;
      await tauri.core.invoke('export_image', {
        inputBase64: dataUrl,
        outputPath,
        format: exportFormat
      });
      return;
    }

    throw new Error('Native Tauri export is unavailable. Please launch App Store Studio as a desktop application.');
  };

  if (compositeOnly) {
    const baseName = layers.length > 0 ? getModBaseName(layers[0].name, layers.length > 1 ? "_composite_mod" : "_mod") : "composite_mod";
    await renderLayer(layers, baseName);
  } else {
    for (const layer of layers) {
      await renderLayer([layer], getModBaseName(layer.name, "_mod"));
    }
  }
}

/**
 * Global Helpers & Controls
 */
window.moveLayer = function(id, dir) {
  const index = layers.findIndex(l => l.id === id);
  if (index === -1) return;
  if (dir === 'up' && index > 0) {
    let t = layers[index].zIndex; layers[index].zIndex = layers[index - 1].zIndex; layers[index - 1].zIndex = t;
  } else if (dir === 'down' && index < layers.length - 1) {
    let t = layers[index].zIndex; layers[index].zIndex = layers[index + 1].zIndex; layers[index + 1].zIndex = t;
  }
  updateLayersAndDOM();
};

window.toggleFlip = function(id, axis) {
  const l = layers.find(l => l.id === id);
  if (!l) return;
  if (axis === 'X') l.flipX = !l.flipX;
  if (axis === 'Y') l.flipY = !l.flipY;
  updateLayersAndDOM();
};

window.adjustOpacity = function(id, val) {
  const l = layers.find(l => l.id === id);
  if (!l) return;
  l.opacity = parseFloat(val);
  const el = document.getElementById(`img-${id}`);
  if (el) el.style.opacity = val;
};

window.removeLayer = function(id) {
  const imgEl = document.getElementById(`img-${id}`);
  if (imgEl) imgEl.remove();

  layers = layers.filter(l => l.id !== id);
  if (layers.length === 0) {
    if (mainContainer) mainContainer.style.display = 'none';
    viewport.innerHTML = '';
  } else {
    calculateAndSetDimensions();
    updateLayersAndDOM();
  }
};
