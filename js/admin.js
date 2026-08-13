// ============================================================
// PANEL DE ADMINISTRACIÓN — admin.html
// ============================================================
// Acceso restringido: solo entra quien inicia sesión con la cuenta de
// Firebase Authentication configurada como dueño/a de la página (ver
// README, sección "Panel de administración"). El control real de acceso
// vive en database.rules.json — este panel no aparece en la navegación
// pública, pero aunque alguien encuentre la URL no puede borrar ni editar
// nada sin esa cuenta: las reglas de Firebase lo bloquean del lado del
// servidor.

const loginWrap = document.getElementById('loginWrap');
const dashWrap = document.getElementById('dashWrap');
const formLogin = document.getElementById('formLogin');
const loginError = document.getElementById('loginError');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

const adminStats = document.getElementById('adminStats');
const adminList = document.getElementById('adminList');
const adminEmptyState = document.getElementById('adminEmptyState');
const tabsCategoriaAdmin = document.getElementById('tabsCategoriaAdmin');
const selectEstadoAdmin = document.getElementById('selectEstadoAdmin');
const buscarAdmin = document.getElementById('buscarAdmin');

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroEstado = 'todas';
let filtroTexto = '';
let escuchandoAvisos = false;

if (!auth) {
  loginError.textContent = 'Falta cargar el SDK de Firebase Authentication. Revisá admin.html.';
  loginError.classList.add('show');
}

// ---------- Login / logout ----------
formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.classList.remove('show');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  btnLogin.disabled = true;
  btnLogin.textContent = 'Ingresando...';

  auth.signInWithEmailAndPassword(email, password)
    .catch((err) => {
      console.error('Error al iniciar sesión:', err);
      loginError.textContent = 'No se pudo iniciar sesión. Revisá el correo y la contraseña.';
      loginError.classList.add('show');
    })
    .finally(() => {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Iniciar sesión';
    });
});

btnLogout.addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    loginWrap.style.display = 'none';
    dashWrap.style.display = 'block';
    btnLogout.style.display = 'inline-flex';
    if (!escuchandoAvisos) {
      escucharAvisos();
      escuchandoAvisos = true;
    }
  } else {
    loginWrap.style.display = 'flex';
    dashWrap.style.display = 'none';
    btnLogout.style.display = 'none';
  }
});

// ---------- Datos ----------
function escucharAvisos() {
  db.ref('avisos').on('value', (snapshot) => {
    todosLosAvisos = snapshot.val() || {};
    render();
  });
}

tabsCategoriaAdmin.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  [...tabsCategoriaAdmin.children].forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  filtroCategoria = btn.dataset.cat;
  render();
});

selectEstadoAdmin.addEventListener('change', () => {
  filtroEstado = selectEstadoAdmin.value;
  render();
});

buscarAdmin.addEventListener('input', () => {
  filtroTexto = buscarAdmin.value.trim().toLowerCase();
  render();
});

function render() {
  const entradas = Object.entries(todosLosAvisos)
    .filter(([id, a]) => filtroCategoria === 'todas' || a.categoria === filtroCategoria)
    .filter(([id, a]) => filtroEstado === 'todas' || (a.estado || 'buscando') === filtroEstado)
    .filter(([id, a]) => !filtroTexto || (a.nombre || '').toLowerCase().includes(filtroTexto))
    .sort((a, b) => (b[1].fecha || 0) - (a[1].fecha || 0));

  renderStats();

  adminList.innerHTML = '';
  if (entradas.length === 0) {
    adminEmptyState.style.display = 'block';
    return;
  }
  adminEmptyState.style.display = 'none';

  entradas.forEach(([id, aviso]) => {
    adminList.appendChild(crearFilaAdmin(id, aviso));
  });
}

