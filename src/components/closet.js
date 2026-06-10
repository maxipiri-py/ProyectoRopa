import { getGarments } from '../utils/db.js';
import { updateCanvasOutfit } from './canvas.js';

// Listas locales de prendas
let tops = [];
let bottoms = [];

// Índices actuales de los carruseles
let currentTopIndex = -1;
let currentBottomIndex = -1;

// Elementos DOM de carruseles
let trackTops = null;
let trackBottoms = null;
let labelTopName = null;
let labelBottomName = null;

// Elementos del Modal de Sugerencias
let modal = null;
let btnOpenModal = null;
let btnCloseModal = null;
let btnGenerate = null;
let btnApply = null;
let resultBox = null;

// Estado temporal de la sugerencia encontrada
let suggestedTop = null;
let suggestedBottom = null;

export function initCloset() {
    // Vinculación de DOM
    trackTops = document.getElementById('track-tops');
    trackBottoms = document.getElementById('track-bottoms');
    labelTopName = document.getElementById('label-top-name');
    labelBottomName = document.getElementById('label-bottom-name');

    modal = document.getElementById('modal-suggestion');
    btnOpenModal = document.getElementById('btn-suggest-outfit');
    btnCloseModal = document.getElementById('btn-close-modal');
    btnGenerate = document.getElementById('btn-generate-outfit');
    btnApply = document.getElementById('btn-apply-suggestion');
    resultBox = document.getElementById('suggestion-result');

    // Navegación carrusel superior
    document.getElementById('btn-top-prev').addEventListener('click', () => navigateCarousel('top', -1));
    document.getElementById('btn-top-next').addEventListener('click', () => navigateCarousel('top', 1));

    // Navegación carrusel inferior
    document.getElementById('btn-bottom-prev').addEventListener('click', () => navigateCarousel('bottom', -1));
    document.getElementById('btn-bottom-next').addEventListener('click', () => navigateCarousel('bottom', 1));

    // Modal
    btnOpenModal.addEventListener('click', openSuggestionModal);
    btnCloseModal.addEventListener('click', closeSuggestionModal);
    btnGenerate.addEventListener('click', handleGenerateSuggestion);
    btnApply.addEventListener('click', applySuggestionToCloset);

    // Selección de chips de filtro
    setupFilterChips();

    // Cargar datos por primera vez
    loadClosetData();
}

export async function loadClosetData() {
    try {
        const allGarments = await getGarments();
        
        // Separar prendas por categoría
        tops = allGarments.filter(g => g.category === 'top');
        bottoms = allGarments.filter(g => g.category === 'bottom');

        // Renderizar pistas
        renderTrack('top', tops, trackTops);
        renderTrack('bottom', bottoms, trackBottoms);

        // Inicializar índices
        currentTopIndex = tops.length > 0 ? 0 : -1;
        currentBottomIndex = bottoms.length > 0 ? 0 : -1;

        // Actualizar visuales
        updateCarouselView('top');
        updateCarouselView('bottom');
        
        // Sincronizar con el Probador (Canvas)
        syncOutfitCanvas();

    } catch (e) {
        console.error('Error al cargar armario:', e);
    }
}

