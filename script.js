
import { db, firebaseConfig } from "./firebase.js?v=20260413a";
import { collection, addDoc, getDocs, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { storage } from "./firebase.js?v=20260413a";

const ALLOW_INLINE_FALLBACK = ["localhost", "127.0.0.1"].includes(window.location.hostname);

function getSiteNoticeHost() {
    let host = document.getElementById("siteNoticeHost");
    if (host) return host;

    host = document.createElement("div");
    host.id = "siteNoticeHost";
    host.style.position = "fixed";
    host.style.top = "18px";
    host.style.right = "18px";
    host.style.zIndex = "9999";
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.gap = "10px";
    host.style.maxWidth = "min(92vw, 360px)";
    document.body.appendChild(host);
    return host;
}

function notifySite(message, type = "info", timeoutMs = 3600) {
    const colors = {
        info: "#3b82f6",
        success: "#16a34a",
        warning: "#d97706",
        error: "#dc2626"
    };

    const host = getSiteNoticeHost();
    const item = document.createElement("div");
    item.style.background = "#0f172a";
    item.style.color = "#e2e8f0";
    item.style.border = `1px solid ${colors[type] || colors.info}`;
    item.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    item.style.borderRadius = "10px";
    item.style.padding = "10px 12px";
    item.style.boxShadow = "0 8px 20px rgba(0,0,0,0.28)";
    item.style.fontSize = "13px";
    item.style.lineHeight = "1.4";
    item.textContent = message;

    host.appendChild(item);
    setTimeout(() => item.remove(), timeoutMs);
}

function closeTrackingCodeModal() {
    document.getElementById("trackingCodeModal")?.remove();
}

function nombreCompletoValido(nombre) {
    const limpio = String(nombre || "").trim().replace(/\s+/g, " ");
    if (!limpio) return false;

    const partes = limpio.split(" ");
    if (partes.length < 2) return false;

    return partes.every(parte => parte.length >= 2);
}

function showTrackingCodeModal({ codigo, nombre, telefono, servicio, monto, urgencia }) {
    closeTrackingCodeModal();

    const modal = document.createElement("div");
    modal.id = "trackingCodeModal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(2,6,23,0.72)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "10000";

    modal.innerHTML = `
        <div style="position:relative; width:min(92vw, 520px); background:#0b1220; border:1px solid #334155; border-radius:14px; padding:18px; box-shadow:0 16px 36px rgba(0,0,0,0.4); color:#e2e8f0;">
            <div style="display:flex; align-items:center; justify-content:space-between; min-height:32px; margin-bottom:12px;">
                <h3 style="margin:0; font-size:18px; color:#f8fafc;">Solicitud enviada</h3>
                <button id="closeTrackingCodeModal" style="border:none; background:#1e293b; color:#cbd5e1; border-radius:8px; width:32px; height:32px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; transform:translateY(-5px);">×</button>
            </div>

            <p style="margin:0 0 10px; color:#93c5fd;">Tu código de seguimiento es:</p>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px;">
                <div id="trackingCodeValue" style="flex:1; min-height:66px; background:#0f172a; border:1px dashed #60a5fa; border-radius:10px; padding:10px 12px; font-size:36px; font-weight:800; letter-spacing:1px; color:#dbeafe; text-align:center; display:flex; align-items:center; justify-content:center;">${codigo}</div>
                <button id="copyTrackingCodeBtn" style="height:44px; border:none; background:#2563eb; color:white; border-radius:10px; padding:8px 14px; cursor:pointer; font-weight:700; min-width:88px; display:inline-flex; align-items:center; justify-content:center; margin:0;">Copiar</button>
            </div>

            <div style="font-size:13px; color:#cbd5e1; line-height:1.55; background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:12px;">
                <div><b>Cliente:</b> ${nombre}</div>
                <div><b>WhatsApp:</b> ${telefono}</div>
                <div><b>Servicio:</b> ${servicio}</div>
                <div><b>Monto:</b> S/. ${Number(monto || 0).toFixed(2)}</div>
                <div><b>Urgencia:</b> ${urgencia}</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeTrackingCodeModal();
    });

    document.getElementById("closeTrackingCodeModal")?.addEventListener("click", closeTrackingCodeModal);
    document.getElementById("copyTrackingCodeBtn")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(codigo);
            notifySite("Código copiado al portapapeles.", "success", 2200);
        } catch (_) {
            notifySite("No se pudo copiar automáticamente. Copia el código manualmente.", "warning", 3000);
        }
    });
}

function withTimeout(promise, ms, errorMessage) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}`));
        reader.readAsDataURL(file);
    });
}

