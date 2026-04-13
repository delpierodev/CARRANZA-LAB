import { db } from "./firebase.js?v=20260413a";

import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();

function getAdminNoticeHost() {
    let host = document.getElementById("adminNoticeHost");
    if (host) return host;

    host = document.createElement("div");
    host.id = "adminNoticeHost";
    host.style.position = "fixed";
    host.style.top = "16px";
    host.style.right = "16px";
    host.style.zIndex = "9999";
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.gap = "10px";
    host.style.maxWidth = "min(92vw, 360px)";
    document.body.appendChild(host);
    return host;
}

function notifyAdmin(message, type = "info", timeoutMs = 3200) {
    const colors = {
        info: "#3b82f6",
        success: "#16a34a",
        warning: "#d97706",
        error: "#dc2626"
    };

    const host = getAdminNoticeHost();
    const item = document.createElement("div");
    item.style.background = "#0f172a";
    item.style.color = "#e2e8f0";
    item.style.border = `1px solid ${colors[type] || colors.info}`;
    item.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    item.style.borderRadius = "10px";
    item.style.padding = "10px 12px";
    item.style.boxShadow = "0 8px 20px rgba(0,0,0,0.3)";
    item.style.fontSize = "13px";
    item.style.lineHeight = "1.4";
    item.textContent = message;

    host.appendChild(item);
    setTimeout(() => item.remove(), timeoutMs);
}

function confirmAdmin(message) {
    return new Promise((resolve) => {
        const existing = document.getElementById("adminConfirmModal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "adminConfirmModal";
        modal.style.position = "fixed";
        modal.style.inset = "0";
        modal.style.background = "rgba(2,6,23,0.7)";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.zIndex = "10000";

        modal.innerHTML = `
            <div style="width:min(92vw, 420px); background:#0b1220; border:1px solid #334155; border-radius:12px; padding:16px; color:#e2e8f0;">
                <h4 style="margin:0 0 8px; color:#f8fafc;">Confirmar acción</h4>
                <p style="margin:0 0 14px; color:#cbd5e1;">${message}</p>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="adminConfirmCancel" style="border:none; background:#334155; color:#e2e8f0; border-radius:8px; padding:8px 12px; cursor:pointer;">Cancelar</button>
                    <button id="adminConfirmOk" style="border:none; background:#dc2626; color:white; border-radius:8px; padding:8px 12px; cursor:pointer;">Eliminar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = (value) => {
            modal.remove();
            resolve(value);
        };

        modal.addEventListener("click", (e) => {
            if (e.target === modal) close(false);
        });
        document.getElementById("adminConfirmCancel")?.addEventListener("click", () => close(false));
        document.getElementById("adminConfirmOk")?.addEventListener("click", () => close(true));
    });
}

function mostrarErrorFirestore(mensaje) {
    let banner = document.getElementById("firestoreErrorBanner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "firestoreErrorBanner";
        banner.style.background = "#7f1d1d";
        banner.style.color = "#fecaca";
        banner.style.padding = "10px 14px";
        banner.style.border = "1px solid #ef4444";
        banner.style.borderRadius = "8px";
        banner.style.marginBottom = "14px";

        const main = document.querySelector(".main");
        if (main) {
            main.insertBefore(banner, main.firstChild);
        }
    }

    banner.textContent = mensaje;
}

function getFechaDate(fecha) {
    if (!fecha) return null;
    if (typeof fecha?.toDate === "function") return fecha.toDate();
    if (typeof fecha?.seconds === "number") return new Date(fecha.seconds * 1000);
    if (typeof fecha?._seconds === "number") return new Date(fecha._seconds * 1000);

    const parsed = new Date(fecha);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    return null;
}

function getFechaMs(fecha) {
    const d = getFechaDate(fecha);
    return d ? d.getTime() : 0;
}

function clienteLabel(value) {
    const map = {
        clinica: "Clínica Dental",
        odontologo: "Odontólogo Independiente",
        hospital: "Hospital",
        particular: "Paciente Particular",
        "Clínica Dental": "Clínica Dental",
        "Odontólogo Independiente": "Odontólogo Independiente",
        Hospital: "Hospital",
        "Paciente Particular": "Paciente Particular"
    };

    return map[value] || value || "-";
}

function entregaLabel(value) {
    const map = {
        recojo_lab: "Recojo en laboratorio",
        delivery: "Delivery gratuito",
        courier: "Courier",
        "Recojo en laboratorio": "Recojo en laboratorio",
        Delivery: "Delivery gratuito",
        Courier: "Courier"
    };

    return map[value] || value || "-";
}

function archivoUrl(archivo) {
    return archivo?.url || archivo?.downloadURL || archivo?.downloadUrl || "";
}

function archivoNombre(archivo, index) {
    return archivo?.nombre || archivo?.name || `archivo-${index + 1}`;
}

function archivoTipo(archivo) {
    return (archivo?.tipo || archivo?.type || "").toLowerCase();
}

let pedidoDetalleActivoId = null;

function cerrarModalArchivo() {
    const modal = document.getElementById("archivoPreviewModal");
    if (modal) {
        modal.remove();
    }
}

window.verArchivoAdjunto = (url, tipo, nombre, inline = false) => {
    if (!url) return;

    const isImage = (tipo || "").toLowerCase().startsWith("image/");
    if (inline && isImage) {
        cerrarModalArchivo();

        const modal = document.createElement("div");
        modal.id = "archivoPreviewModal";
        modal.style.position = "fixed";
        modal.style.inset = "0";
        modal.style.background = "rgba(0,0,0,0.75)";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.zIndex = "9999";
        modal.innerHTML = `
            <div style="max-width:92vw; max-height:92vh; background:#0b1220; padding:12px; border-radius:10px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; color:#e2e8f0;">
                    <strong>${nombre || "Adjunto"}</strong>
                    <button id="cerrarArchivoPreview" style="background:#ef4444; color:white; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">Cerrar</button>
                </div>
                <img src="${url}" alt="${nombre || "Adjunto"}" style="max-width:88vw; max-height:80vh; border-radius:8px; display:block;" />
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                cerrarModalArchivo();
            }
        });

        const cerrarBtn = document.getElementById("cerrarArchivoPreview");
        if (cerrarBtn) {
            cerrarBtn.addEventListener("click", cerrarModalArchivo);
        }

        return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
};