function renderStats() {
  const todos = Object.values(todosLosAvisos);
  const total = todos.length;
  const buscando = todos.filter(a => (a.estado || 'buscando') === 'buscando').length;
  const encontrados = todos.filter(a => a.estado === 'encontrado').length;
  adminStats.innerHTML = `
    <div class="admin-stat"><span class="num">${total}</span><span class="lbl">Avisos totales</span></div>
    <div class="admin-stat"><span class="num">${buscando}</span><span class="lbl">Buscando</span></div>
    <div class="admin-stat"><span class="num">${encontrados}</span><span class="lbl">Encontrados</span></div>
  `;
}

function crearFilaAdmin(id, aviso) {
  const row = document.createElement('div');
  row.className = 'admin-row';

  const encontrado = aviso.estado === 'encontrado';
  const esTipoEncontrado = aviso.tipo === 'encontrado';
  const numComentarios = aviso.comentarios ? Object.keys(aviso.comentarios).length : 0;
  const lugar = [aviso.ciudad, aviso.sector].filter(Boolean).join(' · ') +
    (aviso.departamento ? ` (${aviso.departamento})` : '');

  row.innerHTML = `
    ${(aviso.imagenMiniBase64 || aviso.imagenURL || aviso.imagenBase64)
      ? `<img class="admin-thumb" src="${aviso.imagenMiniBase64 || aviso.imagenURL || aviso.imagenBase64}" alt="">`
      : `<div class="admin-thumb sin-foto">Sin foto</div>`}
    <div class="admin-row-body">
      <div class="admin-row-top">
        <span class="nombre">${escapeHtml(aviso.nombre || 'Sin nombre')}</span>
        <span class="stamp ${encontrado ? 'encontrado' : aviso.categoria}" style="position:static;transform:none;">${encontrado ? 'ENCONTRADO' : (aviso.categoria === 'mascota' ? 'MASCOTA' : 'PERSONA')}</span>
        <span class="mono" style="font-size:11px;color:var(--muted);">${esTipoEncontrado ? '· reportado como HALLADO' : '· reportado como PERDIDO'}</span>
      </div>
      <div class="admin-row-meta mono">${escapeHtml(lugar || 'Sin ubicación')} · ${formatoFecha(aviso.fecha)} · 💬 ${numComentarios}</div>
      <div class="admin-row-actions">
        <a href="aviso.html?id=${id}" target="_blank" rel="noopener" class="admin-btn">Ver aviso</a>
        <button type="button" class="admin-btn" data-accion="toggle" data-id="${id}" data-encontrado="${encontrado}">
          ${encontrado ? 'Marcar como buscando' : 'Marcar como encontrado'}
        </button>
        <button type="button" class="admin-btn admin-btn-danger" data-accion="eliminar" data-id="${id}">Eliminar</button>
      </div>
    </div>
  `;

  row.querySelector('[data-accion="toggle"]').addEventListener('click', (e) => {
    const nuevoEstado = e.target.dataset.encontrado === 'true' ? 'buscando' : 'encontrado';
    db.ref('avisos/' + id + '/estado').set(nuevoEstado)
      .catch(err => alert('No se pudo actualizar el estado: ' + err.message));
  });

  row.querySelector('[data-accion="eliminar"]').addEventListener('click', () => {
    if (confirm(`¿Eliminar definitivamente el aviso de "${aviso.nombre || 'sin nombre'}"? Esta acción no se puede deshacer.`)) {
      // Primero se intenta borrar la foto grande en Storage (si la tiene).
      // Si esto falla (por ejemplo, ya no existe, o Storage no está
      // disponible en esta página) no debe impedir borrar el aviso igual:
      // por eso el error solo se registra en consola, sin frenar nada.
      const borrarFoto = (aviso.imagenURL && storage)
        ? storage.refFromURL(aviso.imagenURL).delete().catch(err =>
            console.warn('No se pudo borrar la foto en Storage (se borra el aviso igual):', err))
        : Promise.resolve();

      borrarFoto.then(() => db.ref('avisos/' + id).remove())
        .catch(err => alert('No se pudo eliminar: ' + err.message));
    }
  });

  return row;
}

function formatoFecha(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' · ' +
         d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