async function generarAdjuntosInline(files) {
    const maxFiles = 1;
    const maxFileBytes = 220 * 1024;
    const lista = Array.from(files || []).slice(0, maxFiles);
    const inline = [];

    for (const file of lista) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > maxFileBytes) continue;

        const dataUrl = await fileToDataUrl(file);
        inline.push({
            nombre: file.name,
            tipo: file.type,
            tamaño: file.size,
            url: dataUrl,
            inline: true
        });
    }

    return inline;
}

function toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };

    if (value instanceof Date) {
        return { timestampValue: value.toISOString() };
    }

    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map(item => toFirestoreValue(item))
            }
        };
    }

    const valueType = typeof value;

    if (valueType === "string") return { stringValue: value };
    if (valueType === "boolean") return { booleanValue: value };

    if (valueType === "number") {
        if (Number.isInteger(value)) return { integerValue: String(value) };
        return { doubleValue: value };
    }

    if (valueType === "object") {
        const fields = {};

        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                fields[key] = toFirestoreValue(value[key]);
            }
        });

        return { mapValue: { fields } };
    }

    return { stringValue: String(value) };
}

async function crearSolicitudPorRest(solicitud) {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/solicitudes?key=${firebaseConfig.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const fields = {};
        Object.keys(solicitud).forEach(key => {
            if (solicitud[key] !== undefined) {
                fields[key] = toFirestoreValue(solicitud[key]);
            }
        });

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ fields }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`REST Firestore falló: ${response.status} ${errorBody}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

function obtenerIdDesdeRest(restResponse) {
    const name = restResponse?.name || "";
    const partes = name.split("/");
    return partes.length ? partes[partes.length - 1] : "";
}

async function actualizarArchivosPorRest(docId, archivos) {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/solicitudes/${docId}?updateMask.fieldPaths=archivos&key=${firebaseConfig.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(endpoint, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fields: {
                    archivos: toFirestoreValue(archivos)
                }
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`No se pudo actualizar archivos por REST: ${response.status} ${errorBody}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}


const images = document.querySelectorAll(".slider img");
let index = 0;

function changeSlide() {
    if (!images.length) return;

    images[index].classList.remove("active");

    index = (index + 1) % images.length;

    images[index].classList.add("active");
}


if (images.length > 0) {
    setInterval(changeSlide, 4000);
}


window.addEventListener("scroll", () => {
    const header = document.getElementById("header");

    if (!header) return;

    if (window.scrollY > 50) {
        header.style.background = "rgba(10,15,25,0.95)";
    } else {
        header.style.background = "rgba(10,15,25,0.6)";
    }
});


