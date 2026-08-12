// name=js/main.js
// FEED PRINCIPAL — versión robusta para "Cargar más" opcional

let loadedAvisos = {};
let loadedOrder = [];
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

let btnCargarMas = document.getElementById('cargarMas'); // puede ser null
let loadingIndicator = document.getElementById('loadingIndicator'); // puede ser null

let loading = false;
let noMore = false;
let lastLoadedFecha = null;
let latestFecha = 0;

// Inicial
document.addEventListener('DOMContentLoaded', () => {
  initControls();
  limpiarGridMensaje();
  cargarPaginaInicial();
  setupRealtimeNewItems();
});

function initControls() {
  if (tabsCategoria) {
    tabsCategoria.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      [...tabsCategoria.children].forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      filtroCategoria = btn.dataset.cat;
      render();
    });
  }

  if (selectDepartamento) {
    selectDepartamento.addEventListener('change', () => {
      filtroDepartamento = selectDepartamento.value;
      poblarSelectCiudad(filtroDepartamento);
      render();
    });
  }

  if (selectCiudad) {
    selectCiudad.addEventListener('change', () => {
      filtroCiudad = selectCiudad.value;
      render();
    });
  }

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      filtroNombre = normalizarTexto(inputBuscar.value);
      render();
    });
  }

  if (tipoToggle) {
    tipoToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.tipo-btn');
      if (!btn) return;
      [...tipoToggle.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroTipo = btn.dataset.tipo;
      render();
    });
  }

  // El botón puede no existir si no reemplazaste index.html; comprobar antes.
  if (btnCargarMas) {
    btnCargarMas.addEventListener('click', () => {
      if (!loading && !noMore) cargarPaginaSiguiente();
    });
  }
}