let listaGlobal = [];
let serviciosGlobal = [];
let servicioEditRowId = null;
let primeraCarga = true;
let chart;
const IGV_RATE = 0.18;


const soundAlert = new Audio("/sounds/alerta.mp3");


onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        await verificarRol(user);
    } catch (error) {
        console.warn("No se pudo validar el rol por permisos de Firestore. Se continúa en modo admin local.", error);
    }

    escuchar();
    escucharServicios();
});


async function verificarRol(user) {
    try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            return;
        }

        const rol = snap.data().rol;
        if (rol !== "admin") {
            notifyAdmin("No tienes permisos para acceder al panel.", "error", 2000);
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1200);
        }
    } catch (error) {
        if (error?.code === "permission-denied") {
            
            return;
        }
        throw error;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("enableSound");

    if (btn) {
        btn.addEventListener("click", async () => {
            await soundAlert.play().catch(() => {});
            soundAlert.pause();
            soundAlert.currentTime = 0;

            btn.innerHTML = `<i class="ri-volume-up-line"></i> Activado`;
            btn.style.background = "green";
        });
    }
});


function escuchar() {
    const ref = collection(db, "solicitudes");

    onSnapshot(ref, (snapshot) => {
        listaGlobal = [];

        snapshot.docChanges().forEach(change => {
            if (change.type === "added" && !primeraCarga) {
                soundAlert.play().catch(() => {});
            }
        });

        snapshot.forEach(docSnap => {
            listaGlobal.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        listaGlobal.sort((a, b) => getFechaMs(b.fecha) - getFechaMs(a.fecha));

        renderTabla(listaGlobal);
        renderGrafico(listaGlobal);
        renderKPIs(listaGlobal);
        renderTablaIngresos(listaGlobal);
        renderGraficoIngresos(listaGlobal);
        renderKPIsIngresos(listaGlobal);

        primeraCarga = false;
    }, (error) => {
        console.error("Error al leer solicitudes:", error);
        if (error?.code === "permission-denied") {
            mostrarErrorFirestore("Firestore bloqueó lectura de solicitudes (permission-denied). Revisa reglas de Firestore.");
        }
    });
}


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

function escucharServicios() {
    const ref = collection(db, "servicios");

    onSnapshot(ref, (snapshot) => {
        serviciosGlobal = [];

        snapshot.forEach(docSnap => {
            serviciosGlobal.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderOpcionesServicioPedido(serviciosGlobal);

        if (serviciosGlobal.length === 0) {
            seedServiciosPorDefecto();
            return;
        }

        serviciosGlobal = dedupeServicios(serviciosGlobal);

        serviciosGlobal.sort((a, b) => {
            const catA = (a.categoria || "").toLowerCase();
            const catB = (b.categoria || "").toLowerCase();
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return (a.titulo || "").localeCompare(b.titulo || "");
        });

        renderTablaServicios(serviciosGlobal);
        renderOpcionesServicioPedido(serviciosGlobal);
    }, (error) => {
        console.error("Error al leer servicios:", error);
        if (error?.code === "permission-denied") {
            mostrarErrorFirestore("Firestore bloqueó lectura de servicios (permission-denied). Revisa reglas de Firestore.");
        }
    });
}


function dedupeServicios(lista) {
    const mapa = new Map();

    lista.forEach(item => {
        const key = `${(item.categoria || "").trim().toLowerCase()}|${(item.titulo || "").trim().toLowerCase()}|${parseFloat(item.precio || 0).toFixed(2)}`;
        if (!mapa.has(key)) {
            mapa.set(key, item);
        }
    });

    return Array.from(mapa.values());
}

function renderTablaServicios(lista) {
    const tabla = document.getElementById("tablaServicios");
    if (!tabla) return;

    tabla.innerHTML = "";

    const filtrado = document.getElementById("buscarServicio")?.value.toLowerCase() || "";

    const servicios = dedupeServicios(lista).filter(item =>
        item.categoria?.toLowerCase().includes(filtrado) ||
        item.titulo?.toLowerCase().includes(filtrado)
    );

    if (servicios.length === 0) {
        tabla.innerHTML = "<div style='text-align:center; color:#888; padding:20px;'>No hay servicios registrados</div>";
        return;
    }

    const porCategoria = {};
    servicios.forEach(s => {
        const cat = s.categoria || "General";
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(s);
    });

    Object.keys(porCategoria).forEach(cat => {
        const panel = document.createElement("details");
        panel.className = "categoria-panel";
        panel.open = true;

        panel.innerHTML = `
            <summary>${cat} (${porCategoria[cat].length})</summary>
            <table>
                <thead>
                    <tr>
                        <th>Servicio</th>
                        <th>Precio</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${porCategoria[cat].map(data => `
                        <tr data-id="${data.id}">
                            <td>${data.titulo || "-"}</td>
                            <td>S/ ${parseFloat(data.precio || 0).toFixed(2)}</td>
                            <td class="acciones">
                                <button type="button" class="btn-action info" onclick="event.stopPropagation(); mostrarEdicionServicio('${data.id}')">
                                    <i class="ri-pencil-line"></i> Editar
                                </button>
                                <button type="button" class="btn-action eliminar" onclick="event.stopPropagation(); eliminarServicio('${data.id}')">
                                    <i class="ri-delete-bin-line"></i> Eliminar
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        tabla.appendChild(panel);
    });
}

function renderOpcionesServicioPedido(lista) {
    const select = document.getElementById("pedido-servicio");
    if (!select) return;

    const servicios = dedupeServicios(lista || []).sort((a, b) => {
        const catA = (a.categoria || "").toLowerCase();
        const catB = (b.categoria || "").toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        return (a.titulo || "").localeCompare(b.titulo || "");
    });

    const valorActual = select.value || "";

    select.innerHTML = '<option value="">Selecciona un servicio</option>';

    servicios.forEach((servicio) => {
        const option = document.createElement("option");
        const titulo = servicio.titulo || "Servicio";
        const categoria = servicio.categoria || "General";
        const precio = parseFloat(servicio.precio || 0);

        option.value = titulo;
        option.textContent = `${categoria} - ${titulo}`;
        option.dataset.precio = Number.isFinite(precio) ? String(precio) : "0";
        select.appendChild(option);
    });

    if (valorActual && Array.from(select.options).some(o => o.value === valorActual)) {
        select.value = valorActual;
    }
}

window.autocompletarMontoDesdeServicio = () => {
    const select = document.getElementById("pedido-servicio");
    const montoInput = document.getElementById("pedido-monto");
    if (!select || !montoInput) return;

    const opcion = select.options[select.selectedIndex];
    if (!opcion) return;

    const precio = parseFloat(opcion.dataset.precio || "0");
    if (!Number.isFinite(precio) || precio <= 0) {
        montoInput.value = "";
        return;
    }

    const montoConIgv = precio * (1 + IGV_RATE);
    montoInput.value = montoConIgv.toFixed(2);
};

window.mostrarEdicionServicio = (id) => {
    if (!id) return;

    if (servicioEditRowId === id) {
        cerrarEdicionServicio();
        return;
    }

    cerrarEdicionServicio();

    const servicio = serviciosGlobal.find(s => s.id === id);
    if (!servicio) return;

    const row = document.querySelector(`#tablaServicios tr[data-id="${id}"]`);
    if (!row) return;

    servicioEditRowId = id;

    const editRow = document.createElement("tr");
    editRow.className = "service-edit-row";
    editRow.innerHTML = `
        <td colspan="3">
            <div class="edit-inline">
                <div class="detalle-grupo">
                    <label>Categoría</label>
                    <input type="text" id="edit-categoria" value="${servicio.categoria || ""}" />
                </div>
                <div class="detalle-grupo">
                    <label>Servicio</label>
                    <input type="text" id="edit-titulo" value="${servicio.titulo || ""}" />
                </div>
                <div class="detalle-grupo">
                    <label>Precio</label>
                    <input type="number" id="edit-precio" value="${servicio.precio || 0}" step="0.01" />
                </div>
                <div class="detalle-acciones edit-actions">
                    <button type="button" class="btn-guardar" onclick="guardarServicio('${id}')">
                        <i class="ri-save-line"></i> Guardar
                    </button>
                    <button type="button" class="btn-cancelar" onclick="cerrarEdicionServicio()">
                        <i class="ri-close-line"></i> Cancelar
                    </button>
                </div>
            </div>
        </td>
    `;

    row.insertAdjacentElement("afterend", editRow);
    editRow.querySelector("input")?.focus();
};

window.cerrarEdicionServicio = () => {
    const existing = document.querySelector(".service-edit-row");
    if (existing) {
        existing.remove();
    }
    servicioEditRowId = null;
};

window.filtrarServicios = () => {
    renderTablaServicios(serviciosGlobal);
};

window.mostrarFormularioServicio = (id = null) => {
    const form = document.getElementById("servicioForm");
    const title = document.getElementById("servicioFormTitle");
    const campoId = document.getElementById("servicio-id");

    if (!form || !title) return;

    if (id) {
        const servicio = serviciosGlobal.find(s => s.id === id);
        if (!servicio) return;

        title.innerText = "Editar Servicio";
        document.getElementById("servicio-id").value = id;
        document.getElementById("servicio-categoria").value = servicio.categoria || "";
        document.getElementById("servicio-titulo").value = servicio.titulo || "";
        document.getElementById("servicio-precio").value = servicio.precio || "";
    } else {
        title.innerText = "Nuevo Servicio";
        if (campoId) campoId.value = "";
        document.getElementById("servicio-categoria").value = "";
        document.getElementById("servicio-titulo").value = "";
        document.getElementById("servicio-precio").value = "";
    }

    form.style.display = "block";
};

window.cerrarServicioForm = () => {
    const form = document.getElementById("servicioForm");
    if (!form) return;
    form.style.display = "none";
};

window.guardarServicio = async (id = null) => {
    const editarInline = Boolean(id);
    const servicioId = editarInline
        ? id
        : document.getElementById("servicio-id")?.value?.trim();

    const categoria = editarInline
        ? document.getElementById("edit-categoria").value
        : document.getElementById("servicio-categoria").value;
    const titulo = editarInline
        ? document.getElementById("edit-titulo").value
        : document.getElementById("servicio-titulo").value;
    const precio = parseFloat(
        editarInline
            ? document.getElementById("edit-precio").value
            : document.getElementById("servicio-precio").value
    );

    if (!categoria || !titulo || !precio || precio <= 0) {
        notifyAdmin("Completa la categoría, nombre y precio del servicio", "warning");
        return;
    }

    const datos = {
        categoria,
        titulo,
        precio,
        fecha: new Date()
    };

    try {
        if (servicioId) {
            await updateDoc(doc(db, "servicios", servicioId), datos);
            notifyAdmin("Servicio actualizado correctamente", "success");
            cerrarEdicionServicio();
            if (!editarInline) {
                cerrarServicioForm();
            }
        } else {
            await addDoc(collection(db, "servicios"), datos);
            notifyAdmin("Servicio creado correctamente", "success");
            cerrarServicioForm();
        }
    } catch (error) {
        console.error(error);
        notifyAdmin("Error al guardar el servicio", "error");
    }
};

window.eliminarServicio = async (id) => {
    const ok = await confirmAdmin("¿Eliminar este servicio?");
    if (!ok) return;
    try {
        await deleteDoc(doc(db, "servicios", id));
        notifyAdmin("Servicio eliminado", "success");
    } catch (error) {
        console.error(error);
        notifyAdmin("Error al eliminar el servicio", "error");
    }
};


function renderGrafico(lista) {
    let p = 0, pr = 0, t = 0;

    lista.forEach(d => {
        if (d.estado === "pendiente") p++;
        else if (d.estado === "en proceso") pr++;
        else if (d.estado === "terminado") t++;
    });

    const ctx = document.getElementById("graficoPedidos");
    if (!ctx) return;

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Pendientes", "Proceso", "Terminados"],
            datasets: [{
                label: "Pedidos",
                data: [p, pr, t]
            }]
        }
    });
}


function renderKPIs(lista) {
    let p = 0, pr = 0, t = 0;
    let ingresosTotal = 0;

    lista.forEach(d => {
        if (d.estado === "pendiente") p++;
        else if (d.estado === "en proceso") pr++;
        else if (d.estado === "terminado") t++;

        if (d.estado === "terminado" && d.monto) {
            ingresosTotal += parseFloat(d.monto || 0);
        }
    });

    const total = lista.length;

    document.getElementById("kpiTotal") && (document.getElementById("kpiTotal").innerText = total);
    document.getElementById("kpiPendientes") && (document.getElementById("kpiPendientes").innerText = p);
    document.getElementById("kpiProceso") && (document.getElementById("kpiProceso").innerText = pr);
    document.getElementById("kpiTerminados") && (document.getElementById("kpiTerminados").innerText = t);
    document.getElementById("kpiIngresosTotal") && (document.getElementById("kpiIngresosTotal").innerText = `S/ ${ingresosTotal.toFixed(2)}`);

    
    renderGraficoTendencias(lista);
    renderResumenSemanal(lista);
    renderActividadReciente(lista);
}


let chartTendencias;

function renderGraficoTendencias(lista) {
    const hoy = new Date();
    const dias = [];
    const pedidosPorDia = [];

    
    for (let i = 6; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        const diaStr = fecha.toLocaleDateString('es-ES', { weekday: 'short' });
        dias.push(diaStr);

        const pedidosDia = lista.filter(p => {
            if (!p.fecha) return false;
            const fechaPedido = getFechaDate(p.fecha);
            if (!fechaPedido) return false;
            return fechaPedido.toDateString() === fecha.toDateString();
        }).length;

        pedidosPorDia.push(pedidosDia);
    }

    const ctx = document.getElementById("graficoTendencias");
    if (!ctx) return;

    if (chartTendencias) chartTendencias.destroy();

    chartTendencias = new Chart(ctx, {
        type: "line",
        data: {
            labels: dias,
            datasets: [{
                label: "Pedidos por día",
                data: pedidosPorDia,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#3b82f6",
                pointBorderColor: "#fff",
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5f5"
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cbd5f5"
                    },
                    grid: {
                        color: "#334155"
                    }
                },
                x: {
                    ticks: {
                        color: "#cbd5f5"
                    },
                    grid: {
                        color: "#334155"
                    }
                }
            }
        }
    });
}


