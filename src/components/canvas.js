// --- MÓDULO DE RENDERIZADO DEL PROBADOR (CANVAS) ---

let canvas = null;
let ctx = null;

// Datos del perfil del usuario
let bodyImage = null; // Objeto Image de HTML
let calibrationPoints = null; // Array de 4 puntos [{x, y}]

// Datos de las prendas seleccionadas
let topImage = null;
let bottomImage = null;

// Ajustes automáticos fijos (sin desplazamiento ni escalado manual)
const topFit = { scale: 1.0, xOffset: 0, yOffset: 0 };
const bottomFit = { scale: 1.0, xOffset: 0, yOffset: 0 };

export function initCanvas() {
    canvas = document.getElementById('outfit-canvas');
    ctx = canvas.getContext('2d');

    // Manejar el redimensionamiento dinámico
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Conectar botón de descargar outfit
    const btnDownload = document.getElementById('btn-download-outfit');
    if (btnDownload) {
        btnDownload.addEventListener('click', downloadOutfit);
    }
}

function downloadOutfit() {
    if (!canvas) return;
    
    if (!bodyImage) {
        alert("Por favor, configura tu silueta en la pestaña de Perfil antes de descargar un outfit.");
        return;
    }
    
    try {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `outfit_${Date.now()}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Error al descargar la imagen:", err);
        alert("No se pudo descargar la imagen directamente. Si estás en celular, puedes intentar mantener presionada la imagen para guardarla.");
    }
}

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    
    // Configurar resolución interna de dibujo del Canvas
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    draw();
}



export function setProfileData(imageSrc, points) {
    if (!imageSrc) {
        bodyImage = null;
        calibrationPoints = null;
        draw();
        return;
    }

    bodyImage = new Image();
    bodyImage.onload = () => {
        calibrationPoints = points;
        draw();
    };
    bodyImage.src = imageSrc;
}

export function updateCanvasOutfit(topGarment, bottomGarment) {
    // Si hay prenda superior
    if (topGarment && topGarment.image) {
        topImage = new Image();
        topImage.onload = draw;
        topImage.src = topGarment.image;
    } else {
        topImage = null;
    }

    // Si hay prenda inferior
    if (bottomGarment && bottomGarment.image) {
        bottomImage = new Image();
        bottomImage.onload = draw;
        bottomImage.src = bottomGarment.image;
    } else {
        bottomImage = null;
    }

    draw();
}



// --- FUNCIÓN DE DIBUJO ---
function draw() {
    if (!ctx || !canvas) return;

    // 1. Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Dibujar fondo (Crema suave para coincidir con la app)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!bodyImage) return;

    // 3. Dibujar silueta del usuario escalada proporcionalmente al canvas
    const imgRatio = bodyImage.width / bodyImage.height;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawW, drawH, drawX, drawY;

    if (imgRatio > canvasRatio) {
        // La imagen es más ancha que el canvas
        drawW = canvas.width;
        drawH = canvas.width / imgRatio;
        drawX = 0;
        drawY = (canvas.height - drawH) / 2;
    } else {
        // La imagen es más alta que el canvas
        drawH = canvas.height;
        drawW = canvas.height * imgRatio;
        drawX = (canvas.width - drawW) / 2;
        drawY = 0;
    }

    ctx.drawImage(bodyImage, drawX, drawY, drawW, drawH);

    // Si no hay puntos de calibración, no podemos dibujar la ropa con precisión
    if (!calibrationPoints || calibrationPoints.length < 8) return;

    // Convertir puntos porcentuales a coordenadas reales en el canvas
    const getRealCoords = (pt) => {
        return {
            x: drawX + pt.x * drawW,
            y: drawY + pt.y * drawH
        };
    };

    const ptHombroIzq = getRealCoords(calibrationPoints[0]);
    const ptHombroDer = getRealCoords(calibrationPoints[1]);
    const ptCaderaIzq = getRealCoords(calibrationPoints[2]);
    const ptCaderaDer = getRealCoords(calibrationPoints[3]);
    const ptRodillaIzq = getRealCoords(calibrationPoints[4]);
    const ptRodillaDer = getRealCoords(calibrationPoints[5]);
    const ptTobilloIzq = getRealCoords(calibrationPoints[6]);
    const ptTobilloDer = getRealCoords(calibrationPoints[7]);

    // Calcular centros y dimensiones del cuerpo
    const shoulderWidth = Math.abs(ptHombroDer.x - ptHombroIzq.x);
    const hipWidth = Math.abs(ptCaderaDer.x - ptCaderaIzq.x);
    
    const hombrosMidX = (ptHombroIzq.x + ptHombroDer.x) / 2;
    const hombrosMidY = (ptHombroIzq.y + ptHombroDer.y) / 2;
    
    const caderasMidX = (ptCaderaIzq.x + ptCaderaDer.x) / 2;
    const caderasMidY = (ptCaderaIzq.y + ptCaderaDer.y) / 2;

    const tobillosMidY = (ptTobilloIzq.y + ptTobilloDer.y) / 2;

    // --- DIBUJAR PARTE INFERIOR ---
    if (bottomImage && bottomImage.complete) {
        const bottomRatio = bottomImage.width / bottomImage.height;
        const legsH = tobillosMidY - caderasMidY;
        
        // El ancho de la prenda inferior se escala en relación con el ancho de la cadera
        const bottomW = hipWidth * 1.45 * bottomFit.scale; 
        
        let bottomH;
        if (bottomRatio > 0.72) {
            // Es una prenda corta (shorts, falda corta, bermudas):
            // Preservamos la relación de aspecto original para que no se estire hasta los tobillos
            bottomH = bottomW / bottomRatio;
        } else {
            // Es una prenda larga (jeans, pantalones):
            // Se acomoda automáticamente al largo de las piernas del perfil
            bottomH = legsH * 1.05 * bottomFit.scale;
        }

        const x = caderasMidX - bottomW / 2 + bottomFit.xOffset;
        // La prenda inferior comienza en la cadera/cintura del perfil
        const y = caderasMidY - bottomH * 0.03 + bottomFit.yOffset;

        ctx.drawImage(bottomImage, x, y, bottomW, bottomH);
    }

    // --- DIBUJAR PARTE SUPERIOR ---
    if (topImage && topImage.complete) {
        const topRatio = topImage.width / topImage.height;
        const torsoH = caderasMidY - hombrosMidY;
        
        // El ancho de la prenda superior se escala en relación con el ancho de los hombros
        const topW = shoulderWidth * 1.45 * topFit.scale;
        
        let topH;
        if (topRatio > 1.25) {
            // Prenda muy corta/ancha (crop top, accesorio):
            // Preservamos la relación de aspecto original para no estirarla de más
            topH = topW / topRatio;
        } else {
            // Prenda de longitud normal o larga (camisas, chaquetas, camisetas):
            // Se acomoda automáticamente al largo del torso del perfil
            topH = torsoH * 1.2 * topFit.scale;
        }

        const x = hombrosMidX - topW / 2 + topFit.xOffset;
        // Se desplaza levemente hacia arriba del hombro para cubrir el cuello naturalmente
        const y = hombrosMidY - topH * 0.1 + topFit.yOffset;

        ctx.drawImage(topImage, x, y, topW, topH);
    }
}
