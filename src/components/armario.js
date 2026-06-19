// --- MÓDULO DE GESTIÓN DEL ROPERO (TeViste) ---
import { addGarment, getGarments, deleteGarment } from '../utils/db.js';

// Estructura de almacenamiento en memoria exigida por las especificaciones
export const ropero = {
    superior: [],
    inferior: []
};

// Inputs del uploader (Modal)
let fileInput = null;
let uploadArea = null;
let previewContainer = null;
let previewImg = null;
let btnRemoveImg = null;
let btnSaveGarment = null;
let processingBadge = null;

let inputName = null;
let selectStyle = null;
let selectWeather = null;
let inputColor = null;
let hiddenCategoryInput = null;

// Elementos del Modal
let modalUpload = null;
let btnCloseUploadModal = null;
let modalUploadTitle = null;
let btnAddTop = null;
let btnAddBottom = null;

// Imagen original sin procesar para permitir re-procesamiento por tolerancia
let originalImageSrc = null;
// Imagen procesada (sin fondo y recortada) en base64
let processedImageBase64 = null;

// Escuchador de recarga para el probador (Closet)
let onGarmentSavedCallback = null;

export function initArmario(onGarmentSaved) {
    onGarmentSavedCallback = onGarmentSaved;

    // Vinculación de DOM - Ropero
    btnAddTop = document.getElementById('btn-add-top');
    btnAddBottom = document.getElementById('btn-add-bottom');
    modalUpload = document.getElementById('modal-upload');
    btnCloseUploadModal = document.getElementById('btn-close-upload-modal');
    modalUploadTitle = document.getElementById('modal-upload-title');

    // Vinculación de DOM - Uploader Form
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
    hiddenCategoryInput = document.getElementById('hidden-garment-category');

    // Escuchadores de apertura/cierre de modal
    btnAddTop.addEventListener('click', () => openUploadModal('top'));
    btnAddBottom.addEventListener('click', () => openUploadModal('bottom'));
    btnCloseUploadModal.addEventListener('click', closeUploadModal);

    // Escuchadores de formulario
    fileInput.addEventListener('change', handleFileSelect);
    btnRemoveImg.addEventListener('click', removeImage);
    btnSaveGarment.addEventListener('click', saveGarmentToDB);
    inputName.addEventListener('input', validateForm);

    // Crear slider de tolerancia dinámico
    createToleranceSlider();

    // Cargar galerías de prendas
    loadRoperoGalleries();
}

function openUploadModal(category) {
    hiddenCategoryInput.value = category;
    modalUploadTitle.innerText = category === 'top' ? 'Añadir Prenda Superior' : 'Añadir Prenda Inferior';
    modalUpload.classList.add('active');
}

function closeUploadModal() {
    modalUpload.classList.remove('active');
    removeImage();
    inputName.value = '';
    validateForm();
}

function createToleranceSlider() {
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
    // Insertar dentro del modal-body antes del nombre de prenda
    inputName.parentElement.insertBefore(sliderContainer, inputName);

    const slider = document.getElementById('input-bg-tolerance');
    slider.addEventListener('input', (e) => {
        document.getElementById('tolerance-val').innerText = e.target.value;
        if (originalImageSrc) {
            processImage(originalImageSrc, parseInt(e.target.value));
        }
    });
}

export async function loadRoperoGalleries() {
    try {
        const allGarments = await getGarments();
        
        // Estructura en la variable ropero
        ropero.superior = allGarments.filter(g => g.category === 'top');
        ropero.inferior = allGarments.filter(g => g.category === 'bottom');

        // Renderizar galerías
        renderRoperoGallery(ropero.superior, 'ropero-tops-gallery', 'superior');
        renderRoperoGallery(ropero.inferior, 'ropero-bottoms-gallery', 'inferior');

    } catch (e) {
        console.error("Error al cargar galerías del ropero:", e);
    }
}