function renderResumenSemanal(lista) {
    const hoy = new Date();
    const semanaInicio = new Date(hoy);
    semanaInicio.setDate(hoy.getDate() - hoy.getDay());

    const pedidosSemana = lista.filter(p => {
        if (!p.fecha) return false;
        const fechaPedido = getFechaDate(p.fecha);
        if (!fechaPedido) return false;
        return fechaPedido >= semanaInicio;
    });

    const ingresosSemana = pedidosSemana
        .filter(p => p.estado === "terminado")
        .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

    const promedioDiario = Math.round(pedidosSemana.length / 7);

    document.getElementById("pedidosSemana") && (document.getElementById("pedidosSemana").innerText = pedidosSemana.length);
    document.getElementById("ingresosSemana") && (document.getElementById("ingresosSemana").innerText = `S/ ${ingresosSemana.toFixed(2)}`);
    document.getElementById("promedioDiario") && (document.getElementById("promedioDiario").innerText = promedioDiario);
}


function renderActividadReciente(lista) {
    const actividad = document.getElementById("actividadReciente");
    if (!actividad) return;

    const recientes = lista
        .sort((a, b) => getFechaMs(b.fecha) - getFechaMs(a.fecha))
        .slice(0, 5);

    if (recientes.length === 0) {
        actividad.innerHTML = "<p style='color:#888; font-style:italic;'>No hay actividad reciente</p>";
        return;
    }

    actividad.innerHTML = recientes.map(p => {
        const fechaDate = getFechaDate(p.fecha);
        const fecha = fechaDate ? fechaDate.toLocaleString('es-ES') : "Sin fecha";
        const estadoIcon = p.estado === "terminado" ? "✅" : p.estado === "en proceso" ? "⚙️" : "⏳";
        return `<p>${estadoIcon} ${p.nombre} - ${p.servicio} (${fecha})</p>`;
    }).join("");
}


