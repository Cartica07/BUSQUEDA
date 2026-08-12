// ============================================================
// FEED PRINCIPAL — index.html
// ============================================================

let todosLosAvisos = {};
let filtroCategoria = 'todas';
let filtroDepartamento = 'todas';
let filtroCiudad = 'todas';
let filtroNombre = '';
let filtroTipo = 'perdido';

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
// Carga rápida en 3 etapas, para que la página se sienta rápida
// aunque haya muchos avisos con fotos pesadas:
//
//  1) Si ya visitaste la página antes en esta pestaña, se pinta
//     al instante lo último que se vio (desde sessionStorage),
//     sin esperar nada de la red.
//  2) Se pide a Firebase SOLO los avisos más recientes (los 20
//     últimos por fecha) y se pintan apenas llegan — es una
//     consulta chica, así que llega rápido.
//  3) En paralelo, se sigue escuchando el listado COMPLETO en
//     tiempo real; cuando termina de bajar (y cada vez que algo
//     cambia), se actualiza la vista y se refresca la caché.
// ------------------------------------------------------------
const CACHE_KEY = 'busqueda_avisos_cache_v1';

try {
  const cache = sessionStorage.getItem(CACHE_KEY);
  if (cache) {
    todosLosAvisos = JSON.parse(cache);
    actualizarSelectDepartamentos();
    render();
  }
} catch (e) {
  console.warn('No se pudo leer la caché local:', e);
}

// Etapa 2: los más recientes primero, rápido.
db.ref('avisos').orderByChild('fecha').limitToLast(20).once('value')
  .then((snapshot) => {
    const recientes = snapshot.val() || {};
    todosLosAvisos = { ...todosLosAvisos, ...recientes };
    actualizarSelectDepartamentos();
    render();
  })
  .catch((err) => console.error('Error cargando avisos recientes:', err));

// Etapa 3: el listado completo, en vivo. Cuando llega, reemplaza
// del todo a todosLosAvisos (por eso ya no hace falta mezclar) y
// deja todo guardado en caché para la próxima visita.
db.ref('avisos').on('value', (snapshot) => {
  todosLosAvisos = snapshot.val() || {};
  actualizarSelectDepartamentos();
  render();
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(todosLosAvisos));
  } catch (e) {
    // Si el dataset es muy grande para sessionStorage, simplemente no
    // cacheamos: la página igual funciona, solo no arranca instantánea
    // la próxima vez.
    console.warn('No se pudo guardar la caché local (dataset grande):', e);
  }
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

tipoToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.tipo-btn');
  if (!btn) return;
  [...tipoToggle.children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroTipo = btn.dataset.tipo;
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

// Un aviso sin campo "tipo" (publicaciones viejas) se trata como "perdido",
// que era el único tipo que existía antes de agregar esta división.
function tipoDe(aviso) {
  return aviso.tipo === 'encontrado' ? 'encontrado' : 'perdido';
}

// Clasifica cada aviso en una de las 3 pestañas del filtro superior:
// 'perdido'    -> lo siguen buscando, nadie avisó haberlo encontrado todavía.
// 'encontrado' -> alguien AJENO (no el dueño) lo encontró y publicó el aviso,
//                 esté o no ya entregado/reclamado.
// 'resuelto'   -> era un aviso de "perdido" y su propio dueño/familia avisó
//                 que ya apareció (no interviene ningún tercero).
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

  const todasLasCoincidencias = Object.entries(todosLosAvisos).filter(coincideFiltrosBase);

  // Los contadores de "Perdidos" / "Encontrados por otras personas" / "Ya
  // encontrado por los dueños" reflejan los filtros de categoría, ubicación
  // y nombre que estén activos, para que la persona sepa cuántos resultados
  // hay en cada pestaña antes de elegir una.
  contadorPerdidos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'perdido').length;
  contadorEncontrados.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'encontrado').length;
  contadorResueltos.textContent = todasLasCoincidencias.filter(([id, a]) => categoriaFiltro(a) === 'resuelto').length;

  const entradas = todasLasCoincidencias
    .filter(([id, a]) => categoriaFiltro(a) === filtroTipo)
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
  const { stampClass, stampTexto } = calcularSello(aviso);

  // El caso más propenso a confusión: un aviso de "perdido" cuyo propio
  // dueño/familia marcó como resuelto. Ahora vive en su propia pestaña
  // ("Ya encontrado por los dueños"), para que no se confunda con el sello
  // rojo "ENCONTRADO"/"YA ENTREGADO" (que es cuando alguien AJENO lo encontró).
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

// Calcula el texto y color del sello según categoría (persona/mascota),
// tipo (perdido = lo estoy buscando / encontrado = lo tengo yo) y estado
// (buscando = sigue activo / encontrado = ya se resolvió el caso).
// aviso.tipo puede no existir en publicaciones viejas: se asume 'perdido'.
function calcularSello(aviso) {
  const esMascota = aviso.categoria === 'mascota';
  const esTipoEncontrado = tipoDe(aviso) === 'encontrado';
  const resuelto = aviso.estado === 'encontrado';

  if (esTipoEncontrado) {
    if (resuelto) {
      return { stampClass: 'encontrado', stampTexto: esMascota ? 'YA ENTREGADO' : 'YA ENTREGADO/A' };
    }
    // Todavía nadie confirma que sea el dueño/familia: sello rojo para que
    // se note que está pendiente de que su dueño lo reclame.
    return { stampClass: 'pendiente', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  }

  if (resuelto) {
    return { stampClass: 'encontrado', stampTexto: esMascota ? 'ENCONTRADO' : 'ENCONTRADO/A' };
  }
  return { stampClass: esMascota ? 'mascota' : 'persona', stampTexto: esMascota ? 'PERDIDO' : 'SE BUSCA' };
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