window.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Aplicación iniciada");

    const whatsappBtn = document.querySelector(".whatsapp-btn");
    const footer = document.querySelector("footer");

    if (whatsappBtn && footer && "IntersectionObserver" in window) {
        const footerObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                whatsappBtn.classList.toggle("footer-visible", entry.isIntersecting);
            });
        }, {
            threshold: 0.15
        });

        footerObserver.observe(footer);
    }

    
    serviciosGlobales = [...serviciosPorDefecto];
    renderServiciosIndex(serviciosGlobales);
    renderServiciosSelect(serviciosGlobales);

    
    setTimeout(() => {
        if (typeof db !== 'undefined') {
            cargarServicios();
        }
    }, 1000);

    const form = document.getElementById("solicitudForm");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            let statusEl = document.getElementById("estadoEnvio");
            if (!statusEl) {
                statusEl = document.createElement("p");
                statusEl.id = "estadoEnvio";
                statusEl.style.marginTop = "10px";
                statusEl.style.fontSize = "14px";
                statusEl.style.color = "#cbd5e1";
                form.appendChild(statusEl);
            }

            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Enviando...';
            submitBtn.disabled = true;
            statusEl.textContent = "Enviando solicitud...";

            try {
                let codigo = "CD-" + Math.floor(Math.random() * 100000);

                let nombre = document.getElementById("nombre").value.trim();
                let telefono = document.getElementById("telefono").value.trim();
                let cliente = document.getElementById("clienteTipo").value;
                let servicio = document.getElementById("servicio").value;
                let monto = parseFloat(document.getElementById("monto").value);
                let urgencia = document.getElementById("urgencia").value;
                let tipoTrabajo = document.getElementById("tipoTrabajo").value;
                let entrega = document.getElementById("entrega").value;
                const detalle = document.getElementById("detalle").value.trim();
                const selectedFiles = Array.from(document.getElementById("placaFile")?.files || []);
                const selectedFilesCount = selectedFiles.length;

                
                if (!nombreCompletoValido(nombre)) {
                    notifySite("Ingresa nombre y apellido", "warning");
                    return;
                }

                if (!telefono || telefono.length < 9) {
                    notifySite("Ingresa un número de WhatsApp válido", "warning");
                    return;
                }

                if (!cliente) {
                    notifySite("Selecciona el tipo de cliente", "warning");
                    return;
                }

                if (!servicio) {
                    notifySite("Selecciona un servicio", "warning");
                    return;
                }

                if (!monto || monto <= 0) {
                    notifySite("Ingresa un monto válido", "warning");
                    return;
                }

                if (!urgencia) {
                    notifySite("Selecciona la urgencia del trabajo", "warning");
                    return;
                }

                if (!tipoTrabajo) {
                    notifySite("Selecciona el tipo de trabajo", "warning");
                    return;
                }

                
                if (tipoTrabajo === "personalizado" && !detalle) {
                    notifySite("Para trabajos personalizados, debes describir el caso clínico", "warning");
                    return;
                }

                if (!entrega) {
                    notifySite("Selecciona el método de entrega", "warning");
                    return;
                }

                let solicitud = {
                    codigo,
                    nombre,
                    telefono,
                    cliente,
                    servicio,
                    monto,
                    urgencia,
                    tipoTrabajo,
                    entrega,
                    detalle,
                    archivos: [],
                    estado: "pendiente",
                    fecha: new Date(),
                    fechaCreacion: new Date().toISOString()
                };

                let solicitudId = "";

                try {
                    await withTimeout(
                        crearSolicitudPorRest(solicitud).then((res) => {
                            solicitudId = obtenerIdDesdeRest(res);
                            return res;
                        }),
                        12000,
                        "Tiempo de espera agotado al guardar la solicitud por REST."
                    );
                } catch (restError) {
                    console.warn("REST no respondió, intentando vía SDK:", restError);
                    const docRef = await withTimeout(
                        addDoc(collection(db, "solicitudes"), solicitud),
                        7000,
                        "Tiempo de espera agotado al guardar la solicitud por SDK."
                    );
                    solicitudId = docRef?.id || "";
                }

                
                let archivos = [];
                let uploadErrorMessage = "";
                try {
                    archivos = await withTimeout(
                        subirArchivos(codigo, selectedFiles),
                        90000,
                        "Tiempo de espera agotado al subir archivos."
                    );
                } catch (uploadError) {
                    console.warn("No se pudieron subir archivos:", uploadError);
                    uploadErrorMessage = uploadError?.message || "No se pudieron subir archivos.";
                    statusEl.style.color = "#facc15";
                    statusEl.textContent = `La solicitud se guardó, pero no se pudieron subir los adjuntos. ${uploadErrorMessage}`;
                    archivos = [];
                }

                if (solicitudId && archivos.length > 0) {
                    try {
                        await withTimeout(
                            updateDoc(doc(db, "solicitudes", solicitudId), { archivos }),
                            7000,
                            "Tiempo de espera agotado al actualizar archivos por SDK."
                        );
                    } catch (updateError) {
                        console.warn("No se pudo actualizar archivos por SDK, intentando REST:", updateError);
                        await withTimeout(
                            actualizarArchivosPorRest(solicitudId, archivos),
                            10000,
                            "Tiempo de espera agotado al actualizar archivos por REST."
                        );
                    }
                }

                if (ALLOW_INLINE_FALLBACK && solicitudId && selectedFilesCount > 0 && archivos.length === 0) {
                    try {
                        const inlineArchivos = await withTimeout(
                            generarAdjuntosInline(selectedFiles),
                            12000,
                            "No se pudieron preparar adjuntos inline."
                        );

                        if (inlineArchivos.length > 0) {
                            try {
                                await withTimeout(
                                    updateDoc(doc(db, "solicitudes", solicitudId), { archivos: inlineArchivos }),
                                    7000,
                                    "Tiempo de espera agotado al guardar adjunto inline."
                                );
                            } catch (inlineSdkError) {
                                console.warn("No se pudo guardar adjunto inline por SDK, intentando REST:", inlineSdkError);
                                await withTimeout(
                                    actualizarArchivosPorRest(solicitudId, inlineArchivos),
                                    10000,
                                    "Tiempo de espera agotado al guardar adjunto inline por REST."
                                );
                            }

                            archivos = inlineArchivos;
                            statusEl.style.color = "#facc15";
                            statusEl.textContent = "Storage falló por CORS. Se guardó una vista previa de la imagen en Firestore.";
                        }
                    } catch (inlineError) {
                        console.warn("No se pudo guardar fallback inline:", inlineError);
                    }
                }

                if (!ALLOW_INLINE_FALLBACK && selectedFilesCount > 0 && archivos.length === 0) {
                    statusEl.style.color = "#facc15";
                    statusEl.textContent = "Solicitud guardada. El adjunto no se subio a Storage. Revisa reglas/CORS del bucket.";
                }

                showTrackingCodeModal({ codigo, nombre, telefono, servicio, monto, urgencia });
                notifySite("Solicitud enviada correctamente.", "success");
                if (selectedFilesCount > 0 && archivos.length === 0) {
                    statusEl.style.color = "#facc15";
                    statusEl.textContent = "Solicitud guardada, pero los adjuntos no se subieron. Revisa reglas de Storage o vuelve a intentar con una imagen más liviana.";
                } else {
                    statusEl.style.color = "#86efac";
                    statusEl.textContent = archivos.length > 0
                        ? `Solicitud enviada correctamente con ${archivos.length} adjunto(s).`
                        : "Solicitud enviada correctamente.";
                }
                form.reset();

                
                toggleCamposAdicionales();

            } catch (error) {
                console.error("Error al enviar solicitud:", error);
                const code = error?.code || "desconocido";
                let mensaje = error?.message || "No se pudo enviar la solicitud.";

                if (code === "permission-denied") {
                    mensaje = "Firebase rechazó la escritura (permission-denied). Revisa reglas de Firestore.";
                } else if (code === "unavailable") {
                    mensaje = "Firebase no está disponible en este momento. Verifica internet y vuelve a intentar.";
                } else if (code === "deadline-exceeded") {
                    mensaje = "Firebase tardó demasiado en responder (deadline-exceeded).";
                }

                statusEl.style.color = "#fca5a5";
                statusEl.textContent = `${mensaje} [${code}]`;
                notifySite(`${mensaje} [${code}]`, "error", 5000);
            } finally {
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    cargarServicios();
});

