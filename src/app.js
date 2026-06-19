import { initCanvas, setProfileData } from './components/canvas.js';
import { initCalibrator } from './components/calibrator.js';
import { initArmario } from './components/armario.js';
import { initCloset, loadClosetData } from './components/closet.js';
import { getProfile } from './utils/db.js';

// Elementos de navegación
let navCloset = null;
let navArmario = null;
let navProfile = null;

let screenCloset = null;
let screenArmario = null;
let screenProfile = null;

let canvasEmptyState = null;
let btnGoToProfileEmpty = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Vincular elementos de navegación del DOM
    navCloset = document.getElementById('nav-closet');
    navArmario = document.getElementById('nav-armario');
    navProfile = document.getElementById('nav-profile');

    screenCloset = document.getElementById('screen-closet');
    screenArmario = document.getElementById('screen-armario');
    screenProfile = document.getElementById('screen-profile');

    canvasEmptyState = document.getElementById('canvas-empty-state');
    btnGoToProfileEmpty = document.getElementById('btn-go-to-profile-empty');

    // Escuchadores de pestañas de navegación
    navCloset.addEventListener('click', () => switchScreen('closet'));
    navArmario.addEventListener('click', () => switchScreen('armario'));
    navProfile.addEventListener('click', () => switchScreen('profile'));

    btnGoToProfileEmpty.addEventListener('click', () => switchScreen('profile'));

    // 2. Inicializar los sub-módulos de la aplicación
    initCanvas();
    
    // Callback cuando se guarda o elimina la silueta en Perfil
    initCalibrator(async () => {
        await refreshProfileState();
    });

    // Callback cuando se guarda una prenda nueva en Armario
    initArmario(async () => {
        await loadClosetData(); // Recargar el carrusel
        switchScreen('closet'); // Llevar al probador para verla
    });

    // Inicializar el Closet (carruseles y sugerencias)
    initCloset();

    // 3. Cargar estado del perfil al iniciar
    await refreshProfileState();
});

// Función centralizada para alternar pantallas de la SPA
function switchScreen(screenName) {
    // Limpiar clases active
    navCloset.classList.remove('active');
    navArmario.classList.remove('active');
    navProfile.classList.remove('active');

    screenCloset.classList.remove('active');
    screenArmario.classList.remove('active');
    screenProfile.classList.remove('active');

    // Activar pantalla elegida
    if (screenName === 'closet') {
        navCloset.classList.add('active');
        screenCloset.classList.add('active');
        // Refrescar carrusel y probador al entrar
        loadClosetData();
    } else if (screenName === 'armario') {
        navArmario.classList.add('active');
        screenArmario.classList.add('active');
    } else if (screenName === 'profile') {
        navProfile.classList.add('active');
        screenProfile.classList.add('active');
    }
}

// Carga el perfil actual de la base de datos y configura el probador
async function refreshProfileState() {
    try {
        const profile = await getProfile();
        if (profile && profile.image && profile.points && profile.points.some(p => p !== null)) {
            // Silueta disponible y calibrada: cargarla en canvas y ocultar vacío
            setProfileData(profile.image, profile.points);
            canvasEmptyState.classList.add('hidden');
        } else {
            // Sin silueta: vaciar canvas y mostrar overlay instructivo
            setProfileData(null, null);
            canvasEmptyState.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Error al actualizar estado del perfil:', e);
        setProfileData(null, null);
        canvasEmptyState.classList.remove('hidden');
    }
}
