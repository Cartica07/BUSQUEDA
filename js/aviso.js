// ============================================================
// PÁGINA DE DETALLE — aviso.html
// ============================================================

const params = new URLSearchParams(window.location.search);
const avisoId = params.get('id');

const contenedorAviso = document.getElementById('contenedorAviso');
const chatSection = document.getElementById('chatSection');
const chatList = document.getElementById('chatList');
const chatForm = document.getElementById('chatForm');

if (!avisoId) {
  contenedorAviso.innerHTML = `<p>No se encontró el aviso. <a href="index.html">Volver al inicio</a></p>`;
} else {
  cargarAviso();
  escucharComentarios();
}

// Si venís de la página principal (hay historial de navegación en esta
// pestaña), usamos el botón "atrás" nativo del navegador en vez de forzar
// una recarga con el link normal. Cuando el navegador lo permite, esto
// restaura la página principal tal cual estaba (mismos avisos ya pintados,
// mismo scroll) sin volver a pedir nada — es la forma más rápida posible
// de "volver". Si no hay desde dónde volver (por ejemplo, entraste directo
// a este aviso por un link compartido), se usa el link normal sin más.
const linkVolver = document.getElementById('linkVolver');
if (linkVolver && window.history.length > 1) {
  linkVolver.addEventListener('click', (e) => {
    e.preventDefault();
    window.history.back();
  });
}

function cargarAviso() {
  db.ref('avisos/' + avisoId).on('value', (snapshot) => {
    const aviso = snapshot.val();
    if (!aviso) {
      contenedorAviso.innerHTML = `<p>Este aviso ya no existe. <a href="index.html">Volver al inicio</a></p>`;
      chatSection.style.display = 'none';
      return;
    }
    renderAviso(aviso);
    chatSection.style.display = 'block';
  });
}

function renderAviso(aviso) {
  const resuelto = aviso.estado === 'encontrado';
  const esMascota = aviso.categoria === 'mascota';
  const esTipoEncontrado = aviso.tipo === 'encontrado';

  let stampTexto, stampClassFinal;
  if (esTipoEncontrado) {
    stampClassFinal = resuelto ? 'encontrado' : 'pendiente';
    stampTexto = resuelto ? (esMascota ? 'YA ENTREGADO' : 'YA ENTREGADO/A') : (esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A');
  } else if (resuelto) {
    stampClassFinal = 'encontrado';
    stampTexto = esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A';
  } else {
    stampClassFinal = aviso.categoria;
    stampTexto = esMascota ? 'PERDIDO' : 'SE BUSCA';
  }

  const mensajeWa = encodeURIComponent(
    `Hola, vi tu aviso de "${aviso.nombre}" en Se Busca y quería contarte algo al respecto.`
  );

  const textoBanner = esTipoEncontrado ? '✓ Marcado como entregado/reclamado' : '✓ Marcado como encontrado/a';
  const textoBotonResolver = esTipoEncontrado
    ? (esMascota ? 'Marcar como entregado' : 'Marcar como entregado/a')
    : (esMascota ? 'Marcar como encontrado' : 'Marcar como encontrado/a');

  contenedorAviso.innerHTML = `
    <div class="poster">
      <div class="tape"></div>
      <div class="stamp ${stampClassFinal}">${stampTexto}</div>
      ${aviso.imagenBase64
        ? `<img class="foto" src="${aviso.imagenBase64}" alt="Foto de ${escapeHtml(aviso.nombre)}">`
        : ''}
      <div class="body">
        <div class="nombre">${escapeHtml(aviso.nombre)}</div>
        <div class="meta">
          ${aviso.edad ? `<span>${escapeHtml(aviso.edad)}</span>` : ''}
          <span class="mono">${aviso.categoria === 'mascota' ? 'MASCOTA' : 'PERSONA'}</span>
          ${(aviso.ciudad || aviso.sector || aviso.departamento) ? `<span>📍 ${escapeHtml(lugarTexto(aviso))}</span>` : ''}
          <span class="mono">${formatoFecha(aviso.fecha)}</span>
        </div>
        ${aviso.descripcion ? `<div class="desc">${escapeHtml(aviso.descripcion)}</div>` : ''}

        ${resuelto ? `<div class="encontrado-banner">${textoBanner}</div>` : ''}

        ${aviso.whatsapp
          ? `<a class="whatsapp-btn" target="_blank" rel="noopener"
               href="https://wa.me/${aviso.whatsapp}?text=${mensajeWa}">
              Escribir por WhatsApp
            </a>`
          : `<div class="sin-whatsapp-aviso">Quien publicó este aviso no dejó WhatsApp. Dejale un mensaje en los comentarios de abajo para contactarlo.</div>`}
        ${aviso.redSocial ? `<div class="hint" style="margin-bottom:14px;">También en: ${escapeHtml(aviso.redSocial)}</div>` : ''}

        ${!resuelto ? `<button class="marcar-encontrado" id="btnEncontrado">${textoBotonResolver}</button>` : ''}
      </div>
    </div>
  `;

  const btnEncontrado = document.getElementById('btnEncontrado');
  if (btnEncontrado) {
    btnEncontrado.addEventListener('click', () => {
      const pregunta = esTipoEncontrado
        ? '¿Confirmás que ya lo entregaste o se lo reclamó su familia/dueño? Esto va a marcar el aviso como resuelto para todos.'
        : '¿Confirmás que ya apareció? Esto va a marcar el aviso como resuelto para todos.';
      if (confirm(pregunta)) {
        db.ref('avisos/' + avisoId + '/estado').set('encontrado');
      }
    });
  }
}

function escucharComentarios() {
  db.ref('avisos/' + avisoId + '/comentarios').on('value', (snapshot) => {
    const comentarios = snapshot.val() || {};
    const entradas = Object.entries(comentarios).sort((a, b) => (a[1].fecha || 0) - (b[1].fecha || 0));

    if (entradas.length === 0) {
      chatList.innerHTML = `<div class="chat-empty">Todavía no hay comentarios. Si sabés algo, escribí acá abajo.</div>`;
      return;
    }

    chatList.innerHTML = entradas.map(([id, c]) => `
      <div class="msg">
        <div class="msg-head">
          <span class="autor">${escapeHtml(c.autor || 'Anónimo')}</span>
          <span class="fecha">${formatoFecha(c.fecha)}</span>
        </div>
        <div class="texto">${escapeHtml(c.mensaje)}</div>
      </div>
    `).join('');
  });
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const autor = document.getElementById('chatAutor').value.trim();
  const mensaje = document.getElementById('chatMensaje').value.trim();
  if (!mensaje) return;

  db.ref('avisos/' + avisoId + '/comentarios').push({
    autor: autor || 'Anónimo',
    mensaje,
    fecha: Date.now()
  }).then(() => {
    document.getElementById('chatMensaje').value = '';
  });
});

function formatoFecha(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' · ' +
         d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// Arma el texto de ubicación combinando ciudad/municipio, sector y
// departamento, sin dejar separadores sueltos cuando algún dato falta.
function lugarTexto(aviso) {
  const partes = [];
  if (aviso.ciudad) partes.push(aviso.ciudad);
  if (aviso.sector) partes.push(aviso.sector);
  let texto = partes.join(' · ');
  if (aviso.departamento) texto += texto ? ` (${aviso.departamento})` : aviso.departamento;
  return texto;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
