// ============================================================
// FEED PRINCIPAL — index.html
// ============================================================

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroCiudad = 'todas';

const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const contador = document.getElementById('contador');
const selectCiudad = document.getElementById('selectCiudad');
const tabsCategoria = document.getElementById('tabsCategoria');

// Escucha en tiempo real la lista de avisos, ordenados del más nuevo al más viejo
db.ref('avisos').on('value', (snapshot) => {
  todosLosAvisos = snapshot.val() || {};
  actualizarSelectCiudades();
  render();
});

tabsCategoria.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  [...tabsCategoria.children].forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  filtroCategoria = btn.dataset.cat;
  render();
});

selectCiudad.addEventListener('change', () => {
  filtroCiudad = selectCiudad.value;
  render();
});

function actualizarSelectCiudades() {
  const ciudades = new Set();
  Object.values(todosLosAvisos).forEach(a => { if (a.ciudad) ciudades.add(a.ciudad); });
  const actual = selectCiudad.value;
  selectCiudad.innerHTML = '<option value="todas">Todas las ciudades</option>' +
    [...ciudades].sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  selectCiudad.value = [...ciudades].includes(actual) ? actual : 'todas';
}

function render() {
  const entradas = Object.entries(todosLosAvisos)
    .filter(([id, a]) => filtroCategoria === 'todas' || a.categoria === filtroCategoria)
    .filter(([id, a]) => filtroCiudad === 'todas' || a.ciudad === filtroCiudad)
    .sort((a, b) => (b[1].fecha || 0) - (a[1].fecha || 0));

  contador.textContent = entradas.length + (entradas.length === 1 ? ' aviso' : ' avisos');
  grid.innerHTML = '';

  if (entradas.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  entradas.forEach(([id, aviso]) => {
    grid.appendChild(crearCard(id, aviso));
  });
}

function crearCard(id, aviso) {
  const a = document.createElement('a');
  a.href = `aviso.html?id=${id}`;
  a.className = 'card';

  const numComentarios = aviso.comentarios ? Object.keys(aviso.comentarios).length : 0;
  const stampClass = aviso.estado === 'encontrado' ? 'encontrado' : aviso.categoria;
  const stampTexto = aviso.estado === 'encontrado'
    ? (aviso.categoria === 'mascota' ? 'ENCONTRADO' : 'ENCONTRADO/A')
    : (aviso.categoria === 'mascota' ? 'PERDIDO' : 'SE BUSCA');

  a.innerHTML = `
    <div class="tape"></div>
    <div class="stamp ${stampClass}">${stampTexto}</div>
    ${aviso.imagenBase64
      ? `<img class="foto" src="${aviso.imagenBase64}" alt="Foto de ${escapeHtml(aviso.nombre || '')}">`
      : `<div class="foto sin-foto">Sin foto</div>`}
    <div class="body">
      <div class="nombre">${escapeHtml(aviso.nombre || 'Sin nombre')}</div>
      <div class="meta">
        ${aviso.edad ? `<span>${escapeHtml(aviso.edad)}</span>` : ''}
        <span class="mono">${aviso.categoria === 'mascota' ? 'MASCOTA' : 'PERSONA'}</span>
      </div>
      ${aviso.descripcion ? `<div class="desc">${escapeHtml(aviso.descripcion)}</div>` : ''}
      <div class="foot">
        <span class="ciudad">📍 ${escapeHtml(aviso.ciudad || 'Sin ciudad')}</span>
        <span class="comentarios-count">💬 ${numComentarios}</span>
      </div>
    </div>
  `;
  return a;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
