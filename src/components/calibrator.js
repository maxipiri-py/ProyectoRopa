import { saveProfile, getProfile, deleteProfile } from '../utils/db.js';

// --- CONFIGURACIÓN DEL CALIBRADOR ---
const POINT_NAMES = [
    'Hombro Izquierdo',
    'Hombro Derecho',
    'Cadera Izquierda',
    'Cadera Derecha',
    'Rodilla Izquierda',
    'Rodilla Derecha',
    'Tobillo Izquierdo',
    'Tobillo Derecho'
];

let calibrationPoints = []; // Almacenará { x: 0..1, y: 0..1 }
let loadedImageBase64 = null;
let currentStep = 0;

// Elementos DOM
let uploadArea = null;
let fileInput = null;
let wrapper = null;
let imgElement = null;
let pointsContainer = null;
let guideText = null;
let btnSave = null;
let btnDelete = null;
let btnReset = null;

// Callback para avisar a la app que el perfil cambió
let onProfileChangedCallback = null;

export function initCalibrator(onProfileChanged) {
    onProfileChangedCallback = onProfileChanged;

    // Vinculación de elementos DOM
    uploadArea = document.getElementById('profile-upload-area');
    fileInput = document.getElementById('input-profile-file');
    wrapper = document.getElementById('calibration-canvas-wrapper');
    imgElement = document.getElementById('calibration-img');
    pointsContainer = document.getElementById('calibration-points-container');
    guideText = document.getElementById('current-point-guide');
    btnSave = document.getElementById('btn-save-profile');
    btnDelete = document.getElementById('btn-delete-profile');
    btnReset = document.getElementById('btn-reset-calibration');

    // Escuchadores
    fileInput.addEventListener('change', handleFileSelect);
    pointsContainer.addEventListener('click', handleImageClick);
    btnReset.addEventListener('click', resetCalibration);
    btnSave.addEventListener('click', handleSaveProfile);
    btnDelete.addEventListener('click', handleDeleteProfile);

    // Cargar perfil existente si lo hay
    loadExistingProfile();
}

async function loadExistingProfile() {
    try {
        const profile = await getProfile();
        if (profile) {
            loadedImageBase64 = profile.image;
            calibrationPoints = profile.points;
            
            // Mostrar imagen cargada
            imgElement.src = loadedImageBase64;
            uploadArea.classList.add('hidden');
            wrapper.classList.remove('hidden');
            
            // Dibujar los puntos guardados
            renderSavedPoints();
            
            // Habilitar controles correspondientes
            currentStep = calibrationPoints.length;
            updateCalibrationUI();
            btnDelete.classList.remove('hidden');
        } else {
            resetCalibration();
            btnDelete.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error al cargar perfil:', e);
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        loadedImageBase64 = e.target.result;
        
        // Mostrar indicador de carga de IA
        const loadingOverlay = document.getElementById('calibration-loading-overlay');
        loadingOverlay.classList.remove('hidden');
        uploadArea.classList.add('hidden');
        wrapper.classList.add('hidden');
        
        imgElement.onload = async () => {
            try {
                // Ejecutar detección automática por IA
                await runPoseNetDetection();
            } catch (err) {
                console.error("Error en detección automática de IA, activando fallback manual:", err);
                alert("La IA no pudo detectar tu cuerpo automáticamente de forma completa. Por favor, marca los 8 puntos manualmente tocando sobre la foto.");
                resetCalibration();
            } finally {
                loadingOverlay.classList.add('hidden');
                wrapper.classList.remove('hidden');
                imgElement.onload = null; // Limpiar escuchador
            }
        };
        imgElement.src = loadedImageBase64;
    };
    reader.readAsDataURL(file);
}

async function runPoseNetDetection() {
    if (!window.posenet) {
        throw new Error("PoseNet no está cargado. Asegúrate de estar conectado a internet.");
    }

    // Cargar modelo optimizado
    const net = await window.posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: 257,
        multiplier: 0.75
    });

    // Estimar pose de la silueta
    const pose = await net.estimateSinglePose(imgElement, {
        flipHorizontal: false
    });

    if (!pose || !pose.keypoints) {
        throw new Error("No se pudo detectar pose");
    }

    const findKeypoint = (name) => pose.keypoints.find(k => k.part === name);

    // Listado de puntos en el orden exacto esperado por la app
    const requiredParts = [
        'leftShoulder',
        'rightShoulder',
        'leftHip',
        'rightHip',
        'leftKnee',
        'rightKnee',
        'leftAnkle',
        'rightAnkle'
    ];

    const w = imgElement.naturalWidth;
    const h = imgElement.naturalHeight;

    calibrationPoints = [];
    pointsContainer.innerHTML = '';

    requiredParts.forEach((part, index) => {
        const kp = findKeypoint(part);
        // Exigir un puntaje mínimo de confianza para evitar falsos positivos
        if (kp && kp.score > 0.15) {
            const x = kp.position.x / w;
            const y = kp.position.y / h;
            calibrationPoints.push({ x, y });
            drawPointMarker(x, y, index + 1);
        } else {
            throw new Error(`Punto débil o faltante: ${part}`);
        }
    });

    currentStep = 8;
    updateCalibrationUI();
}

