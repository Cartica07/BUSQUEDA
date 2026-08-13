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

// ---------- Migración de avisos viejos ----------
// Los avisos publicados antes de separar la foto grande en su propio nodo
// ("avisos_fotos") todavía tienen la foto completa embebida directamente
// en el registro liviano que se usa para armar el listado principal — por
// eso el listado sigue pesando lo mismo aunque los avisos NUEVOS ya no
// tengan ese problema. Esto recorre los avisos existentes una sola vez y,
// para cada uno que todavía tenga "imagenBase64" pegado en el registro
// liviano, genera la miniatura que le falta y mueve la foto grande a
// "avisos_fotos", dejando el registro liviano realmente liviano.
const btnMigrarFotos = document.getElementById('btnMigrarFotos');
const migracionEstado = document.getElementById('migracionEstado');

if (btnMigrarFotos) {
  btnMigrarFotos.addEventListener('click', () => migrarFotosAntiguas());
}

function redimensionarADataURL(img, maxWidth, calidad) {
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', calidad);
}

function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    img.src = dataUrl;
  });
}

async function migrarFotosAntiguas() {
  const pendientes = Object.entries(todosLosAvisos)
    .filter(([, aviso]) => aviso.imagenBase64);

  if (pendientes.length === 0) {
    migracionEstado.textContent = 'No hay avisos viejos por migrar — todo liviano ya.';
    return;
  }

  if (!confirm(`Se van a migrar ${pendientes.length} aviso(s). Esto puede tardar un rato y no se puede deshacer. ¿Continuar?`)) {
    return;
  }

  btnMigrarFotos.disabled = true;
  let ok = 0;
  let fallidos = 0;

  for (let i = 0; i < pendientes.length; i++) {
    const [id, aviso] = pendientes[i];
    migracionEstado.textContent = `Migrando ${i + 1}/${pendientes.length}...`;
    try {
      const fotoGrande = aviso.imagenBase64;
      // Si el aviso no tenía miniatura (avisos muy viejos, de antes de que
      // existiera ese campo), se genera ahora desde la foto grande.
      let mini = aviso.imagenMiniBase64;
      if (!mini) {
        const img = await cargarImagen(fotoGrande);
        mini = redimensionarADataURL(img, 360, 0.6);
      }

      const actualizaciones = {};
      actualizaciones['avisos/' + id + '/imagenMiniBase64'] = mini;
      actualizaciones['avisos/' + id + '/imagenBase64'] = null; // la borra del registro liviano
      actualizaciones['avisos_fotos/' + id] = { imagenBase64: fotoGrande };
      await db.ref().update(actualizaciones);
      ok++;
    } catch (err) {
      console.error('No se pudo migrar el aviso', id, err);
      fallidos++;
    }
  }

  btnMigrarFotos.disabled = false;
  migracionEstado.textContent = `Listo: ${ok} migrado(s)` + (fallidos ? `, ${fallidos} con error (revisá la consola).` : '.');
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
      // Primero se intenta borrar la foto grande, ya sea en Storage (si la
      // tiene) o en el nodo aparte "avisos_fotos" (si se guardó ahí como
      // respaldo). Si esto falla (por ejemplo, ya no existe) no debe
      // impedir borrar el aviso igual: por eso el error solo se registra
      // en consola, sin frenar nada.
      const borrarFoto = (aviso.imagenURL && storage)
        ? storage.refFromURL(aviso.imagenURL).delete().catch(err =>
            console.warn('No se pudo borrar la foto en Storage (se borra el aviso igual):', err))
        : db.ref('avisos_fotos/' + id).remove().catch(err =>
            console.warn('No se pudo borrar la foto aparte (se borra el aviso igual):', err));

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