const serviciosPorDefecto = [
    { categoria: "Cerómeros", titulo: "Inlay / Onlay / Overlay", precio: 120 },
    { categoria: "Cerómeros", titulo: "Vonlay / Table Top / Veneer Lay", precio: 120 },
    { categoria: "Cerómeros", titulo: "Carillas (Vestibulares / Palatinas)", precio: 130 },
    { categoria: "Cerómeros", titulo: "Corona Jacket", precio: 150 },
    { categoria: "Cerómeros", titulo: "Puente adhesivo con fibra", precio: 400 },
    { categoria: "Metal Porcelana", titulo: "Corona metal porcelana", precio: 150 },
    { categoria: "Metal Porcelana", titulo: "Corona con hombro cerámico", precio: 150 },
    { categoria: "Metal Porcelana", titulo: "Corona con apoyo PPR", precio: 150 },
    { categoria: "Disilicato de Litio", titulo: "Incrustaciones / Fragmentos", precio: 250 },
    { categoria: "Disilicato de Litio", titulo: "Carillas / Coronas", precio: 250 },
    { categoria: "Zirconio", titulo: "Coronas / Incrustaciones", precio: 300 },
    { categoria: "Implantes", titulo: "Corona metal atornillada", precio: 200 },
    { categoria: "Implantes", titulo: "Corona metal cementada", precio: 200 },
    { categoria: "Implantes", titulo: "Corona zirconio atornillada", precio: 320 },
    { categoria: "Implantes", titulo: "Corona zirconio cementada", precio: 320 }
];

