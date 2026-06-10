// --- MÓDULO DE BASE DE DATOS LOCAL (IndexedDB) ---
const DB_NAME = 'ChersClosetDB';
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Almacén para el perfil (foto de cuerpo y puntos de calibración)
            if (!db.objectStoreNames.contains('profile')) {
                db.createObjectStore('profile', { keyPath: 'id' });
            }

            // Almacén para las prendas individuales
            if (!db.objectStoreNames.contains('clothes')) {
                db.createObjectStore('clothes', { keyPath: 'id', autoIncrement: true });
            }

            // Almacén para los outfits guardados
            if (!db.objectStoreNames.contains('outfits')) {
                db.createObjectStore('outfits', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('Error al abrir IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// --- MÉTODOS DE PERFIL (FOTO DE CUERPO & CALIBRACIÓN) ---
export async function saveProfile(imageSrc, points) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('profile', 'readwrite');
        const store = transaction.objectStore('profile');
        const request = store.put({ id: 'user_profile', image: imageSrc, points: points, updatedAt: Date.now() });

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getProfile() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('profile', 'readonly');
        const store = transaction.objectStore('profile');
        const request = store.get('user_profile');

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function deleteProfile() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('profile', 'readwrite');
        const store = transaction.objectStore('profile');
        const request = store.delete('user_profile');

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- MÉTODOS DE PRENDAS (CLOTHES) ---
export async function addGarment(garment) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('clothes', 'readwrite');
        const store = transaction.objectStore('clothes');
        const request = store.add(garment);

        request.onsuccess = (e) => resolve(e.target.result); // Retorna el ID autoincrementado
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getGarments() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('clothes', 'readonly');
        const store = transaction.objectStore('clothes');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function deleteGarment(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('clothes', 'readwrite');
        const store = transaction.objectStore('clothes');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- MÉTODOS DE OUTFITS ---
export async function saveOutfit(outfit) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('outfits', 'readwrite');
        const store = transaction.objectStore('outfits');
        const request = store.add(outfit);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getOutfits() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('outfits', 'readonly');
        const store = transaction.objectStore('outfits');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
    });
}
