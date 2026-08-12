// ============================================================
// FEED PRINCIPAL — index.html
// ============================================================

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroDepartamento = 'todas';

const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const contador = document.getElementById('contador');
const selectDepartamento = document.getElementById('selectDepartamento');
const tabsCategoria = document.getElementById('tabsCategoria');

// Escucha en tiempo real la lista de avisos, ordenados del más nuevo al más viejo
db.ref('avisos').on('value', (snapshot) => {
  todosLosAvisos = snapshot.val() || {};
  actualizarSelectDepartamentos();
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

selectDepartamento.addEventListener('change', () => {
  filtroDepartamento = selectDepartamento.value;
  render();
});

function actualizarSelectDepartamentos() {
  const departamentos = new Set();
  Object.values(todosLosAvisos).forEach(a => { if (a.departamento) departamentos.add(a.departamento); });
  const actual = selectDepartamento.value;
  selectDepartamento.innerHTML = '<option value="todas">Todos los departamentos</option>' +
    [...departamentos].sort((a, b) => a.localeCompare(b, 'es')).map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  selectDepartamento.value = [...departamentos].includes(actual) ? actual : 'todas';
}

function render() {
  const entradas = Object.entries(todosLosAvisos)
    .filter(([id, a]) => filtroCategoria === 'todas' || a.categoria === filtroCategoria)
    .filter(([id, a]) => filtroDepartamento === 'todas' || a.departamento === filtroDepartamento)
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
        <span class="ciudad">📍 ${escapeHtml(lugarTexto(aviso))}</span>
        <span class="comentarios-count">💬 ${numComentarios}</span>
      </div>
    </div>
  `;
  return a;
}

// Arma el texto de ubicación combinando ciudad/municipio, sector y
// departamento, sin dejar separadores sueltos cuando algún dato falta
// (varios campos son opcionales desde que se publica el aviso).
function lugarTexto(aviso) {
  const partes = [];
  if (aviso.ciudad) partes.push(aviso.ciudad);
  if (aviso.sector) partes.push(aviso.sector);
  let texto = partes.length ? partes.join(' · ') : 'Ubicación no especificada';
  if (aviso.departamento) texto += ` (${aviso.departamento})`;
  return texto;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
