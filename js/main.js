// ============================================================
// FEED PRINCIPAL — index.html
// VERSIÓN A — carga rápida + paginación
// Basada directamente en la v11 funcional
// ============================================================

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroDepartamento = 'todas';
let filtroCiudad = 'todas';
let filtroNombre = '';
let filtroTipo = 'perdido';

const AVISOS_POR_PAGINA = 12;

let paginaActual = 1;
let cargaCompletaFinalizada = false;

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

// ------------------------------------------------------------
// ESTILOS DE PAGINACIÓN
// Se agregan desde JS para no tener que modificar style.css.
// ------------------------------------------------------------

const estiloPaginacion = document.createElement('style');

estiloPaginacion.textContent = `
  #paginacionAvisos {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin: 25px 0 35px;
    flex-wrap: wrap;
  }

  #paginacionAvisos button {
    border: 1px solid #ccc;
    background: white;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
  }

  #paginacionAvisos button:hover:not(:disabled) {
    background: #f1f1f1;
  }

  #paginacionAvisos button:disabled {
    opacity: .45;
    cursor: default;
  }

  #paginaActualAvisos {
    font-weight: 600;
    padding: 8px 10px;
  }

  #estadoCargaAvisos {
    text-align: center;
    margin: 12px 0;
    font-size: 13px;
    opacity: .7;
  }
`;

document.head.appendChild(estiloPaginacion);

// ------------------------------------------------------------
// ELEMENTOS DE PAGINACIÓN
// ------------------------------------------------------------

const estadoCargaAvisos = document.createElement('div');
estadoCargaAvisos.id = 'estadoCargaAvisos';

const paginacionAvisos = document.createElement('div');
paginacionAvisos.id = 'paginacionAvisos';

const botonAnterior = document.createElement('button');
botonAnterior.type = 'button';
botonAnterior.textContent = '‹ Anterior';

const paginaActualTexto = document.createElement('span');
paginaActualTexto.id = 'paginaActualAvisos';

const botonSiguiente = document.createElement('button');
botonSiguiente.type = 'button';
botonSiguiente.textContent = 'Siguiente ›';

paginacionAvisos.appendChild(botonAnterior);
paginacionAvisos.appendChild(paginaActualTexto);
paginacionAvisos.appendChild(botonSiguiente);

if (grid) {
  grid.insertAdjacentElement('afterend', estadoCargaAvisos);
  estadoCargaAvisos.insertAdjacentElement('afterend', paginacionAvisos);
}

// ------------------------------------------------------------
// CARGA RÁPIDA INICIAL
//
// Primero solicitamos únicamente los 12 avisos más recientes.
// Esto permite que la página empiece a mostrar contenido sin
// esperar a descargar todos los avisos.
//
// Después se hace la carga completa en segundo plano para que
// los filtros continúen funcionando igual que en la v11.
// ------------------------------------------------------------

const consultaInicial = db.ref('avisos')
  .orderByChild('fecha')
  .limitToLast(AVISOS_POR_PAGINA);

consultaInicial.once('value')
  .then(snapshot => {
    todosLosAvisos = snapshot.val() || {};

    cargaCompletaFinalizada = false;

    actualizarSelectDepartamentos();
    render();

    estadoCargaAvisos.textContent = 'Cargando avisos restantes…';

    // --------------------------------------------------------
    // CARGA COMPLETA EN SEGUNDO PLANO
    // --------------------------------------------------------

    db.ref('avisos').once('value')
      .then(snapshotCompleto => {
        todosLosAvisos = snapshotCompleto.val() || {};
        cargaCompletaFinalizada = true;

        actualizarSelectDepartamentos();
        render();

        estadoCargaAvisos.textContent = '';
      })
      .catch(error => {
        console.error('Error cargando avisos completos:', error);

        // No borramos los avisos iniciales si falla la segunda carga.
        estadoCargaAvisos.textContent =
          'No se pudieron cargar todos los avisos. Mostrando los más recientes.';
      });
  })
  .catch(error => {
    console.error('Error cargando avisos iniciales:', error);

    estadoCargaAvisos.textContent =
      'No se pudieron cargar los avisos. Intenta recargar la página.';
  });

