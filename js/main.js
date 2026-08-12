// ============================================================
// FEED PRINCIPAL — index.html
// ============================================================

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroDepartamento = 'todas';
let filtroCiudad = 'todas';
let filtroNombre = '';

const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const contador = document.getElementById('contador');
const selectDepartamento = document.getElementById('selectDepartamento');
const selectCiudad = document.getElementById('selectCiudad');
const tabsCategoria = document.getElementById('tabsCategoria');
const inputBuscar = document.getElementById('buscarNombre');

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
  poblarSelectCiudad(filtroDepartamento);
  render();
});

selectCiudad.addEventListener('change', () => {
  filtroCiudad = selectCiudad.value;
  render();
});

// Búsqueda por nombre: no distingue mayúsculas/minúsculas, ignora espacios
// de sobra y hace coincidencia parcial (con poner una parte del nombre
// alcanza, sin importar en qué lugar del nombre completo esté).
inputBuscar.addEventListener('input', () => {
  filtroNombre = normalizarTexto(inputBuscar.value);
  render();
});

function actualizarSelectDepartamentos() {
  const departamentos = new Set();
  Object.values(todosLosAvisos).forEach(a => { if (a.departamento) departamentos.add(a.departamento); });
  const actual = selectDepartamento.value;
  selectDepartamento.innerHTML = '<option value="todas">Todos los departamentos</option>' +
    [...departamentos].sort((a, b) => a.localeCompare(b, 'es')).map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  const sigueExistiendo = [...departamentos].includes(actual);
  selectDepartamento.value = sigueExistiendo ? actual : 'todas';
  filtroDepartamento = selectDepartamento.value;
  // Si el departamento que tenía elegido ya no está disponible, el filtro
  // de ciudad se recalcula desde cero (poblarSelectCiudad se encarga de
  // resetearlo si hace falta).
  poblarSelectCiudad(filtroDepartamento);
}

// El filtro de ciudad depende del departamento elegido: usa el listado
// completo de municipios de ese departamento (COLOMBIA_DATA, cargado desde
// js/colombia-data.js), no solo los que ya tienen avisos publicados, para
// que se pueda filtrar aunque todavía no haya avisos en esa ciudad.
function poblarSelectCiudad(depto) {
  if (!depto || depto === 'todas' || !COLOMBIA_DATA[depto]) {
    selectCiudad.innerHTML = '<option value="todas">Elige primero el departamento</option>';
    selectCiudad.disabled = true;
    filtroCiudad = 'todas';
    return;
  }

  const actual = filtroCiudad;
  const municipios = COLOMBIA_DATA[depto];
  selectCiudad.innerHTML = '<option value="todas">Todas las ciudades</option>' +
    municipios.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  selectCiudad.disabled = false;
  selectCiudad.value = municipios.includes(actual) ? actual : 'todas';
  filtroCiudad = selectCiudad.value;
}

function render() {
  const entradas = Object.entries(todosLosAvisos)
    .filter(([id, a]) => filtroCategoria === 'todas' || a.categoria === filtroCategoria)
    .filter(([id, a]) => filtroDepartamento === 'todas' || a.departamento === filtroDepartamento)
    .filter(([id, a]) => filtroCiudad === 'todas' || a.ciudad === filtroCiudad)
    .filter(([id, a]) => !filtroNombre || normalizarTexto(a.nombre).includes(filtroNombre))
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

// Deja el texto listo para comparar: sin espacios de sobra al inicio/final,
// todo en minúsculas y sin tildes (así "Sara" y "SARA " o "sára" matchean
// igual). Se usa tanto para lo que escribe la persona como para el nombre
// guardado en cada aviso.
function normalizarTexto(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