function renderTabla(lista) {
    const tabla = document.getElementById("tablaPedidos");
    if (!tabla) return;

    tabla.innerHTML = "";

    lista.forEach(data => {
        let estadoClass = "pendiente";
        if (data.estado === "en proceso") estadoClass = "proceso";
        if (data.estado === "terminado") estadoClass = "terminado";

        const fechaDate = getFechaDate(data.fecha);
        const fila = document.createElement("tr");
        fila.dataset.id = data.id;
        fila.style.cursor = "pointer";

        fila.innerHTML = `
            <td>${data.codigo || "-"}</td>
            <td>${data.nombre || "-"}<br><small>${clienteLabel(data.cliente)}</small></td>
            <td>${data.servicio || "-"}</td>
            <td>S/ ${parseFloat(data.monto || 0).toFixed(2)}</td>
            <td>${entregaLabel(data.entrega)}</td>
            <td>${fechaDate ? fechaDate.toLocaleDateString() : "-"}</td>
            <td>
                <select id="estado-${data.id}" class="select-estado" onchange="cambiarEstadoSelect('${data.id}', this.value)">
                    <option value="pendiente" ${data.estado === "pendiente" ? "selected" : ""}>⏳ Pendiente</option>
                    <option value="en proceso" ${data.estado === "en proceso" ? "selected" : ""}>⚙️ En proceso</option>
                    <option value="terminado" ${data.estado === "terminado" ? "selected" : ""}>✅ Terminado</option>
                </select>
            </td>
            <td class="acciones">
                <a target="_blank" href="https://wa.me/51${data.telefono}?text=Hola, sobre tu pedido ${data.codigo}">
                    <button class="btn-action whatsapp" title="Enviar WhatsApp">
                        <i class="ri-whatsapp-line"></i> WhatsApp
                    </button>
                </a>

                <button class="btn-action eliminar" onclick="eliminar('${data.id}')" title="Eliminar pedido">
                    <i class="ri-delete-bin-line"></i> Eliminar
                </button>
            </td>
        `;

        
        fila.addEventListener("click", (e) => {
            if (e.target.closest("button") || e.target.closest("a") || e.target.closest("select")) return; 
            mostrarDetalleExpandido(data.id);
        });

        tabla.appendChild(fila);
    });
}


