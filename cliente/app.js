// Cliente EventFlow: HTML + CSS + JavaScript vanilla (fetch y manipulación manual del DOM)
const API = 'http://127.0.0.1:8000/api';
const $ = (id) => document.getElementById(id);

const ETIQUETA_ESTADO = { operativo: 'Operativo', mantenimiento: 'En mantenimiento', fuera_servicio: 'Fuera de servicio' };
let credenciales = null; // solo en memoria; se pierde al recargar
let espacios = [];

/* ---------- utilidades ---------- */
function el(tag, props = {}, ...hijos) {
    const nodo = document.createElement(tag);
    for (const [clave, valor] of Object.entries(props)) {
        if (clave === 'class') nodo.className = valor;
        else if (clave === 'text') nodo.textContent = valor; // textContent evita inyección de HTML
        else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
        else nodo.setAttribute(clave, valor);
    }
    nodo.append(...hijos);
    return nodo;
}

function avisar(mensaje, tipo = 'ok') {
    const aviso = el('div', { class: `aviso aviso-${tipo}`, role: tipo === 'error' ? 'alert' : 'status', text: mensaje });
    $('avisos').append(aviso);
    setTimeout(() => aviso.remove(), 5500);
}

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
    const cabeceras = { Accept: 'application/json' };
    if (cuerpo) cabeceras['Content-Type'] = 'application/json';
    if (credenciales) cabeceras.Authorization = `Basic ${credenciales}`;
    const resp = await fetch(API + ruta, { method: metodo, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null;
    if (resp.status !== 204) {
        try { datos = await resp.json(); } catch { datos = null; }
    }
    if (!resp.ok) {
        const error = new Error(`HTTP ${resp.status}`);
        error.status = resp.status;
        error.datos = datos;
        throw error;
    }
    return datos;
}

function mensajeDeError(err) {
    if (!err.status) return 'No se pudo conectar con la API. Revisa que runserver esté activo y que CORS permita este origen.';
    if (err.status === 401 || err.status === 403) return 'Esta acción requiere iniciar sesión.';
    if (err.status === 404) return 'El registro ya no existe.';
    if (err.status === 409) return (err.datos && err.datos.detail) || 'El registro está en uso y no se puede eliminar.';
    if (err.status === 400) return 'El servidor rechazó los datos. Revisa los campos marcados.';
    return `Error inesperado (${err.status}).`;
}

function limpiarErrores(form) {
    form.querySelectorAll('.error-campo').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('.invalido').forEach((c) => c.classList.remove('invalido'));
}

function pintarErrores(form, datos) {
    limpiarErrores(form);
    if (!datos || typeof datos !== 'object') return;
    for (const [campo, mensajes] of Object.entries(datos)) {
        const texto = Array.isArray(mensajes) ? mensajes.join(' ') : String(mensajes);
        const destino = form.querySelector(`[data-error="${campo}"]`);
        if (destino) {
            destino.textContent = texto;
            destino.previousElementSibling?.classList.add('invalido');
        } else {
            avisar(texto, 'error');
        }
    }
}

const soles = (valor) => `S/ ${Number(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------- pintar espacios ---------- */
function pintarEspacios() {
    const contenedor = $('listaEspacios');
    contenedor.replaceChildren();
    $('contEspacios').textContent = `${espacios.length} registrados`;
    if (!espacios.length) {
        contenedor.append(el('p', { class: 'vacio', text: 'Aún no hay espacios. Registra el primero desde el panel de la derecha.' }));
    }
    for (const e of espacios) {
        const tarjeta = el('article', { class: 'espacio', 'data-estado': e.estado },
            el('h3', { text: e.nombre }),
            el('p', { class: 'lugar', text: e.ubicacion }),
            el('p', { class: 'aforo' }, String(e.aforo_maximo), el('small', { text: 'personas' })),
            el('div', { class: 'pie-tarjeta' },
                el('span', { class: `chip estado-${e.estado}`, text: ETIQUETA_ESTADO[e.estado] || e.estado }),
                el('span', { class: 'meta', text: `${e.total_recursos} equipos` }),
            ),
            el('div', { class: 'pie-tarjeta' },
                el('span'),
                el('button', { type: 'button', class: 'boton-peligro', text: 'Eliminar', onclick: () => eliminar(`/espacios/${e.id}/`, e.nombre) }),
            ),
        );
        contenedor.append(tarjeta);
    }
    llenarSelects();
}

function llenarSelects() {
    const filtro = $('filtroEspacio');
    const seleccionado = filtro.value;
    filtro.replaceChildren(el('option', { value: '', text: 'Todos' }));
    const formulario = $('selectEspacio');
    formulario.replaceChildren();
    for (const e of espacios) {
        filtro.append(el('option', { value: e.id, text: e.nombre }));
        formulario.append(el('option', { value: e.id, text: `${e.nombre} (${e.ubicacion})` }));
    }
    filtro.value = seleccionado;
}

/* ---------- pintar recursos ---------- */
function pintarRecursos(recursos) {
    const cuerpo = $('cuerpoRecursos');
    cuerpo.replaceChildren();
    $('contRecursos').textContent = `${recursos.length} mostrados`;
    $('vacioRecursos').hidden = recursos.length > 0;
    for (const r of recursos) {
        cuerpo.append(el('tr', {},
            el('td', { text: r.nombre }),
            el('td', { class: 'codigo', text: r.codigo_inventario }),
            el('td', { text: r.espacio_detalle.nombre }),
            el('td', { class: 'num', text: soles(r.costo) }),
            el('td', { class: 'num', text: String(r.stock) }),
            el('td', { class: 'num' },
                el('button', { type: 'button', class: 'boton-peligro', text: 'Eliminar', onclick: () => eliminar(`/recursos/${r.id}/`, r.nombre) })),
        ));
    }
}

/* ---------- carga de datos (GET) ---------- */
function consultaFiltros() {
    const p = new URLSearchParams();
    if ($('filtroEspacio').value) p.set('espacio', $('filtroEspacio').value);
    if ($('filtroMin').value.trim()) p.set('costo_min', $('filtroMin').value.trim());
    if ($('filtroMax').value.trim()) p.set('costo_max', $('filtroMax').value.trim());
    const texto = p.toString();
    return texto ? `?${texto}` : '';
}

async function cargarRecursos() {
    try {
        pintarRecursos(await pedir(`/recursos/${consultaFiltros()}`));
    } catch (err) {
        avisar(err.status === 400 ? 'Los filtros de costo deben ser números, por ejemplo 150.50.' : mensajeDeError(err), 'error');
    }
}

async function cargarTodo() {
    try {
        espacios = await pedir('/espacios/');
        pintarEspacios();
        await cargarRecursos();
        marcarApi('ok', 'API conectada');
    } catch (err) {
        marcarApi('error', 'Sin conexión con la API');
        avisar(mensajeDeError(err), 'error');
    }
}

function marcarApi(tipo, texto) {
    const chip = $('estadoApi');
    chip.className = `chip chip-${tipo}`;
    chip.textContent = credenciales && tipo === 'ok' ? `${texto} · sesión activa` : texto;
}

/* ---------- registrar (POST) y eliminar (DELETE) ---------- */
async function enviar(form, ruta, cuerpo, mensajeOk) {
    limpiarErrores(form);
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
        await pedir(ruta, { metodo: 'POST', cuerpo });
        avisar(mensajeOk, 'ok');
        form.reset();
        await cargarTodo(); // la vista se actualiza al instante
    } catch (err) {
        if (err.status === 400) pintarErrores(form, err.datos);
        avisar(mensajeDeError(err), 'error');
    } finally {
        boton.disabled = false;
    }
}

async function eliminar(ruta, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
        await pedir(ruta, { metodo: 'DELETE' });
        avisar(`"${nombre}" eliminado.`, 'ok');
        await cargarTodo();
    } catch (err) {
        avisar(mensajeDeError(err), 'error');
    }
}

$('formRecurso').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const d = new FormData(f);
    // Se envía tal cual: la validación defensiva es del backend
    enviar(f, '/recursos/', {
        nombre: d.get('nombre'),
        codigo_inventario: d.get('codigo_inventario'),
        costo: d.get('costo'),
        stock: d.get('stock') === '' ? null : d.get('stock'),
        espacio: d.get('espacio') || null,
    }, 'Recurso guardado.');
});

$('formEspacio').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const d = new FormData(f);
    enviar(f, '/espacios/', {
        nombre: d.get('nombre'),
        ubicacion: d.get('ubicacion'),
        aforo_maximo: d.get('aforo_maximo') === '' ? null : d.get('aforo_maximo'),
        estado: d.get('estado'),
    }, 'Espacio guardado.');
});

/* ---------- filtros ---------- */
['filtroEspacio', 'filtroMin', 'filtroMax'].forEach((id) => $(id).addEventListener('change', cargarRecursos));
$('limpiarFiltros').addEventListener('click', () => { $('filtros').reset(); cargarRecursos(); });

/* ---------- pestañas ---------- */
function activarPestana(cual) {
    const esRecurso = cual === 'recurso';
    $('formRecurso').hidden = !esRecurso;
    $('formEspacio').hidden = esRecurso;
    $('tabRecurso').setAttribute('aria-selected', String(esRecurso));
    $('tabEspacio').setAttribute('aria-selected', String(!esRecurso));
}
$('tabRecurso').addEventListener('click', () => activarPestana('recurso'));
$('tabEspacio').addEventListener('click', () => activarPestana('espacio'));

/* ---------- sesión (Basic Auth hacia la API) ---------- */
$('formSesion').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    credenciales = btoa(unescape(encodeURIComponent(`${d.get('usuario')}:${d.get('clave')}`)));
    try {
        const r = await pedir('/sesion/');
        avisar(`Sesión iniciada como ${r.usuario}.`, 'ok');
        $('cerrarSesion').hidden = false;
        marcarApi('ok', 'API conectada');
    } catch (err) {
        credenciales = null;
        avisar(err.status ? 'Usuario o contraseña incorrectos.' : mensajeDeError(err), 'error');
    }
});
$('cerrarSesion').addEventListener('click', () => {
    credenciales = null;
    $('formSesion').reset();
    $('cerrarSesion').hidden = true;
    marcarApi('ok', 'API conectada');
    avisar('Sesión cerrada.', 'ok');
});

cargarTodo();