async function seedServiciosPorDefecto() {
    const ref = collection(db, "servicios");
    try {
        for (const servicio of serviciosPorDefecto) {
            await addDoc(ref, servicio);
        }
    } catch (error) {
        console.error("Error al sembrar servicios por defecto", error);
    }
}

let serviciosGlobales = [];

function cargarServicios() {
    try {
        const ref = collection(db, "servicios");

        onSnapshot(ref, (snapshot) => {
            serviciosGlobales = [];
            snapshot.forEach(docSnap => serviciosGlobales.push({ id: docSnap.id, ...docSnap.data() }));

            
            serviciosGlobales = dedupeServicios(serviciosGlobales);

            if (serviciosGlobales.length === 0) {
                serviciosGlobales = [...serviciosPorDefecto];
                renderServiciosIndex(serviciosGlobales);
                renderServiciosSelect(serviciosGlobales);
                seedServiciosPorDefecto();
                return;
            }

            renderServiciosIndex(serviciosGlobales);
            renderServiciosSelect(serviciosGlobales);
        }, (error) => {
            console.error("Error cargando servicios:", error);
            serviciosGlobales = [...serviciosPorDefecto];
            renderServiciosIndex(serviciosGlobales);
            renderServiciosSelect(serviciosGlobales);
        });
    } catch (error) {
        console.error("Error conectando a Firebase:", error);
        serviciosGlobales = [...serviciosPorDefecto];
        renderServiciosIndex(serviciosGlobales);
        renderServiciosSelect(serviciosGlobales);
    }
}

function dedupeServicios(servicios) {
    const mapa = new Map();

    servicios.forEach(item => {
        const key = `${(item.categoria || "").trim().toLowerCase()}|${(item.titulo || "").trim().toLowerCase()}|${parseFloat(item.precio || 0).toFixed(2)}`;
        if (!mapa.has(key)) {
            mapa.set(key, item);
        }
    });

    return Array.from(mapa.values());
}


function mostrarServiciosFallback() {
    console.log("🔄 Usando modo fallback");
    serviciosGlobales = [...serviciosPorDefecto];
    renderServiciosIndex(serviciosGlobales);
    renderServiciosSelect(serviciosGlobales);
}