window.cambiarEstadoSelect = async (id, estado) => {
    const pedido = listaGlobal.find(p => p.id === id);
    if (!pedido) return;

    await updateDoc(doc(db, "solicitudes", id), {
        estado,
        historial: [
            ...(pedido.historial || []),
            { estado, fecha: new Date() }
        ]
    });
};


window.mostrarDetalleExpandido = (id) => {
    const pedido = listaGlobal.find(x => x.id === id);
    if (!pedido) return;

    const tablaPedidos = document.getElementById("tablaPedidos");
    if (!tablaPedidos) return;

    const filaPedido = tablaPedidos.querySelector(`tr[data-id="${id}"]`);
    if (!filaPedido) return;

    const detalleExistente = tablaPedidos.querySelector(".pedido-detalle-row");
    if (detalleExistente && pedidoDetalleActivoId === id) {
        detalleExistente.remove();
        pedidoDetalleActivoId = null;
        return;
    }

    if (detalleExistente) {
        detalleExistente.remove();
    }

    pedidoDetalleActivoId = id;

    const colSpan = filaPedido.children.length || 1;
    const detalleRow = document.createElement("tr");
    detalleRow.className = "pedido-detalle-row";
    detalleRow.innerHTML = `<td colspan="${colSpan}"><div id="detalleExpandido" class="detalle-expandido" style="display:block; margin:10px 0;"></div></td>`;
    filaPedido.insertAdjacentElement("afterend", detalleRow);

    const detalle = detalleRow.querySelector("#detalleExpandido");
    const archivos = Array.isArray(pedido.archivos) ? pedido.archivos : [];
    const archivosHtml = archivos.length
        ? archivos.map((a, i) => {
            const url = archivoUrl(a);
            const nombre = archivoNombre(a, i);
            const tipo = archivoTipo(a);

            if (!url) {
                return `<div class="adjunto-item adjunto-empty">${nombre} - Sin URL de visualización</div>`;
            }

            const isImage = tipo.startsWith("image/");
            const inline = !!a?.inline;

            return `
                <div class="adjunto-item">
                    <div class="adjunto-nombre" title="${nombre}">${nombre}</div>
                    <div class="adjunto-media-row">
                        ${isImage ? `<img src="${url}" alt="${nombre}" class="adjunto-thumb" />` : `<div class="adjunto-file-icon"><i class="ri-file-line"></i></div>`}
                        <div class="adjunto-actions">
                            <button type="button" class="adjunto-link ver" onclick='verArchivoAdjunto(${JSON.stringify(url)}, ${JSON.stringify(tipo)}, ${JSON.stringify(nombre)}, ${inline})'>Ver archivo</button>
                            <a class="adjunto-link descargar" href="${url}" download="${nombre}">Descargar</a>
                        </div>
                    </div>
                </div>
            `;
        }).join("")
        : "<div class=\"adjunto-empty\">Sin adjuntos</div>";

    detalle.innerHTML = `
        <h3>Detalles del Pedido: ${pedido.codigo}</h3>

        <div class="detalle-grid" id="detalleContenido">
            <div class="detalle-grupo">
                <label>Código</label>
                <input type="text" id="edit-codigo" value="${pedido.codigo || ""}" disabled>
            </div>

            <div class="detalle-grupo">
                <label>Monto (S/.)</label>
                <input type="number" id="edit-monto" value="${pedido.monto || 0}" step="0.01">
            </div>

            <div class="detalle-grupo">
                <label>Nombre</label>
                <input type="text" id="edit-nombre" value="${pedido.nombre || ""}">
            </div>

            <div class="detalle-grupo">
                <label>Teléfono</label>
                <input type="text" id="edit-telefono" value="${pedido.telefono || ""}">
            </div>

            <div class="detalle-grupo">
                <label>Tipo de Cliente</label>
                <select id="edit-cliente">
                    <option value="clinica" ${pedido.cliente === "clinica" || pedido.cliente === "Clínica Dental" ? "selected" : ""}>Clínica Dental</option>
                    <option value="odontologo" ${pedido.cliente === "odontologo" || pedido.cliente === "Odontólogo Independiente" ? "selected" : ""}>Odontólogo Independiente</option>
                    <option value="hospital" ${pedido.cliente === "hospital" || pedido.cliente === "Hospital" ? "selected" : ""}>Hospital</option>
                    <option value="particular" ${pedido.cliente === "particular" || pedido.cliente === "Paciente Particular" ? "selected" : ""}>Paciente Particular</option>
                </select>
            </div>

            <div class="detalle-grupo">
                <label>Servicio</label>
                <input type="text" id="edit-servicio" value="${pedido.servicio || ""}">
            </div>

            <div class="detalle-grupo">
                <label>Urgencia</label>
                <select id="edit-urgencia">
                    <option value="normal" ${pedido.urgencia === "normal" ? "selected" : ""}>Normal (7-10 días)</option>
                    <option value="urgente" ${pedido.urgencia === "urgente" ? "selected" : ""}>Urgente (3-5 días)</option>
                    <option value="emergencia" ${pedido.urgencia === "emergencia" ? "selected" : ""}>Emergencia (24-48 horas)</option>
                </select>
            </div>

            <div class="detalle-grupo">
                <label>Tipo de Trabajo</label>
                <select id="edit-tipoTrabajo">
                    <option value="estandar" ${pedido.tipoTrabajo === "estandar" ? "selected" : ""}>Trabajo Estándar</option>
                    <option value="personalizado" ${pedido.tipoTrabajo === "personalizado" ? "selected" : ""}>Trabajo Personalizado</option>
                </select>
            </div>

            <div class="detalle-grupo">
                <label>Estado</label>
                <select id="edit-estado">
                    <option value="pendiente" ${pedido.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="en proceso" ${pedido.estado === "en proceso" ? "selected" : ""}>En proceso</option>
                    <option value="terminado" ${pedido.estado === "terminado" ? "selected" : ""}>Terminado</option>
                </select>
            </div>

            <div class="detalle-grupo">
                <label>Método de Entrega</label>
                <select id="edit-entrega">
                    <option value="recojo_lab" ${pedido.entrega === "recojo_lab" || pedido.entrega === "Recojo en laboratorio" ? "selected" : ""}>Recojo en laboratorio</option>
                    <option value="delivery" ${pedido.entrega === "delivery" || pedido.entrega === "Delivery" ? "selected" : ""}>Delivery gratuito</option>
                    <option value="courier" ${pedido.entrega === "courier" || pedido.entrega === "Courier" ? "selected" : ""}>Courier</option>
                </select>
            </div>

            <div class="detalle-grupo">
                <label>Detalles del caso</label>
                <textarea id="edit-detalle">${pedido.detalle || ""}</textarea>
            </div>

            <div class="detalle-grupo">
                <label>Archivos adjuntos</label>
                <div id="archivos-adjuntos" class="adjuntos-container">${archivosHtml}</div>
            </div>

            <div class="detalle-acciones">
                <button class="btn-guardar" onclick="guardarCambios('${id}')">
                    <i class="ri-save-line"></i> Guardar Cambios
                </button>
                <button class="btn-cancelar" onclick="cerrarDetalle()">
                    <i class="ri-close-line"></i> Cerrar
                </button>
            </div>
        </div>
    `;

    detalle.scrollIntoView({ behavior: "smooth", block: "nearest" });
};