function cargarPaginaInicial() {
  loading = true;
  showLoading(true);
  // Si `db` no existe por algún motivo, logueamos y salimos limpiamente
  if (typeof db === 'undefined' || !db.ref) {
    console.error('firebase db no está disponible (db undefined). Revisa js/firebase-config.js');
    showLoading(false);
    loading = false;
    // quitamos mensaje de carga para no dejar la UI colgada
    limpiarGridMensaje();
    return;
  }

  db.ref('avisos').orderByChild('fecha').limitToLast(PAGE_SIZE).once('value')
    .then(snapshot => {
      const val = snapshot.val() || {};
      const items = Object.entries(val);
      const arr = items.map(([id, a]) => ({ id, a }));
      arr.sort((x, y) => (y.a.fecha || 0) - (x.a.fecha || 0)); // descendente

      if (arr.length === 0) {
        loadedAvisos = {};
        loadedOrder = [];
        actualizarSelectDepartamentos();
        render();
        noMore = true;
        if (btnCargarMas) btnCargarMas.style.display = 'none';
      } else {
        arr.forEach(({ id, a }) => {
          loadedAvisos[id] = a;
          loadedOrder.push(id);
        });
        lastLoadedFecha = arr[arr.length - 1].a.fecha || 0;
        latestFecha = Math.max(latestFecha, arr[0].a.fecha || 0);
        if (arr.length < PAGE_SIZE) {
          noMore = true;
          if (btnCargarMas) btnCargarMas.style.display = 'none';
        } else {
          noMore = false;
          if (btnCargarMas) btnCargarMas.style.display = 'inline-block';
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

function cargarPaginaSiguiente() {
  if (loading || noMore) return;
  loading = true;
  showLoading(true);

  const endAtValue = (typeof lastLoadedFecha === 'number' && lastLoadedFecha > 0) ? lastLoadedFecha - 1 : lastLoadedFecha;
  let query = db.ref('avisos').orderByChild('fecha');
  if (endAtValue || endAtValue === 0) query = query.endAt(endAtValue);
  query = query.limitToLast(PAGE_SIZE);

  query.once('value')
    .then(snapshot => {
      const val = snapshot.val() || {};
      const items = Object.entries(val);
      if (!items.length) {
        noMore = true;
        if (btnCargarMas) btnCargarMas.style.display = 'none';
        return;
      }
      const arr = items.map(([id, a]) => ({ id, a }));
      arr.sort((x, y) => (y.a.fecha || 0) - (x.a.fecha || 0));
      const nuevos = arr.filter(({ id }) => !loadedAvisos.hasOwnProperty(id));
      if (nuevos.length === 0) {
        noMore = true;
        if (btnCargarMas) btnCargarMas.style.display = 'none';
        return;
      }
      nuevos.forEach(({ id, a }) => {
        loadedAvisos[id] = a;
        loadedOrder.push(id);
      });
      lastLoadedFecha = arr[arr.length - 1].a.fecha || lastLoadedFecha;
      if (arr.length < PAGE_SIZE) {
        noMore = true;
        if (btnCargarMas) btnCargarMas.style.display = 'none';
      } else {
        if (btnCargarMas) btnCargarMas.style.display = 'inline-block';
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

function setupRealtimeNewItems() {
  if (typeof db === 'undefined' || !db.ref) return;
  db.ref('avisos').orderByChild('fecha').limitToLast(1).on('child_added', snapshot => {
    const id = snapshot.key;
    const a = snapshot.val();
    if (!a) return;
    const fecha = a.fecha || 0;
    if (fecha > latestFecha) {
      if (!loadedAvisos.hasOwnProperty(id)) {
        loadedAvisos[id] = a;
        loadedOrder.unshift(id);
        latestFecha = Math.max(latestFecha, fecha);
        if (!lastLoadedFecha) lastLoadedFecha = fecha;
        actualizarSelectDepartamentos();
        render();
      }
    }
  });
}

function actualizarSelectDepartamentos() {
  const departamentos = new Set();
  Object.values(loadedAvisos).forEach(a => { if (a && a.departamento) departamentos.add(a.departamento); });
  const actual = selectDepartamento ? selectDepartamento.value : 'todas';
  if (selectDepartamento) {
    selectDepartamento.innerHTML = '<option value="todas">Todos los departamentos</option>' +
      [...departamentos].sort((a, b) => a.localeCompare(b, 'es')).map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    const sigueExistiendo = [...departamentos].includes(actual);
    selectDepartamento.value = sigueExistiendo ? actual : 'todas';
    filtroDepartamento = selectDepartamento.value;
  } else {
    filtroDepartamento = 'todas';
  }
  if (selectDepartamento) poblarSelectCiudad(filtroDepartamento);
}

function poblarSelectCiudad(depto) {
  if (!selectCiudad) { filtroCiudad = 'todas'; return; }
  if (!depto || depto === 'todas' || !COLOMBIA_DATA || !COLOMBIA_DATA[depto]) {
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
  return aviso && aviso.tipo === 'encontrado' ? 'encontrado' : 'perdido';
}

function categoriaFiltro(aviso) {
  if (tipoDe(aviso) === 'encontrado') return 'encontrado';
  return aviso && aviso.estado === 'encontrado' ? 'resuelto' : 'perdido';
}

function render() {
  const coincideFiltrosBase = ([id, a]) =>
    (filtroCategoria === 'todas' || (a && a.categoria === filtroCategoria)) &&
    (filtroDepartamento === 'todas' || (a && a.departamento === filtroDepartamento)) &&
    (filtroCiudad === 'todas' || (a && a.ciudad === filtroCiudad)) &&
    (!filtroNombre || (a && normalizarTexto(a.nombre).includes(filtroNombre)));

  const todasLasCoincidencias = Object.entries(loadedAvisos).filter(coincideFiltrosBase);

  if (contadorPerdidos) contadorPerdidos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'perdido').length;
  if (contadorEncontrados) contadorEncontrados.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'encontrado').length;
  if (contadorResueltos) contadorResueltos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'resuelto').length;

  const entradas = loadedOrder
    .map(id => [id, loadedAvisos[id]])
    .filter(([id, a]) => a && coincideFiltrosBase([id, a]) && categoriaFiltro(a) === filtroTipo);

  if (contador) contador.textContent = entradas.length + (entradas.length === 1 ? ' aviso' : ' avisos');
  if (!grid) return;
  grid.innerHTML = '';

  if (entradas.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  entradas.forEach(([id, aviso]) => {
    grid.appendChild(crearCard(id, aviso));
  });
}

function crearCard(id, aviso) {
  const a = document.createElement('a');
  a.href = `aviso.html?id=${id}`;
  a.className = 'card';

  const numComentarios = aviso && aviso.comentarios ? Object.keys(aviso.comentarios).length : 0;
  const { stampClass, stampTexto } = calcularSello(aviso);

  const yaAparecioPorSuDueno = tipoDe(aviso) === 'perdido' && aviso && aviso.estado === 'encontrado';

  a.innerHTML = `
    <div class="card-media">
      <div class="tape"></div>
      <div class="stamp ${stampClass}">${stampTexto}</div>
      <div class="media-wrap">
        ${aviso && aviso.imagenBase64
          ? `<img class="foto" src="${aviso.imagenBase64}" alt="Foto de ${escapeHtml(aviso.nombre || '')}" loading="lazy">`
        : `<div class="foto sin-foto">Sin foto</div>`}
        ${yaAparecioPorSuDueno ? `<div class="ribbon-aparecio">Ya apareció</div>` : ''}
      </div>
    <div class="body">
      <div class="nombre">${escapeHtml((aviso && aviso.nombre) || 'Sin nombre')}</div>
      <div class="meta">
        ${aviso && aviso.edad ? `<span>${escapeHtml(aviso.edad)}</span>` : ''}
        <span class="mono">${aviso && aviso.categoria === 'mascota' ? 'MASCOTA' : 'PERSONA'}</span>
      </div>
      ${aviso && aviso.descripcion ? `<div class="desc">${escapeHtml(aviso.descripcion)}</div>` : ''}
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
  const esMascota = aviso && aviso.categoria === 'mascota';
  const esTipoEncontrado = tipoDe(aviso) === 'encontrado';
  const resuelto = aviso && aviso.estado === 'encontrado';

  if (esTipoEncontrado) {
    if (resuelto) return { stampClass: 'encontrado', stampTexto: esMascota ? 'YA ENTREGADO' : 'YA ENTREGADO/A' };
    return { stampClass: 'pendiente', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  }
  if (resuelto) return { stampClass: 'encontrado', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  return { stampClass: esMascota ? 'mascota' : 'persona', stampTexto: esMascota ? 'PERDIDO' : 'SE BUSCA' };
}

function lugarTexto(aviso) {
  const partes = [];
  if (aviso && aviso.ciudad) partes.push(aviso.ciudad);
  if (aviso && aviso.sector) partes.push(aviso.sector);
  let texto = partes.length ? partes.join(' · ') : 'Ubicación no especificada';
  if (aviso && aviso.departamento) texto += ` (${aviso.departamento})`;
  return texto;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function normalizarTexto(str) {
  return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function showLoading(show) {
  if (loadingIndicator) loadingIndicator.style.display = show ? 'block' : 'none';
  if (btnCargarMas) btnCargarMas.disabled = !!show;
}

function limpiarGridMensaje() {
  if (!grid) return;
  const p = grid.querySelector('.loading-msg');
  if (p) p.remove();
}