function handleImageClick(event) {
    if (currentStep >= 8) return; // Ya se completaron los 8 puntos

    // Obtener dimensiones reales del contenedor del canvas/imagen de calibración
    const rect = pointsContainer.getBoundingClientRect();
    
    // Coordenadas del click relativas al contenedor (0 a 1)
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Agregar punto
    calibrationPoints.push({ x, y });
    
    // Crear marcador visual
    drawPointMarker(x, y, currentStep + 1);

    currentStep++;
    updateCalibrationUI();
}

function drawPointMarker(xPercent, yPercent, number) {
    const marker = document.createElement('div');
    marker.className = 'calib-point';
    marker.style.left = `${xPercent * 100}%`;
    marker.style.top = `${yPercent * 100}%`;
    marker.innerText = number;
    pointsContainer.appendChild(marker);
}

function renderSavedPoints() {
    pointsContainer.innerHTML = '';
    calibrationPoints.forEach((pt, index) => {
        drawPointMarker(pt.x, pt.y, index + 1);
    });
}

function updateCalibrationUI() {
    if (currentStep < 8) {
        guideText.parentElement.classList.remove('hidden');
        guideText.innerText = POINT_NAMES[currentStep];
        btnSave.disabled = true;
    } else {
        guideText.parentElement.classList.add('hidden');
        btnSave.disabled = false; // Habilita guardar
    }
}

function resetCalibration() {
    calibrationPoints = [];
    currentStep = 0;
    pointsContainer.innerHTML = '';
    updateCalibrationUI();
}

async function handleSaveProfile() {
    if (calibrationPoints.length < 8 || !loadedImageBase64) return;

    try {
        await saveProfile(loadedImageBase64, calibrationPoints);
        btnDelete.classList.remove('hidden');
        alert('¡Silueta calibrada guardada correctamente!');
        if (onProfileChangedCallback) onProfileChangedCallback();
    } catch (e) {
        alert('Error al guardar el perfil: ' + e.message);
    }
}

async function handleDeleteProfile() {
    if (!confirm('¿Estás seguro de que quieres eliminar tu silueta actual?')) return;

    try {
        await deleteProfile();
        loadedImageBase64 = null;
        calibrationPoints = [];
        currentStep = 0;
        
        // Limpiar UI
        pointsContainer.innerHTML = '';
        imgElement.src = '';
        wrapper.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        btnDelete.classList.add('hidden');
        fileInput.value = '';
        
        updateCalibrationUI();
        if (onProfileChangedCallback) onProfileChangedCallback();
    } catch (e) {
        alert('Error al eliminar el perfil: ' + e.message);
    }
}
