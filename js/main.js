// ============================================================
// FEED PRINCIPAL — index.html (paginado incremental / "Cargar más")
// ============================================================

let loadedAvisos = {};            // avisos cargados hasta ahora (id -> aviso)
let loadedOrder = [];            // ids en orden descendente por fecha (más nuevo primero)
let filtroCategoria = 'todas';
let filtroDepartamento = 'todas';
let filtroCiudad = 'todas';
let filtroNombre = '';
let filtroTipo = 'perdido';

const PAGE_SIZE = 12;
const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const contador = document.getElementById('contador');
const selectDepartamento = document.getElementById('selectDepartamento');
const selectCiudad = document.getElementById('selectCiudad');
const tabsCategoria = document.getElementById('tabsCategoria');
const inputBuscar = document.getElementById('buscarNombre');
const tipoToggle = document.getElementById('tipoToggle');
const contadorPerdidos = document.getElementById('contadorPerdidos');
const contadorEncontrados = document.getElementById('contadorEncontrados');
const contadorResueltos = document.getElementById('contadorResueltos');
const btnCargarMas = document.getElementById('cargarMas');
const loadingIndicator = document.getElementById('loadingIndicator');

let loading = false;
let noMore = false;
let lastLoadedFecha = null; // fecha mínima (más antigua) cargada hasta ahora
let latestFecha = 0; // fecha máxima cargada, para notificaciones en tiempo real

// --- Inicial: cargar la primera página ---
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  limpiarGridMensaje();
  cargarPaginaInicial();
  setupRealtimeNewItems();
});

// --- Controles / filtros (igual que antes, pero aplicados sobre los avisos cargados) ---
function initControls() {
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

  inputBuscar.addEventListener('input', () => {
    filtroNombre = normalizarTexto(inputBuscar.value);
    render();
  });

  tipoToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.tipo-btn');
    if (!btn) return;
    [...tipoToggle.children].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroTipo = btn.dataset.tipo;
    render();
  });

  btnCargarMas.addEventListener('click', () => {
    if (!loading && !noMore) cargarPaginaSiguiente();
  });
}

// --- Cargar página inicial (los N avisos más recientes) ---
function cargarPaginaInicial() {
  loading = true;
  showLoading(true);
  // query: los N más recientes (limitToLast) luego los invertimos para mostrar descendente
  db.ref('avisos').orderByChild('fecha').limitToLast(PAGE_SIZE).once('value')
    .then(snapshot => {
      const val = snapshot.val() || {};
      const items = Object.entries(val); // [ [id, aviso], ... ] orden no garantizado
      // convertir a array y ordenar por fecha asc/desc adecuadamente
      const arr = items.map(([id, a]) => ({ id, a }));
      arr.sort((x, y) => (y.a.fecha || 0) - (x.a.fecha || 0)); // descendente
      if (arr.length === 0) {
        // no hay avisos en absoluto
        loadedAvisos = {};
        loadedOrder = [];
        actualizarSelectDepartamentos();
        render();
        noMore = true;
        btnCargarMas.style.display = 'none';
      } else {
        arr.forEach(({ id, a }) => {
          loadedAvisos[id] = a;
          loadedOrder.push(id);
        });
        lastLoadedFecha = arr[arr.length - 1].a.fecha || 0; // más antiguo de los cargados
        latestFecha = Math.max(latestFecha, arr[0].a.fecha || 0);
        // Si se trajeron menos que PAGE_SIZE, significa que no hay más
        if (arr.length < PAGE_SIZE) {
          noMore = true;
          btnCargarMas.style.display = 'none';
        } else {
          noMore = false;
          btnCargarMas.style.display = 'inline-block';
        }
        actualizarSelectDepartamentos();
        render();
      }
    })
    .catch(err => {
      console.error('Error cargando avisos iniciales', err);
    })
    .finally(() => {
      loading = false;
      showLoading(false);
    });
}

// --- Cargar página siguiente (más antiguos) ---
function cargarPaginaSiguiente() {
  if (loading || noMore) return;
  loading = true;
  showLoading(true);
  // endAt(lastLoadedFecha - 1) para traer items con fecha < lastLoadedFecha
  const endAtValue = (typeof lastLoadedFecha === 'number' && lastLoadedFecha > 0) ? lastLoadedFecha - 1 : lastLoadedFecha;
  let query = db.ref('avisos').orderByChild('fecha');
  if (endAtValue || endAtValue === 0) query = query.endAt(endAtValue);
  query = query.limitToLast(PAGE_SIZE);

  query.once('value')
    .then(snapshot => {
      const val = snapshot.val() || {};
      const items = Object.entries(val);
      // Si no hay elementos nuevos, marcamos noMore
      if (!items.length) {
        noMore = true;
        btnCargarMas.style.display = 'none';
        return;
      }
      const arr = items.map(([id, a]) => ({ id, a }));
      // Orden descendente por fecha
      arr.sort((x, y) => (y.a.fecha || 0) - (x.a.fecha || 0));
      // Evitar duplicados: puede ocurrir que endAt devuelva el mismo item por cómo se calcule la fecha
      const nuevos = arr.filter(({ id }) => !loadedAvisos.hasOwnProperty(id));
      if (nuevos.length === 0) {
        // Si todos venían duplicados probablemente no hay más
        noMore = true;
        btnCargarMas.style.display = 'none';
        return;
      }
      nuevos.forEach(({ id, a }) => {
        loadedAvisos[id] = a;
        loadedOrder.push(id); // push al final -> orden descendente mantenido
      });
      lastLoadedFecha = arr[arr.length - 1].a.fecha || lastLoadedFecha;
      // Si la página que vino tiene menos elementos que PAGE_SIZE, quizá no hay más
      if (arr.length < PAGE_SIZE) {
        noMore = true;
        btnCargarMas.style.display = 'none';
      } else {
        btnCargarMas.style.display = 'inline-block';
      }
      actualizarSelectDepartamentos();
      render();
    })
    .catch(err => {
      console.error('Error cargando más avisos', err);
    })
    .finally(() => {
      loading = false;
      showLoading(false);
    });
}