window.guardarCambios = async (id) => {
    const pedido = listaGlobal.find(p => p.id === id);
    if (!pedido) return;

    const nuevoMonto = parseFloat(document.getElementById("edit-monto").value);
    const nuevoNombre = document.getElementById("edit-nombre").value;
    const nuevoTelefono = document.getElementById("edit-telefono").value;
    const nuevoCliente = document.getElementById("edit-cliente").value;
    const nuevoServicio = document.getElementById("edit-servicio").value;
    const nuevoEstado = document.getElementById("edit-estado").value;
    const nuevoEntrega = document.getElementById("edit-entrega").value;
    const nuevaUrgencia = document.getElementById("edit-urgencia")?.value || "normal";
    const nuevoTipoTrabajo = document.getElementById("edit-tipoTrabajo")?.value || "estandar";
    const nuevoDetalle = document.getElementById("edit-detalle").value;

    if (!nuevoNombre || !nuevoTelefono) {
        notifyAdmin("Nombre y teléfono son obligatorios", "warning");
        return;
    }

    try {
        await updateDoc(doc(db, "solicitudes", id), {
            monto: nuevoMonto,
            nombre: nuevoNombre,
            telefono: nuevoTelefono,
            cliente: nuevoCliente,
            servicio: nuevoServicio,
            estado: nuevoEstado,
            entrega: nuevoEntrega,
            urgencia: nuevaUrgencia,
            tipoTrabajo: nuevoTipoTrabajo,
            detalle: nuevoDetalle
        });

        notifyAdmin("Cambios guardados correctamente", "success");
        cerrarDetalle();
    } catch (error) {
        console.error(error);
        notifyAdmin("Error al guardar cambios", "error");
    }
};


window.cerrarDetalle = () => {
    const tablaPedidos = document.getElementById("tablaPedidos");
    const detalleExistente = tablaPedidos?.querySelector(".pedido-detalle-row");
    if (detalleExistente) {
        detalleExistente.remove();
    }
    pedidoDetalleActivoId = null;
    cerrarModalArchivo();
};


window.filtrar = () => {
    const txt = document.getElementById("buscar").value.toLowerCase();

    const filtrados = listaGlobal.filter(d =>
        (d.codigo || "").toLowerCase().includes(txt) ||
        (d.nombre || "").toLowerCase().includes(txt)
    );

    renderTabla(filtrados);
};


window.cambiarEstado = async (id, estado) => {
    const pedido = listaGlobal.find(p => p.id === id);
    if (!pedido) return;

    await updateDoc(doc(db, "solicitudes", id), {
        estado,
        historial: [
            ...(pedido.historial || []),
            { estado, fecha: new Date() }
        ]
    });
};


window.eliminar = async (id) => {
    const ok = await confirmAdmin("¿Eliminar este pedido?");
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "solicitudes", id));
        notifyAdmin("Pedido eliminado", "success");
    } catch (error) {
        console.error(error);
        notifyAdmin("No se pudo eliminar el pedido", "error");
    }
};

function generarCodigoPedido() {
    const usados = new Set((listaGlobal || []).map(p => (p.codigo || "").toUpperCase()));
    let codigo = "";

    do {
        codigo = "CD-" + Math.floor(10000 + Math.random() * 90000);
    } while (usados.has(codigo));

    return codigo;
}

function limpiarPedidoForm() {
    const defaults = {
        "pedido-codigo": "",
        "pedido-nombre": "",
        "pedido-telefono": "",
        "pedido-cliente": "clinica",
        "pedido-servicio": "",
        "pedido-tipoTrabajo": "nuevo",
        "pedido-monto": "",
        "pedido-urgencia": "normal",
        "pedido-entrega": "delivery",
        "pedido-estado": "pendiente",
        "pedido-detalles": ""
    };

    Object.entries(defaults).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
}

window.mostrarFormularioPedido = () => {
    const form = document.getElementById("pedidoForm");
    if (!form) return;

    limpiarPedidoForm();
    renderOpcionesServicioPedido(serviciosGlobal);
    form.style.display = "block";
    document.getElementById("pedido-nombre")?.focus();
};

window.cerrarPedidoForm = () => {
    const form = document.getElementById("pedidoForm");
    if (!form) return;

    form.style.display = "none";
};