function renderTrack(type, items, trackElement) {
    trackElement.innerHTML = '';
    
    if (items.length === 0) {
        trackElement.innerHTML = `
            <div class="carousel-item">
                <div class="carousel-item-empty">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Sube prendas de tipo ${type === 'top' ? 'superior' : 'inferior'}</span>
                </div>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const slide = document.createElement('div');
        slide.className = 'carousel-item';
        slide.innerHTML = `<img src="${item.image}" alt="${item.name}" data-id="${item.id}">`;
        trackElement.appendChild(slide);
    });
}

function navigateCarousel(type, direction) {
    const items = type === 'top' ? tops : bottoms;
    if (items.length <= 1) return;

    let index = type === 'top' ? currentTopIndex : currentBottomIndex;
    
    // Movimiento circular
    index += direction;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    if (type === 'top') {
        currentTopIndex = index;
    } else {
        currentBottomIndex = index;
    }

    updateCarouselView(type);
    syncOutfitCanvas();
}

function updateCarouselView(type) {
    const items = type === 'top' ? tops : bottoms;
    const index = type === 'top' ? currentTopIndex : currentBottomIndex;
    const track = type === 'top' ? trackTops : trackBottoms;
    const label = type === 'top' ? labelTopName : labelBottomName;

    if (index === -1 || items.length === 0) {
        label.innerText = 'Ninguna';
        track.style.transform = 'translateX(0)';
        return;
    }

    // Trasladar la pista del carrusel (100% de ancho por elemento)
    track.style.transform = `translateX(-${index * 100}%)`;
    label.innerText = items[index].name;
}

function syncOutfitCanvas() {
    const activeTop = currentTopIndex !== -1 ? tops[currentTopIndex] : null;
    const activeBottom = currentBottomIndex !== -1 ? bottoms[currentBottomIndex] : null;
    updateCanvasOutfit(activeTop, activeBottom);
}

// --- LOGICA DEL SUGERIDOR DE OUTFITS ---

function openSuggestionModal() {
    modal.classList.add('active');
    resultBox.classList.add('hidden');
    
    // Restablecer chips activos a "Todos"
    document.querySelectorAll('.chip').forEach(c => {
        if (c.getAttribute('data-value') === 'any') {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
}

function closeSuggestionModal() {
    modal.classList.remove('active');
}

function setupFilterChips() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const filterType = e.target.getAttribute('data-filter');
            // Desactivar chips de la misma categoría
            document.querySelectorAll(`.chip[data-filter="${filterType}"]`).forEach(c => {
                c.classList.remove('active');
            });
            e.target.classList.add('active');
        });
    });
}

function handleGenerateSuggestion() {
    if (tops.length === 0 || bottoms.length === 0) {
        alert('Necesitas subir al menos una parte superior y una parte inferior en tu armario para generar sugerencias.');
        return;
    }

    const activeStyle = document.querySelector('.chip[data-filter="style"].active').getAttribute('data-value');
    const activeWeather = document.querySelector('.chip[data-filter="weather"].active').getAttribute('data-value');

    // 1. Filtrar prendas por estilo y clima
    let filteredTops = tops;
    let filteredBottoms = bottoms;

    if (activeStyle !== 'any') {
        filteredTops = filteredTops.filter(g => g.style === activeStyle);
        filteredBottoms = filteredBottoms.filter(g => g.style === activeStyle);
    }
    if (activeWeather !== 'any') {
        filteredTops = filteredTops.filter(g => g.weather === activeWeather);
        filteredBottoms = filteredBottoms.filter(g => g.weather === activeWeather);
    }

    // Fallback: Si no hay prendas que cumplan exactamente, usar toda la colección y avisar
    let matchWarning = false;
    if (filteredTops.length === 0 || filteredBottoms.length === 0) {
        filteredTops = tops;
        filteredBottoms = bottoms;
        matchWarning = true;
    }

    // 2. Elegir aleatoriamente entre los resultados que encajan
    suggestedTop = filteredTops[Math.floor(Math.random() * filteredTops.length)];
    suggestedBottom = filteredBottoms[Math.floor(Math.random() * filteredBottoms.length)];

    // 3. Mostrar el resultado
    const msgEl = document.getElementById('suggestion-message');
    const styleTag = document.getElementById('match-tag-style');
    const weatherTag = document.getElementById('match-tag-weather');

    if (matchWarning) {
        msgEl.innerHTML = `⚠️ <small>No encontramos prendas con esos filtros específicos, pero te sugerimos esta opción alternativa:</small><br><strong>${suggestedTop.name} + ${suggestedBottom.name}</strong>`;
    } else {
        msgEl.innerHTML = `¡Combinación Perfecta!<br><strong>${suggestedTop.name} y ${suggestedBottom.name}</strong>`;
    }

    // Actualizar badges
    styleTag.innerText = suggestedTop.style;
    weatherTag.innerText = getFriendlyWeatherName(suggestedTop.weather);

    resultBox.classList.remove('hidden');
}

function getFriendlyWeatherName(weather) {
    switch(weather) {
        case 'calido': return 'Cálido ☀️';
        case 'templado': return 'Templado ⛅';
        case 'frio': return 'Frío ❄️';
        default: return weather;
    }
}

function applySuggestionToCloset() {
    if (!suggestedTop || !suggestedBottom) return;

    // Buscar los índices de las prendas sugeridas en las listas principales
    const topIdx = tops.findIndex(g => g.id === suggestedTop.id);
    const bottomIdx = bottoms.findIndex(g => g.id === suggestedBottom.id);

    if (topIdx !== -1) currentTopIndex = topIdx;
    if (bottomIdx !== -1) currentBottomIndex = bottomIdx;

    // Actualizar vistas y canvas
    updateCarouselView('top');
    updateCarouselView('bottom');
    syncOutfitCanvas();

    closeSuggestionModal();
}