function renderServiciosIndex(servicios) {
    servicios = dedupeServicios(servicios);

    const contenedor = document.getElementById("serviciosContainer");
    if (!contenedor) return;

    if (servicios.length === 0) {
        console.log("❌ No hay servicios para mostrar");
        contenedor.innerHTML = `
            <div class="service-card">
                <div class="service-icon">
                    <i class="ri-tools-line"></i>
                </div>
                <h3>No hay servicios registrados</h3>
                <p>Agrega servicios desde el panel admin.</p>
            </div>
        `;
        return;
    }

    console.log("✅ Generando HTML de categorías");
    
    const categoriasInfo = {
        "Cerómeros": {
            imagen: "img/img04.png",
            descripcion: "Restauraciones estéticas con cerámica"
        },
        "Metal Porcelana": {
            imagen: "img/img04.png",
            descripcion: "Coronas con base metálica y porcelana"
        },
        "Disilicato de Litio": {
            imagen: "img/img04.png",
            descripcion: "Materiales de alta resistencia y estética"
        },
        "Zirconio": {
            imagen: "img/img04.png",
            descripcion: "Coronas de zirconio de máxima durabilidad"
        },
        "Implantes": {
            imagen: "img/img04.png",
            descripcion: "Soluciones sobre implantes dentales"
        }
    };

    
    const porCategoria = {};
    servicios.forEach(s => {
        const cat = s.categoria || "General";
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(s);
    });

    
    let html = '<div class="categorias-grid">';

    Object.keys(porCategoria).forEach(cat => {
        const info = categoriasInfo[cat] || {
            imagen: "img/img04.png",
            descripcion: "Servicios odontológicos especializados"
        };

        html += `
            <div class="categoria-card" onclick="mostrarCategoria('${cat}')">
                <div class="categoria-imagen">
                    <img src="${info.imagen}" alt="${cat}" onerror="this.src='img/img04.png'">
                </div>
                <div class="categoria-info">
                    <h3>${cat}</h3>
                    <p>${info.descripcion}</p>
                    <span class="categoria-count">${porCategoria[cat].length} servicios</span>
                </div>
            </div>
        `;
    });

    html += '</div>';

    
    html += '<div id="productosContainer" class="productos-container" style="display:none;"></div>';

    
    html += '<div id="volverBtn" class="volver-btn" style="display:none;" onclick="volverCategorias()"><i class="ri-arrow-left-line"></i> Ver todas las categorías</div>';

    console.log("📝 HTML generado, asignando a contenedor");
    contenedor.innerHTML = html;
    console.log("✅ Servicios renderizados exitosamente");
}


window.mostrarCategoria = (categoria) => {
    const contenedor = document.getElementById("serviciosContainer");
    const productosContainer = document.getElementById("productosContainer");
    const volverBtn = document.getElementById("volverBtn");

    
    const serviciosFiltrados = serviciosGlobales.filter(s => (s.categoria || "General") === categoria);

    
    document.querySelector(".categorias-grid").style.display = "none";
    productosContainer.style.display = "block";
    volverBtn.style.display = "block";

    
    let productosHtml = `<h3 class="categoria-titulo-activa">${categoria}</h3>`;
    productosHtml += '<div class="productos-grid">';

    serviciosFiltrados.forEach(s => {
        productosHtml += `
            <div class="producto-card">
                <div class="producto-icon">
                    <i class="ri-star-line"></i>
                </div>
                <h4 class="producto-title">${s.titulo}</h4>
                <div class="producto-price">
                    <span class="price-amount">S/. ${parseFloat(s.precio || 0).toFixed(2)}</span>
                </div>
                <div class="producto-features">
                    <span class="feature"><i class="ri-check-line"></i> Calidad garantizada</span>
                    <span class="feature"><i class="ri-time-line"></i> Entrega rápida</span>
                </div>
                <button class="btn-solicitar" onclick="solicitarServicio('${s.titulo}', ${s.precio})">
                    <i class="ri-shopping-cart-line"></i> Solicitar
                </button>
            </div>
        `;
    });

    productosHtml += '</div>';
    productosContainer.innerHTML = productosHtml;
};