window.guardarPedidoManual = async () => {
    const codigoInput = document.getElementById("pedido-codigo")?.value?.trim()?.toUpperCase();
    const nombre = document.getElementById("pedido-nombre")?.value?.trim();
    const telefono = document.getElementById("pedido-telefono")?.value?.trim();
    const cliente = document.getElementById("pedido-cliente")?.value || "clinica";
    const servicio = document.getElementById("pedido-servicio")?.value?.trim();
    const tipoTrabajo = document.getElementById("pedido-tipoTrabajo")?.value || "nuevo";
    const monto = parseFloat(document.getElementById("pedido-monto")?.value || "0");
    const urgencia = document.getElementById("pedido-urgencia")?.value || "normal";
    const entrega = document.getElementById("pedido-entrega")?.value || "delivery";
    const estado = document.getElementById("pedido-estado")?.value || "pendiente";
    const detalles = document.getElementById("pedido-detalles")?.value?.trim() || "";

    if (!nombre || !telefono || !servicio || monto <= 0) {
        notifyAdmin("Completa los campos obligatorios: nombre, teléfono, servicio y monto válido.", "warning", 4200);
        return;
    }

    const codigo = codigoInput || generarCodigoPedido();
    const codigoExistente = (listaGlobal || []).some(p => (p.codigo || "").toUpperCase() === codigo);
    if (codigoExistente) {
        notifyAdmin("El código ya existe. Ingresa otro código o déjalo vacío para generarlo automáticamente.", "warning", 4200);
        return;
    }

    const ahora = new Date();
    const payload = {
        codigo,
        nombre,
        telefono,
        cliente,
        servicio,
        tipoTrabajo,
        monto,
        urgencia,
        entrega,
        estado,
        detalles,
        fecha: ahora,
        archivos: [],
        historial: [{ estado, fecha: ahora }],
        origen: "manual_admin"
    };

    try {
        await addDoc(collection(db, "solicitudes"), payload);
        notifyAdmin("Pedido registrado correctamente.", "success");
        cerrarPedidoForm();
    } catch (error) {
        console.error("Error al guardar pedido manual:", error);
        notifyAdmin("No se pudo registrar el pedido manual.", "error");
    }
};


function calcularIngresos(lista) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const mesActual = new Date();
    mesActual.setDate(1);
    mesActual.setHours(0, 0, 0, 0);

    const anioActual = new Date();
    anioActual.setMonth(0, 1);
    anioActual.setHours(0, 0, 0, 0);

    let ingresoHoy = 0;
    let ingresoMes = 0;
    let ingresoAnio = 0;
    let ingresoTotal = 0;

    
    const pedidosTerminados = lista.filter(d => d.estado === "terminado");

    pedidosTerminados.forEach(p => {
        const monto = parseFloat(p.monto || 0);
        if (monto > 0) {
            ingresoTotal += monto;

            if (p.fecha) {
                const fecha = new Date(p.fecha.seconds * 1000);
                fecha.setHours(0, 0, 0, 0);

                
                if (fecha.getTime() === hoy.getTime()) {
                    ingresoHoy += monto;
                }

                
                if (fecha >= mesActual) {
                    ingresoMes += monto;
                }

                
                if (fecha >= anioActual) {
                    ingresoAnio += monto;
                }
            }
        }
    });

    return {
        hoy: ingresoHoy,
        mes: ingresoMes,
        anio: ingresoAnio,
        total: ingresoTotal
    };
}


let chartIngresos;

function renderGraficoIngresos(lista) {
    const pedidosTerminados = lista.filter(d => d.estado === "terminado");

    
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const ingresosPorMes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    pedidosTerminados.forEach(p => {
        const monto = parseFloat(p.monto || 0);
        if (monto > 0 && p.fecha) {
            const fecha = new Date(p.fecha.seconds * 1000);
            const mes = fecha.getMonth();
            ingresosPorMes[mes] += monto;
        }
    });

    const ctx = document.getElementById("graficoIngresos");
    if (!ctx) return;

    if (chartIngresos) chartIngresos.destroy();

    chartIngresos = new Chart(ctx, {
        type: "line",
        data: {
            labels: meses,
            datasets: [{
                label: "Ingresos (S/)",
                data: ingresosPorMes,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#3b82f6",
                pointBorderColor: "#fff",
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5f5"
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cbd5f5"
                    },
                    grid: {
                        color: "#334155"
                    }
                },
                x: {
                    ticks: {
                        color: "#cbd5f5"
                    },
                    grid: {
                        color: "#334155"
                    }
                }
            }
        }
    });
}


function renderKPIsIngresos(lista) {
    const ingresos = calcularIngresos(lista);

    document.getElementById("ingresoHoy") && (document.getElementById("ingresoHoy").innerText = `S/ ${ingresos.hoy.toFixed(2)}`);
    document.getElementById("ingresoMes") && (document.getElementById("ingresoMes").innerText = `S/ ${ingresos.mes.toFixed(2)}`);
    document.getElementById("ingresoAnio") && (document.getElementById("ingresoAnio").innerText = `S/ ${ingresos.anio.toFixed(2)}`);
    document.getElementById("ingresoTotal") && (document.getElementById("ingresoTotal").innerText = `S/ ${ingresos.total.toFixed(2)}`);
}


function renderTablaIngresos(lista) {
    const tabla = document.getElementById("tablaIngresos");
    if (!tabla) return;

    tabla.innerHTML = "";

    
    const pedidosTerminados = lista
        .filter(d => d.estado === "terminado")
        .sort((a, b) => {
            if (!a.fecha) return 1;
            if (!b.fecha) return -1;
            return b.fecha.seconds - a.fecha.seconds;
        });

    pedidosTerminados.forEach(data => {
        const monto = parseFloat(data.monto || 0);
        if (monto > 0) {
            const fila = document.createElement("tr");

            fila.innerHTML = `
                <td>${data.codigo || "-"}</td>
                <td>${data.nombre || "-"}</td>
                <td>${data.servicio || "-"}</td>
                <td>S/ ${monto.toFixed(2)}</td>
                <td>${data.fecha ? new Date(data.fecha.seconds * 1000).toLocaleDateString() : "-"}</td>
                <td><span class="badge terminado">Completado</span></td>
            `;

            tabla.appendChild(fila);
        }
    });

    if (pedidosTerminados.length === 0) {
        tabla.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#888;'>No hay ingresos registrados</td></tr>";
    }
}