// ------------------------------------------------------------
// ESCUCHA EN TIEMPO REAL
//
// Una vez que la carga inicial ya está disponible, mantenemos
// sincronizados los avisos nuevos/modificados.
//
// No se utiliza .on('value') inmediatamente al entrar para
// evitar que la primera pintura dependa de descargar todo.
// ------------------------------------------------------------

db.ref('avisos').on('value', snapshot => {
  // Si todavía estamos esperando la carga completa, no
  // reemplazamos los 12 avisos iniciales.
  if (!cargaCompletaFinalizada) {
    return;
  }

  todosLosAvisos = snapshot.val() || {};

  actualizarSelectDepartamentos();
  render();
});

// ------------------------------------------------------------
// FILTROS
// ------------------------------------------------------------

tabsCategoria.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;

  [...tabsCategoria.children].forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  filtroCategoria = btn.dataset.cat;

  paginaActual = 1;
  render();
});

selectDepartamento.addEventListener('change', () => {
  filtroDepartamento = selectDepartamento.value;
  poblarSelectCiudad(filtroDepartamento);

  paginaActual = 1;
  render();
});

selectCiudad.addEventListener('change', () => {
  filtroCiudad = selectCiudad.value;

  paginaActual = 1;
  render();
});

// Búsqueda por nombre
inputBuscar.addEventListener('input', () => {
  filtroNombre = normalizarTexto(inputBuscar.value);

  paginaActual = 1;
  render();
});

tipoToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.tipo-btn');
  if (!btn) return;

  [...tipoToggle.children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  filtroTipo = btn.dataset.tipo;

  paginaActual = 1;
  render();
});

// ------------------------------------------------------------
// PAGINACIÓN
// ------------------------------------------------------------

botonAnterior.addEventListener('click', () => {
  if (paginaActual <= 1) return;

  paginaActual--;

  render();

  window.scrollTo({
    top: grid.offsetTop - 80,
    behavior: 'smooth'
  });
});

botonSiguiente.addEventListener('click', () => {
  const total = obtenerEntradasFiltradas().length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(total / AVISOS_POR_PAGINA)
  );

  if (paginaActual >= totalPaginas) return;

  paginaActual++;

  render();

  window.scrollTo({
    top: grid.offsetTop - 80,
    behavior: 'smooth'
  });
});

// ------------------------------------------------------------
// DEPARTAMENTOS
// ------------------------------------------------------------

function actualizarSelectDepartamentos() {
  const departamentos = new Set();

  Object.values(todosLosAvisos).forEach(a => {
    if (a.departamento) {
      departamentos.add(a.departamento);
    }
  });

  const actual = selectDepartamento.value;

  selectDepartamento.innerHTML =
    '<option value="todas">Todos los departamentos</option>' +
    [...departamentos]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(d =>
        `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`
      )
      .join('');

  const sigueExistiendo = [...departamentos].includes(actual);

  selectDepartamento.value =
    sigueExistiendo ? actual : 'todas';

  filtroDepartamento = selectDepartamento.value;

  poblarSelectCiudad(filtroDepartamento);
}

// ------------------------------------------------------------
// CIUDADES
// ------------------------------------------------------------

