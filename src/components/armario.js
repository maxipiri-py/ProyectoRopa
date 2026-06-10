import { addGarment } from '../utils/db.js';

let fileInput = null;
let uploadArea = null;
let previewContainer = null;
let previewImg = null;
let btnRemoveImg = null;
let btnSaveGarment = null;
let processingBadge = null;

// Inputs del formulario
let inputName = null;
let selectStyle = null;
let selectWeather = null;
let inputColor = null;

// Imagen original sin procesar para permitir re-procesamiento por tolerancia
let originalImageSrc = null;
// Imagen procesada (sin fondo) en base64
let processedImageBase64 = null;

// Escuchador de recarga del armario
let onGarmentSavedCallback = null;

export function initArmario(onGarmentSaved) {
    onGarmentSavedCallback = onGarmentSaved;

    // Vinculación de DOM
    fileInput = document.getElementById('input-garment-file');
    uploadArea = document.getElementById('garment-upload-area');
    previewContainer = document.getElementById('garment-preview-container');
    previewImg = document.getElementById('garment-preview-img');
    btnRemoveImg = document.getElementById('btn-remove-garment-img');
    btnSaveGarment = document.getElementById('btn-save-garment');
    processingBadge = document.getElementById('garment-processing-badge');

    inputName = document.getElementById('input-garment-name');
    selectStyle = document.getElementById('select-garment-style');
    selectWeather = document.getElementById('select-garment-weather');
    inputColor = document.getElementById('input-garment-color');

    // Escuchadores
    fileInput.addEventListener('change', handleFileSelect);
    btnRemoveImg.addEventListener('click', removeImage);
    btnSaveGarment.addEventListener('click', saveGarmentToDB);
    inputName.addEventListener('input', validateForm);

    // Agregar control de tolerancia debajo de la vista previa de la prenda
    createToleranceSlider();
}

function createToleranceSlider() {
    // Insertamos un slider de tolerancia interactivo
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'tolerance-control-container';
    sliderContainer.className = 'form-group hidden';
    sliderContainer.style.marginTop = '12px';
    sliderContainer.innerHTML = `
        <label for="input-bg-tolerance" style="display: flex; justify-content: space-between;">
            <span>Ajuste de fondo (Tolerancia)</span>
            <span id="tolerance-val">45</span>
        </label>
        <input type="range" id="input-bg-tolerance" min="10" max="150" value="45" style="width:100%; accent-color:var(--color-primary); cursor:pointer;">
    `;
    previewContainer.parentElement.insertBefore(sliderContainer, previewContainer.nextSibling);

    const slider = document.getElementById('input-bg-tolerance');
    slider.addEventListener('input', (e) => {
        document.getElementById('tolerance-val').innerText = e.target.value;
        if (originalImageSrc) {
            processImage(originalImageSrc, parseInt(e.target.value));
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    processingBadge.classList.remove('hidden');
    uploadArea.classList.add('hidden');
    previewContainer.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImageSrc = e.target.result;
        
        // Ejecutar procesamiento con tolerancia inicial de 45
        const tolerance = parseInt(document.getElementById('input-bg-tolerance').value);
        processImage(originalImageSrc, tolerance);
        
        document.getElementById('tolerance-control-container').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Algoritmo Chroma-Key para remover fondo usando Canvas en el cliente
function processImage(imageSrc, tolerance) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Redimensionar para optimizar el procesamiento y almacenamiento móvil
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
            h = (maxDim / w) * h;
            w = maxDim;
        } else if (h > maxDim) {
            w = (maxDim / h) * w;
            h = maxDim;
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Muestrear esquinas para detectar el color de fondo promedio
        const corners = [
            getPixel(imgData, 0, 0),
            getPixel(imgData, w - 1, 0),
            getPixel(imgData, 0, h - 1),
            getPixel(imgData, w - 1, h - 1),
            getPixel(imgData, Math.floor(w / 2), 0) // Superior centro
        ];

        // Promediar componentes RGB del fondo
        let bgR = 0, bgG = 0, bgB = 0;
        corners.forEach(c => {
            bgR += c.r;
            bgG += c.g;
            bgB += c.b;
        });
        bgR = Math.floor(bgR / corners.length);
        bgG = Math.floor(bgG / corners.length);
        bgB = Math.floor(bgB / corners.length);

        // Algoritmo de filtrado por distancia euclidiana de color
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Distancia en el espacio de color RGB
            const distance = Math.sqrt(
                Math.pow(r - bgR, 2) +
                Math.pow(g - bgG, 2) +
                Math.pow(b - bgB, 2)
            );

            if (distance < tolerance) {
                // Hacer píxel completamente transparente si está dentro de la tolerancia
                data[i + 3] = 0;
            } else {
                // Suavizar bordes (anti-aliasing básico)
                const edgeSoftness = 10;
                if (distance < tolerance + edgeSoftness) {
                    const alphaRatio = (distance - tolerance) / edgeSoftness;
                    data[i + 3] = Math.floor(alphaRatio * 255);
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        processedImageBase64 = cropTransparency(canvas);
        
        // Actualizar UI
        previewImg.src = processedImageBase64;
        processingBadge.classList.add('hidden');
        validateForm();
    };
    img.src = imageSrc;
}

// Recorta los márgenes transparentes alrededor de la prenda procesada
function cropTransparency(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const alpha = data[((y * w) + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) return canvas.toDataURL('image/png');

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = (maxX - minX) + 1;
    cropCanvas.height = (maxY - minY) + 1;
    const cropCtx = cropCanvas.getContext('2d');

    cropCtx.drawImage(canvas, minX, minY, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);

    return cropCanvas.toDataURL('image/png');
}

function getPixel(imgData, x, y) {
    const i = (y * imgData.width + x) * 4;
    return {
        r: imgData.data[i],
        g: imgData.data[i + 1],
        b: imgData.data[i + 2]
    };
}

function removeImage() {
    originalImageSrc = null;
    processedImageBase64 = null;
    previewImg.src = '';
    
    fileInput.value = '';
    previewContainer.classList.add('hidden');
    uploadArea.classList.remove('hidden');
    document.getElementById('tolerance-control-container').classList.add('hidden');
    
    validateForm();
}

function validateForm() {
    const hasName = inputName.value.trim().length > 0;
    const hasImage = processedImageBase64 !== null;
    
    btnSaveGarment.disabled = !(hasName && hasImage);
}

async function saveGarmentToDB() {
    const name = inputName.value.trim();
    const category = document.querySelector('input[name="garment-category"]:checked').value;
    const style = selectStyle.value;
    const weather = selectWeather.value;
    const color = inputColor.value;

    if (!name || !processedImageBase64) return;

    btnSaveGarment.disabled = true;
    btnSaveGarment.innerText = 'Guardando Prenda...';

    const garment = {
        name,
        category,
        style,
        weather,
        color,
        image: processedImageBase64,
        createdAt: Date.now()
    };

    try {
        await addGarment(garment);
        alert('¡Prenda guardada con éxito en tu armario!');
        
        // Limpiar formulario
        inputName.value = '';
        removeImage();
        
        // Recargar datos en el Closet
        if (onGarmentSavedCallback) onGarmentSavedCallback();
    } catch (e) {
        alert('Error al guardar en el armario: ' + e.message);
        btnSaveGarment.disabled = false;
    } finally {
        btnSaveGarment.innerText = 'Guardar en mi Armario';
    }
}