window.exportarIngresosPDF = () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const ingresos = calcularIngresos(listaGlobal);
    const hoy = new Date().toLocaleDateString();

    pdf.setFontSize(16);
    pdf.text("Reporte de Ingresos", 10, 10);

    pdf.setFontSize(11);
    pdf.text(`Fecha: ${hoy}`, 10, 20);

    pdf.setFontSize(12);
    pdf.text(`Ingreso Hoy: S/ ${ingresos.hoy.toFixed(2)}`, 10, 35);
    pdf.text(`Ingreso Este Mes: S/ ${ingresos.mes.toFixed(2)}`, 10, 45);
    pdf.text(`Ingreso Este Año: S/ ${ingresos.anio.toFixed(2)}`, 10, 55);
    pdf.text(`Ingreso Total: S/ ${ingresos.total.toFixed(2)}`, 10, 65);

    let y = 80;
    pdf.setFontSize(11);
    pdf.text("Detalle de Pedidos Completados:", 10, y);

    y += 10;
    const pedidosTerminados = listaGlobal.filter(d => d.estado === "terminado");

    pedidosTerminados.forEach(d => {
        const monto = parseFloat(d.monto || 0);
        if (monto > 0) {
            pdf.setFontSize(10);
            const fecha = d.fecha ? new Date(d.fecha.seconds * 1000).toLocaleDateString() : "-";
            pdf.text(`${d.codigo} - ${d.nombre} - S/ ${monto.toFixed(2)} - ${fecha}`, 10, y);
            y += 10;

            if (y > 280) {
                pdf.addPage();
                y = 10;
            }
        }
    });

    pdf.save(`ingresos-${hoy}.pdf`);
};


window.generarReporteDetallado = () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    let y = 15;

    
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text("REPORTE DETALLADO DE PEDIDOS", margin, y);
    y += 10;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text("Carranza Dental Lab - " + new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(), margin, y);
    y += 12;

    
    listaGlobal.forEach((d, idx) => {
        if (y > pageHeight - 35) {
            pdf.addPage();
            y = margin;
        }

        const fechaDate = getFechaDate(d.fecha);
        const fecha = fechaDate ? fechaDate.toLocaleDateString() : '-';

        
        pdf.setFillColor(220, 240, 255);
        pdf.rect(margin, y - 1, pageWidth - 2*margin, 10, 'F');
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(10);
        pdf.text("PEDIDO #" + d.codigo + " - " + d.nombre, margin + 3, y + 6);
        y += 12;

        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.text("CLIENTE:", margin, y);
        pdf.setFont(undefined, 'normal');
        y += 4;
        pdf.text("Nombre: " + d.nombre, margin + 2, y);
        y += 4;
        pdf.text("Tipo: " + clienteLabel(d.cliente), margin + 2, y);
        y += 4;
        pdf.text("Telefono: " + (d.telefono || 'N/A') + " | Email: " + (d.email || 'N/A'), margin + 2, y);
        y += 8;

        
        pdf.setFont(undefined, 'bold');
        pdf.text("SERVICIO:", margin, y);
        pdf.setFont(undefined, 'normal');
        y += 4;
        pdf.text("Descripcion: " + (d.servicio || '-'), margin + 2, y);
        y += 4;
        if (d.tipoTrabajo) {
            pdf.text("Tipo Trabajo: " + d.tipoTrabajo, margin + 2, y);
            y += 4;
        }
        pdf.text("Monto: S/ " + parseFloat(d.monto || 0).toFixed(2) + " | Urgencia: " + (d.urgencia || '-'), margin + 2, y);
        y += 4;
        pdf.text("Entrega: " + entregaLabel(d.entrega) + " | Estado: " + (d.estado || '-').toUpperCase(), margin + 2, y);
        y += 4;
        pdf.text("Fecha: " + fecha, margin + 2, y);
        y += 8;

        
        if (d.detalles) {
            pdf.setFont(undefined, 'bold');
            pdf.text("DETALLES:", margin, y);
            pdf.setFont(undefined, 'normal');
            y += 4;
            const lines = d.detalles.split('\n');
            lines.forEach(line => {
                if (y > pageHeight - 25) {
                    pdf.addPage();
                    y = margin;
                }
                pdf.text(line.substring(0, 85), margin + 2, y);
                y += 4;
            });
            y += 2;
        }

        
        if (d.archivos && d.archivos.length > 0) {
            pdf.setFont(undefined, 'bold');
            pdf.text("ADJUNTOS (" + d.archivos.length + "):", margin, y);
            pdf.setFont(undefined, 'normal');
            y += 4;
            d.archivos.forEach((arch, i) => {
                if (y > pageHeight - 25) {
                    pdf.addPage();
                    y = margin;
                }
                const nombre = archivoNombre(arch, i);
                pdf.text((i+1) + ". " + nombre, margin + 2, y);
                y += 4;
            });
            y += 2;
        }

        y += 5;
        pdf.setDrawColor(180, 180, 180);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
    });

    
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Generado en: ' + new Date().toLocaleString(), margin, pageHeight - 8);

    pdf.save('reporte-detallado-' + new Date().toISOString().split('T')[0] + '.pdf');
};


window.logout = () => {
    signOut(auth).then(() => {
        window.location.href = "login.html";
    });
};


const sections = document.querySelectorAll("main section");
const menuItems = document.querySelectorAll(".sidebar li");

window.mostrarSeccion = function (id, e) {
    sections.forEach(sec => sec.classList.remove("active"));
    document.getElementById(id).classList.add("active");

    menuItems.forEach(item => item.classList.remove("active"));
    e.currentTarget.classList.add("active");

    
    cerrarDetalle();
    if (typeof window.cerrarPedidoForm === "function") {
        window.cerrarPedidoForm();
    }
};


window.addEventListener("DOMContentLoaded", () => {
    sections.forEach(sec => sec.classList.remove("active"));
    const pedidos = document.getElementById("pedidos");
    if (pedidos) pedidos.classList.add("active");

    menuItems.forEach(item => item.classList.remove("active"));
    const pedidoMenu = Array.from(menuItems).find(item => item.textContent.includes("Pedidos"));
    if (pedidoMenu) pedidoMenu.classList.add("active");
});