function renderRoperoGallery(items, containerId, categoryLabel) {
    const galleryEl = document.getElementById(containerId);
    if (!galleryEl) return;
    galleryEl.innerHTML = '';

    if (items.length === 0) {
        galleryEl.innerHTML = `<span style="font-size: 12px; color: var(--color-text-light); font-style: italic; width: 100%; text-align: center; opacity: 0.7; padding: 24px;">No hay prendas ${categoryLabel}es</span>`;
        return;
    }

    items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'ropero-item';
        itemCard.style.position = 'relative';
        itemCard.style.flex = '0 0 80px';
        itemCard.style.width = '80px';
        itemCard.style.height = '80px';
        itemCard.style.background = 'white';
        itemCard.style.borderRadius = 'var(--border-radius-md)';
        itemCard.style.display = 'flex';
        itemCard.style.alignItems = 'center';
        itemCard.style.justifyContent = 'center';
        itemCard.style.padding = '6px';
        itemCard.style.boxShadow = 'var(--shadow-soft)';
        itemCard.style.border = '1px solid rgba(62, 58, 53, 0.05)';
        
        itemCard.innerHTML = `
            <img src="${item.image}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            <button class="btn-delete-garment" data-id="${item.id}" style="position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: var(--color-danger); color: white; border: 2px solid white; font-size: 9px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: var(--transition-smooth);"><i class="fa-solid fa-xmark"></i></button>
        `;

        // Eliminar prenda
        itemCard.querySelector('.btn-delete-garment').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`¿Estás seguro de que quieres eliminar esta prenda de tu Ropero?`)) {
                await deleteGarment(item.id);
                await loadRoperoGalleries();
                if (onGarmentSavedCallback) onGarmentSavedCallback();
            }
        });

        galleryEl.appendChild(itemCard);
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
        const tolerance = parseInt(document.getElementById('input-bg-tolerance').value);
        processImage(originalImageSrc, tolerance);
        document.getElementById('tolerance-control-container').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function processImage(imageSrc, tolerance) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

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

        const corners = [
            getPixel(imgData, 0, 0),
            getPixel(imgData, w - 1, 0),
            getPixel(imgData, 0, h - 1),
            getPixel(imgData, w - 1, h - 1),
            getPixel(imgData, Math.floor(w / 2), 0)
        ];

        let bgR = 0, bgG = 0, bgB = 0;
        corners.forEach(c => {
            bgR += c.r;
            bgG += c.g;
            bgB += c.b;
        });
        bgR = Math.floor(bgR / corners.length);
        bgG = Math.floor(bgG / corners.length);
        bgB = Math.floor(bgB / corners.length);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const distance = Math.sqrt(
                Math.pow(r - bgR, 2) +
                Math.pow(g - bgG, 2) +
                Math.pow(b - bgB, 2)
            );

            if (distance < tolerance) {
                data[i + 3] = 0;
            } else {
                const edgeSoftness = 10;
                if (distance < tolerance + edgeSoftness) {
                    const alphaRatio = (distance - tolerance) / edgeSoftness;
                    data[i + 3] = Math.floor(alphaRatio * 255);
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        processedImageBase64 = cropTransparency(canvas);
        
        previewImg.src = processedImageBase64;
        processingBadge.classList.add('hidden');
        validateForm();
    };
    img.src = imageSrc;
}

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
    const category = hiddenCategoryInput.value;
    const style = selectStyle.value;
    const weather = selectWeather.value;
    const color = inputColor.value;

    if (!name || !processedImageBase64) return;

    btnSaveGarment.disabled = true;
    btnSaveGarment.innerText = 'Guardando...';

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
        await loadRoperoGalleries();
        closeUploadModal();
        
        if (onGarmentSavedCallback) onGarmentSavedCallback();
    } catch (e) {
        alert('Error al guardar: ' + e.message);
        btnSaveGarment.disabled = false;
    } finally {
        btnSaveGarment.innerText = 'Guardar en mi Ropero';
    }
}