function poblarSelectCiudad(depto) {
  if (
    !depto ||
    depto === 'todas' ||
    !COLOMBIA_DATA[depto]
  ) {
    selectCiudad.innerHTML =
      '<option value="todas">Elige primero el departamento</option>';

    selectCiudad.disabled = true;
    filtroCiudad = 'todas';

    return;
  }

  const actual = filtroCiudad;
  const municipios = COLOMBIA_DATA[depto];

  selectCiudad.innerHTML =
    '<option value="todas">Todas las ciudades</option>' +
    municipios
      .map(m =>
        `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
      )
      .join('');

  selectCiudad.disabled = false;

  selectCiudad.value =
    municipios.includes(actual) ? actual : 'todas';

  filtroCiudad = selectCiudad.value;
}

// ------------------------------------------------------------
// TIPO
// ------------------------------------------------------------

function tipoDe(aviso) {
  return aviso.tipo === 'encontrado'
    ? 'encontrado'
    : 'perdido';
}

// ------------------------------------------------------------
// CATEGORÍA
// ------------------------------------------------------------

function categoriaFiltro(aviso) {
  if (tipoDe(aviso) === 'encontrado') {
    return 'encontrado';
  }

  return aviso.estado === 'encontrado'
    ? 'resuelto'
    : 'perdido';
}

// ------------------------------------------------------------
// OBTENER AVISOS FILTRADOS
// ------------------------------------------------------------

function obtenerEntradasFiltradas() {

  const coincideFiltrosBase = ([id, a]) =>
    (filtroCategoria === 'todas' ||
      a.categoria === filtroCategoria) &&

    (filtroDepartamento === 'todas' ||
      a.departamento === filtroDepartamento) &&

    (filtroCiudad === 'todas' ||
      a.ciudad === filtroCiudad) &&

    (!filtroNombre ||
      normalizarTexto(a.nombre).includes(filtroNombre));

  const todasLasCoincidencias =
    Object.entries(todosLosAvisos)
      .filter(coincideFiltrosBase);

  return todasLasCoincidencias
    .filter(([id, a]) =>
      categoriaFiltro(a) === filtroTipo
    )
    .sort((a, b) =>
      (b[1].fecha || 0) - (a[1].fecha || 0)
    );
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------

function render() {

  const coincideFiltrosBase = ([id, a]) =>
    (filtroCategoria === 'todas' ||
      a.categoria === filtroCategoria) &&

    (filtroDepartamento === 'todas' ||
      a.departamento === filtroDepartamento) &&

    (filtroCiudad === 'todas' ||
      a.ciudad === filtroCiudad) &&

    (!filtroNombre ||
      normalizarTexto(a.nombre).includes(filtroNombre));

  const todasLasCoincidencias =
    Object.entries(todosLosAvisos)
      .filter(coincideFiltrosBase);

  // ----------------------------------------------------------
  // CONTADORES
  // Se mantienen exactamente como en v11.
  // ----------------------------------------------------------

  contadorPerdidos.textContent =
    todasLasCoincidencias.filter(
      ([id, a]) => categoriaFiltro(a) === 'perdido'
    ).length;

  contadorEncontrados.textContent =
    todasLasCoincidencias.filter(
      ([id, a]) => categoriaFiltro(a) === 'encontrado'
    ).length;

  contadorResueltos.textContent =
    todasLasCoincidencias.filter(
      ([id, a]) => categoriaFiltro(a) === 'resuelto'
    ).length;

  // ----------------------------------------------------------
  // AVISOS
  // ----------------------------------------------------------

  const entradas = todasLasCoincidencias
    .filter(([id, a]) =>
      categoriaFiltro(a) === filtroTipo
    )
    .sort((a, b) =>
      (b[1].fecha || 0) - (a[1].fecha || 0)
    );

  const totalAvisos = entradas.length;

  contador.textContent =
    totalAvisos +
    (totalAvisos === 1 ? ' aviso' : ' avisos');

  // ----------------------------------------------------------
  // AJUSTAR PÁGINA SI QUEDÓ FUERA DE RANGO
  // ----------------------------------------------------------

  const totalPaginas = Math.max(
    1,
    Math.ceil(totalAvisos / AVISOS_POR_PAGINA)
  );

  if (paginaActual > totalPaginas) {
    paginaActual = totalPaginas;
  }

  // ----------------------------------------------------------
  // AVISOS DE LA PÁGINA ACTUAL
  // ----------------------------------------------------------

  const inicio =
    (paginaActual - 1) * AVISOS_POR_PAGINA;

  const avisosPagina =
    entradas.slice(
      inicio,
      inicio + AVISOS_POR_PAGINA
    );

  grid.innerHTML = '';

  if (avisosPagina.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';

    avisosPagina.forEach(([id, aviso]) => {
      grid.appendChild(crearCard(id, aviso));
    });
  }

  // ----------------------------------------------------------
  // PAGINACIÓN
  // ----------------------------------------------------------

  actualizarPaginacion(
    totalAvisos,
    totalPaginas
  );
}

// ------------------------------------------------------------
// PAGINACIÓN UI
// ------------------------------------------------------------

function actualizarPaginacion(
  totalAvisos,
  totalPaginas
) {
  if (totalAvisos <= AVISOS_POR_PAGINA) {
    paginacionAvisos.style.display = 'none';
    return;
  }

  paginacionAvisos.style.display = 'flex';

  paginaActualTexto.textContent =
    `Página ${paginaActual} de ${totalPaginas}`;

  botonAnterior.disabled =
    paginaActual <= 1;

  botonSiguiente.disabled =
    paginaActual >= totalPaginas;
}

// ------------------------------------------------------------
// CREAR TARJETA
// ------------------------------------------------------------

function crearCard(id, aviso) {

  const a = document.createElement('a');

  a.href = `aviso.html?id=${id}`;
  a.className = 'card';

  const numComentarios =
    aviso.comentarios
      ? Object.keys(aviso.comentarios).length
      : 0;

  const {
    stampClass,
    stampTexto
  } = calcularSello(aviso);

  const yaAparecioPorSuDueno =
    tipoDe(aviso) === 'perdido' &&
    aviso.estado === 'encontrado';

  a.innerHTML = `
    <div class="card-media">

      <div class="tape"></div>

      <div class="stamp ${stampClass}">
        ${stampTexto}
      </div>

      <div class="media-wrap">

        ${
          aviso.imagenBase64
            ? `
              <img
                class="foto"
                src="${aviso.imagenBase64}"
                alt="Foto de ${escapeHtml(aviso.nombre || '')}"
                loading="lazy"
                decoding="async"
              >
            `
            : `
              <div class="foto sin-foto">
                Sin foto
              </div>
            `
        }

        ${
          yaAparecioPorSuDueno
            ? `<div class="ribbon-aparecio">Ya apareció</div>`
            : ''
        }

      </div>

      <div class="body">

        <div class="nombre">
          ${escapeHtml(aviso.nombre || 'Sin nombre')}
        </div>

        <div class="meta">

          ${
            aviso.edad
              ? `<span>${escapeHtml(aviso.edad)}</span>`
              : ''
          }

          <span class="mono">
            ${
              aviso.categoria === 'mascota'
                ? 'MASCOTA'
                : 'PERSONA'
            }
          </span>

        </div>

        ${
          aviso.descripcion
            ? `<div class="desc">${escapeHtml(aviso.descripcion)}</div>`
            : ''
        }

        <div class="foot">

          <span class="ciudad">
            📍 ${escapeHtml(lugarTexto(aviso))}
          </span>

          <span class="comentarios-count">
            💬 ${numComentarios}
          </span>

        </div>

        <div class="btn-contactar">
          Contactar
        </div>

      </div>

    </div>
  `;

  return a;
}

// ------------------------------------------------------------
// SELLO
// ------------------------------------------------------------

function calcularSello(aviso) {

  const esMascota =
    aviso.categoria === 'mascota';

  const esTipoEncontrado =
    tipoDe(aviso) === 'encontrado';

  const resuelto =
    aviso.estado === 'encontrado';

  if (esTipoEncontrado) {

    if (resuelto) {
      return {
        stampClass: 'encontrado',
        stampTexto:
          esMascota
            ? 'YA ENTREGADO'
            : 'YA ENTREGADO/A'
      };
    }

    return {
      stampClass: 'pendiente',
      stampTexto:
        esMascota
          ? 'ENCONTRADO'
          : 'ENCONTRADO/A'
    };
  }

  if (resuelto) {
    return {
      stampClass: 'encontrado',
      stampTexto:
        esMascota
          ? 'ENCONTRADO'
          : 'ENCONTRADO/A'
    };
  }

  return {
    stampClass:
      esMascota
        ? 'mascota'
        : 'persona',

    stampTexto:
      esMascota
        ? 'PERDIDO'
        : 'SE BUSCA'
  };
}

// ------------------------------------------------------------
// UBICACIÓN
// ------------------------------------------------------------

function lugarTexto(aviso) {

  const partes = [];

  if (aviso.ciudad) {
    partes.push(aviso.ciudad);
  }

  if (aviso.sector) {
    partes.push(aviso.sector);
  }

  let texto =
    partes.length
      ? partes.join(' · ')
      : 'Ubicación no especificada';

  if (aviso.departamento) {
    texto += ` (${aviso.departamento})`;
  }

  return texto;
}

// ------------------------------------------------------------
// SEGURIDAD HTML
// ------------------------------------------------------------

function escapeHtml(str) {

  const div =
    document.createElement('div');

  div.textContent = str;

  return div.innerHTML;
}

// ------------------------------------------------------------
// NORMALIZAR TEXTO
// ------------------------------------------------------------

function normalizarTexto(str) {

  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
escucharPrimeraPagina();