window.volverCategorias = () => {
    document.querySelector(".categorias-grid").style.display = "grid";
    document.getElementById("productosContainer").style.display = "none";
    document.getElementById("volverBtn").style.display = "none";
};


window.toggleCamposAdicionales = () => {
    const tipoTrabajo = document.getElementById("tipoTrabajo").value;
    const camposAdicionales = document.getElementById("camposAdicionales");
    const detalleTextarea = document.getElementById("detalle");
    const detalleLabel = camposAdicionales.querySelector("h4");

    if (tipoTrabajo === "personalizado") {
        camposAdicionales.style.opacity = "1";
        detalleTextarea.required = true;
        detalleTextarea.placeholder = "Describe el caso clínico, dientes involucrados, color deseado, etc. (Obligatorio)";
        detalleLabel.innerHTML = 'Información del Caso <span style="color: #ef4444; font-size: 12px;">(Obligatorio)</span>';
    } else {
        camposAdicionales.style.opacity = "0.7";
        detalleTextarea.required = false;
        detalleTextarea.placeholder = "Detalles adicionales (opcional)";
        detalleLabel.innerHTML = 'Información del Caso <span style="color: #9ca3af; font-size: 12px;">(Opcional)</span>';
    }
};


async function subirArchivos(codigo, archivosSeleccionados = []) {
    const archivos = Array.isArray(archivosSeleccionados)
        ? archivosSeleccionados
        : Array.from(archivosSeleccionados || []);

    if (!archivos.length) {
        return [];
    }

    const urlsArchivos = [];
    const erroresSubida = [];

    for (let i = 0; i < archivos.length; i++) {
        const archivo = archivos[i];

        
        if (archivo.size > 10 * 1024 * 1024) {
            notifySite(`El archivo ${archivo.name} es demasiado grande. Máximo 10MB.`, "warning", 5000);
            continue;
        }

        try {
            const storageRef = ref(storage, `placas/${codigo}/${archivo.name}`);
            const snapshot = await uploadBytes(storageRef, archivo);
            const url = await getDownloadURL(snapshot.ref);
            urlsArchivos.push({
                nombre: archivo.name,
                url: url,
                tipo: archivo.type,
                tamaño: archivo.size
            });
        } catch (error) {
            const code = error?.code || "storage/error";
            const message = error?.message || "Error desconocido";
            const resumen = `${archivo.name}: ${code}`;
            console.error(`Error subiendo ${archivo.name}:`, error);
            erroresSubida.push(resumen);
            notifySite(`Error al subir ${archivo.name}: ${message} [${code}]`, "error", 5200);
        }
    }

    if (archivos.length > 0 && urlsArchivos.length === 0 && erroresSubida.length > 0) {
        throw new Error(`No se pudo subir ningún archivo. ${erroresSubida.join(" | ")}`);
    }

    return urlsArchivos;
}


window.solicitarServicio = (titulo, precio) => {
    const precioBase = parseFloat(precio || 0);
    const precioConIgv = Number.isFinite(precioBase) ? precioBase * 1.18 : 0;

    
    document.getElementById("servicio").value = `${titulo} - S/.${precioBase.toFixed(2)}`;
    document.getElementById("monto").value = precioConIgv.toFixed(2);
    document.querySelector("#contact").scrollIntoView({ behavior: "smooth" });

    
    document.getElementById("servicio").focus();
};