// --- Listener para avisos nuevos en tiempo real (solo para nuevos más recientes) ---
function setupRealtimeNewItems() {
  // Observa el más reciente continuamente; cuando aparezca uno con fecha mayor que latestFecha, lo inserta al principio.
  db.ref('avisos').orderByChild('fecha').limitToLast(1).on('child_added', snapshot => {
    const id = snapshot.key;
    const a = snapshot.val();
    if (!a) return;
    const fecha = a.fecha || 0;
    if (fecha > latestFecha) {
      // Prevenir duplicados
      if (!loadedAvisos.hasOwnProperty(id)) {
        loadedAvisos[id] = a;
        loadedOrder.unshift(id); // al principio: más nuevo primero
        latestFecha = Math.max(latestFecha, fecha);
        // Ajustar lastLoadedFecha si es null
        if (!lastLoadedFecha) lastLoadedFecha = fecha;
        actualizarSelectDepartamentos();
        render();
      }
    }
  });
}

// --- Renderizado: usar loadedAvisos / loadedOrder en lugar de todosLosAvisos ---
function actualizarSelectDepartamentos() {
  const departamentos = new Set();
  Object.values(loadedAvisos).forEach(a => { if (a.departamento) departamentos.add(a.departamento); });
  const actual = selectDepartamento.value;
  selectDepartamento.innerHTML = '<option value="todas">Todos los departamentos</option>' +
    [...departamentos].sort((a, b) => a.localeCompare(b, 'es')).map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  const sigueExistiendo = [...departamentos].includes(actual);
  selectDepartamento.value = sigueExistiendo ? actual : 'todas';
  filtroDepartamento = selectDepartamento.value;
  poblarSelectCiudad(filtroDepartamento);
}

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

function tipoDe(aviso) {
  return aviso.tipo === 'encontrado' ? 'encontrado' : 'perdido';
}

function categoriaFiltro(aviso) {
  if (tipoDe(aviso) === 'encontrado') return 'encontrado';
  return aviso.estado === 'encontrado' ? 'resuelto' : 'perdido';
}

function render() {
  const coincideFiltrosBase = ([id, a]) =>
    (filtroCategoria === 'todas' || a.categoria === filtroCategoria) &&
    (filtroDepartamento === 'todas' || a.departamento === filtroDepartamento) &&
    (filtroCiudad === 'todas' || a.ciudad === filtroCiudad) &&
    (!filtroNombre || normalizarTexto(a.nombre).includes(filtroNombre));

  // Usar loadedAvisos (solo lo que ya cargamos)
  const todasLasCoincidencias = Object.entries(loadedAvisos).filter(coincideFiltrosBase);

  // Contadores (sobre lo cargado)
  contadorPerdidos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'perdido').length;
  contadorEncontrados.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'encontrado').length;
  contadorResueltos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'resuelto').length;

  // Filtrar por tipo y ordenar usando loadedOrder (para mantener consistencia de orden)
  const entradas = loadedOrder
    .map(id => [id, loadedAvisos[id]])
    .filter(([id, a]) => a && coincideFiltrosBase([id, a]) && categoriaFiltro(a) === filtroTipo);

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
  const { stampClass, stampTexto } = calcularSello(aviso);

  const yaAparecioPorSuDueno = tipoDe(aviso) === 'perdido' && aviso.estado === 'encontrado';

  a.innerHTML = `
    <div class="card-media">
      <div class="tape"></div>
      <div class="stamp ${stampClass}">${stampTexto}</div>
      <div class="media-wrap">
        ${aviso.imagenBase64
          ? `<img class="foto" src="${aviso.imagenBase64}" alt="Foto de ${escapeHtml(aviso.nombre || '')}">`
        : `<div class="foto sin-foto">Sin foto</div>`}
        ${yaAparecioPorSuDueno ? `<div class="ribbon-aparecio">Ya apareció</div>` : ''}
      </div>
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
      <div class="btn-contactar">Contactar</div>
    </div>
  `;
  return a;
}

function calcularSello(aviso) {
  const esMascota = aviso.categoria === 'mascota';
  const esTipoEncontrado = tipoDe(aviso) === 'encontrado';
  const resuelto = aviso.estado === 'encontrado';

  if (esTipoEncontrado) {
    if (resuelto) {
      return { stampClass: 'encontrado', stampTexto: esMascota ? 'YA ENTREGADO' : 'YA ENTREGADO/A' };
    }
    return { stampClass: 'pendiente', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  }

  if (resuelto) {
    return { stampClass: 'encontrado', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  }
  return { stampClass: esMascota ? 'mascota' : 'persona', stampTexto: esMascota ? 'PERDIDO' : 'SE BUSCA' };
}

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

function normalizarTexto(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// UTIL: mostrar/ocultar indicador
function showLoading(show) {
  if (show) {
    loadingIndicator.style.display = 'block';
    btnCargarMas.disabled = true;
  } else {
    loadingIndicator.style.display = 'none';
    btnCargarMas.disabled = false;
  }
}

function limpiarGridMensaje() {
  // Si la grid tiene solo el mensaje inicial, lo limpiamos (ya que cargaremos por páginas)
  const p = grid.querySelector('.loading-msg');
  if (p) p.remove();
}