function renderServiciosSelect(servicios) {
    servicios = dedupeServicios(servicios);
    const select = document.getElementById("servicio");
    if (!select) return;

    const porCategoria = {};
    servicios.forEach(s => {
        const cat = s.categoria || "General";
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(s);
    });

    select.innerHTML = "<option value=\"\">Selecciona el servicio</option>";

    Object.keys(porCategoria).forEach(cat => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = cat;

        porCategoria[cat].forEach(s => {
            const option = document.createElement("option");
            const precioBase = parseFloat(s.precio || 0);
            option.value = `${s.titulo} - S/.${precioBase.toFixed(2)}`;
            option.text = `${s.titulo} - S/.${precioBase.toFixed(2)}`;
            option.dataset.precio = String(precioBase);
            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    });
}

window.actualizarMontoConIgv = () => {
    const servicioSelect = document.getElementById("servicio");
    const montoInput = document.getElementById("monto");
    if (!servicioSelect || !montoInput) return;

    const opcion = servicioSelect.options[servicioSelect.selectedIndex];
    const precioBase = parseFloat(opcion?.dataset?.precio || "0");

    if (!Number.isFinite(precioBase) || precioBase <= 0) {
        montoInput.value = "";
        return;
    }

    const precioConIgv = precioBase * 1.18;
    montoInput.value = precioConIgv.toFixed(2);
};


window.buscarSolicitud = async function () {

    let codigo = document.getElementById("codigoBuscar").value.trim().toUpperCase();
    let resultado = document.getElementById("resultado");

    if (!codigo) {
        notifySite("Ingresa un código", "warning");
        return;
    }

    resultado.innerHTML = '<div class="track-loading">Buscando solicitud...</div>';

    try {

        const querySnapshot = await getDocs(collection(db, "solicitudes"));

        let encontrado = null;

        querySnapshot.forEach((docSnap) => {
            let data = docSnap.data();
            const codigoData = String(data.codigo || "").trim().toUpperCase();

            if (codigoData === codigo) {
                encontrado = data;
            }
        });

        if (!encontrado) {
            resultado.innerHTML = '<div class="track-empty">No se encontró la solicitud. Verifica el código e intenta nuevamente.</div>';
            return;
        }

        let color = "#facc15";
        if (encontrado.estado === "en proceso") color = "#3b82f6";
        if (encontrado.estado === "terminado") color = "#22c55e";

        const fechaDate = encontrado.fecha?.toDate
            ? encontrado.fecha.toDate()
            : (encontrado.fecha?.seconds ? new Date(encontrado.fecha.seconds * 1000) : null);

        const fechaTexto = fechaDate
            ? fechaDate.toLocaleString("es-PE")
            : "Sin fecha registrada";

        resultado.innerHTML = `
            <div class="track-card" style="border-left-color:${color}">
                <h3>Codigo: ${encontrado.codigo || codigo}</h3>
                <div class="track-grid">
                    <div class="track-item"><b>Estado:</b> ${encontrado.estado || "pendiente"}</div>
                    <div class="track-item"><b>Fecha:</b> ${fechaTexto}</div>
                    <div class="track-item"><b>Servicio:</b> ${encontrado.servicio || "-"}</div>
                    <div class="track-item"><b>Cliente:</b> ${encontrado.nombre || "-"}</div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error(error);
        resultado.innerHTML = '<div class="track-error">Error al buscar la solicitud. Intenta nuevamente en unos segundos.</div>';
    }
};


const reveals = document.querySelectorAll(".reveal");

function revealOnScroll() {
    const windowHeight = window.innerHeight;

    reveals.forEach(el => {
        const top = el.getBoundingClientRect().top;

        if (top < windowHeight - 80) {
            el.classList.add("active");
        }
    });
}


revealOnScroll();

window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);



const counters = document.querySelectorAll(".stat h3");

function animateCounters() {
    counters.forEach(counter => {
        const target = parseInt(counter.innerText);
        let count = 0;

        const update = () => {
            let increment = target / 50;

            if (count < target) {
                count += increment;
                counter.innerText = Math.floor(count);
                requestAnimationFrame(update);
            } else {
                counter.innerText = target + "+";
            }
        };

        update();
    });
}

let statsTriggered = false;

window.addEventListener("scroll", () => {
    const stats = document.querySelector(".stats");

    if (!stats) return;

    const top = stats.getBoundingClientRect().top;

    if (top < window.innerHeight && !statsTriggered) {
        animateCounters();
        statsTriggered = true;
    }
});