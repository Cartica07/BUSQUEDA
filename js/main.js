// ============================================================
// FEED PRINCIPAL — index.html
// ============================================================

let todosLosAvisos = {};
let filtroDepartamento = 'todas';
let filtroCiudad = 'todas';
let filtroNombre = '';
let filtroTipo = 'perdido';
let filtroEspecie = 'todas'; // 'todas' | 'perro' | 'gato'

const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const contador = document.getElementById('contador');
const selectDepartamento = document.getElementById('selectDepartamento');
const selectCiudad = document.getElementById('selectCiudad');
const inputBuscar = document.getElementById('buscarNombre');
const tipoToggle = document.getElementById('tipoToggle');
const especieToggle = document.getElementById('especieToggle');
const contadorPerdidos = document.getElementById('contadorPerdidos');
const contadorEncontrados = document.getElementById('contadorEncontrados');
const contadorResueltos = document.getElementById('contadorResueltos');
const inputBuscarFoto = document.getElementById('buscarFotoInput');
const btnBuscarFoto = document.getElementById('btnBuscarFoto');
const fotoBusquedaBar = document.getElementById('fotoBusquedaBar');
const fotoBusquedaPreview = document.getElementById('fotoBusquedaPreview');
const fotoBusquedaTexto = document.getElementById('fotoBusquedaTexto');
const fotoBusquedaCancelar = document.getElementById('fotoBusquedaCancelar');

// ------------------------------------------------------------
// Búsqueda por foto (coincidencias visuales)
// ------------------------------------------------------------
// Todo esto corre en el navegador de cada persona, con un modelo de IA
// (MobileNet vía TensorFlow.js) que se trae de un CDN recién cuando alguien
// usa esta función por primera vez — así no le pesa la carga inicial a
// quienes solo navegan la lista normal.
//
// Convierte cada foto en un vector de números ("huella" de colores/formas/
// textura) y compara por similitud coseno. Sirve como sugerencia de
// parecido visual, NO como identificación certera de que sea la misma
// persona o mascota.
let modoBusquedaFoto = false;
let vectorFotoBuscada = null;
let modeloIA = null;
let promesaModeloIA = null;
const cacheEmbeddings = {}; // id del aviso -> vector ya calculado (evita recalcular en cada búsqueda)

function cargarModeloIA() {
  if (modeloIA) return Promise.resolve(modeloIA);
  if (promesaModeloIA) return promesaModeloIA;

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.body.appendChild(s);
    });
  }

  promesaModeloIA = cargarScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js')
    .then(() => cargarScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js'))
    // Volvemos a la versión completa del modelo (alpha 1.0): ahora que el
    // conjunto a comparar quedó acotado solo a "Perdidos" (no a los 3
    // tipos), hay margen para priorizar precisión sobre velocidad.
    .then(() => mobilenet.load({ version: 2, alpha: 1.0 }))
    .then((modelo) => { modeloIA = modelo; return modelo; });

  return promesaModeloIA;
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

// Las fotos de celular suelen venir en resolución enorme (varios miles de
// píxeles, varios MB) y hace falta achicarlas antes de analizarlas para
// que no se trabe el celular. Se usa "contain" (con relleno gris parejo
// alrededor) en vez de recortar al cuadrado central: recortar podía cortar
// justo la parte de la foto que hace reconocible al animal/persona (la
// cabeza, una mancha de color, etc.) y eso le bajaba precisión a la
// comparación.
function redimensionarImagen(img, maxDim = 320) {
  const canvas = document.createElement('canvas');
  canvas.width = maxDim;
  canvas.height = maxDim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, maxDim, maxDim);

  const anchoOriginal = img.naturalWidth || img.width;
  const altoOriginal = img.naturalHeight || img.height;
  const escala = Math.min(maxDim / anchoOriginal, maxDim / altoOriginal);
  const anchoFinal = anchoOriginal * escala;
  const altoFinal = altoOriginal * escala;
  const dx = (maxDim - anchoFinal) / 2;
  const dy = (maxDim - altoFinal) / 2;
  ctx.drawImage(img, 0, 0, anchoOriginal, altoOriginal, dx, dy, anchoFinal, altoFinal);
  return canvas;
}

// Deja pasar un instante para que el navegador respire entre imagen e
// imagen (dibuje, atienda al usuario, etc.), así en celulares de gama
// baja no se siente "trabado" aunque esté trabajando en el fondo.
function respirar() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function obtenerEmbedding(id, base64) {
  if (cacheEmbeddings[id]) return cacheEmbeddings[id];
  const img = await cargarImagen(base64);
  const chico = redimensionarImagen(img);
  const tensor = modeloIA.infer(chico, true);
  const datos = await tensor.data();
  tensor.dispose();
  cacheEmbeddings[id] = datos;
  return datos;
}

function similitudCoseno(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

inputBuscarFoto.addEventListener('change', () => {
  const file = inputBuscarFoto.files[0];
  if (file) iniciarBusquedaPorFoto(file);
});

fotoBusquedaCancelar.addEventListener('click', () => {
  salirDeBusquedaPorFoto();
});

async function iniciarBusquedaPorFoto(file) {
  modoBusquedaFoto = true;
  vectorFotoBuscada = null;
  filtroNombre = '';
  inputBuscar.value = '';
  inputBuscar.disabled = true;
  btnBuscarFoto.classList.add('activo');
  tipoToggle.classList.add('deshabilitado');

  const urlPreview = URL.createObjectURL(file);
  fotoBusquedaPreview.src = urlPreview;
  fotoBusquedaBar.style.display = 'flex';
  fotoBusquedaTexto.textContent = 'Analizando la foto...';
  render();

  try {
    await cargarModeloIA();
    const img = await cargarImagen(urlPreview);
    const chico = redimensionarImagen(img);
    const tensor = modeloIA.infer(chico, true);
    vectorFotoBuscada = await tensor.data();
    tensor.dispose();
    fotoBusquedaTexto.textContent = 'Buscando coincidencias...';
    render();
  } catch (err) {
    console.error('Error en la búsqueda por foto:', err);
    fotoBusquedaTexto.textContent = 'No se pudo analizar la foto. Probá con otra o intentá de nuevo.';
  }
}

function salirDeBusquedaPorFoto() {
  modoBusquedaFoto = false;
  vectorFotoBuscada = null;
  inputBuscar.disabled = false;
  btnBuscarFoto.classList.remove('activo');
  tipoToggle.classList.remove('deshabilitado');
  fotoBusquedaBar.style.display = 'none';
  inputBuscarFoto.value = '';
  render();
}

// ------------------------------------------------------------
// Carga rápida en 3 etapas, para que la página se sienta rápida
// aunque haya muchos avisos con fotos pesadas:
//
//  1) Si ya visitaste la página antes en esta pestaña, se pinta
//     al instante lo último que se vio (desde sessionStorage),
//     sin esperar nada de la red.
//  2) Se pide a Firebase SOLO los avisos más recientes (los 10
//     últimos por fecha) y se pintan apenas llegan — es una
//     consulta chica (los avisos traen foto adentro, así que
//     pedir de a pocos es lo que más acelera el primer pantallazo),
//     así que llega rápido.
//  3) En paralelo, se sigue escuchando el listado COMPLETO en
//     tiempo real; cuando termina de bajar (y cada vez que algo
//     cambia), se actualiza la vista y se refresca la caché.
// ------------------------------------------------------------
const CACHE_KEY = 'busqueda_avisos_cache_v1';

// Esta página es solo de mascotas. Los avisos de personas se maneja aparte
// (otra página); por las dudas queden avisos viejos de personas todavía
// en la base de datos, se descartan acá antes de mostrar nada, para que
// nunca aparezcan mezclados en este listado.
function soloMascotas(obj) {
  const resultado = {};
  Object.entries(obj || {}).forEach(([id, aviso]) => {
    if (aviso && aviso.categoria !== 'persona') resultado[id] = aviso;
  });
  return resultado;
}

try {
  const cache = sessionStorage.getItem(CACHE_KEY);
  if (cache) {
    todosLosAvisos = soloMascotas(JSON.parse(cache));
    actualizarSelectDepartamentos();
    render();
  }
} catch (e) {
  console.warn('No se pudo leer la caché local:', e);
}

// Etapa 2: los más recientes primero, mostrados de a poco a medida que
// van llegando — en el celular entran más o menos 2 avisos por fila, así
// que apenas hay 1 o 2 en pantalla ya se ve contenido, en vez de esperar
// a que los 10 lleguen juntos para recién mostrar algo. Se logra usando
// 'child_added' (Firebase avisa uno por uno) en vez de 'value' (que
// entrega todo junto de una).
const queryRecientes = db.ref('avisos').orderByChild('fecha').limitToLast(10);

function alLlegarUnoReciente(snapshot) {
  const id = snapshot.key;
  const aviso = snapshot.val();
  if (!aviso || aviso.categoria === 'persona') return; // esta página es solo de mascotas
  todosLosAvisos[id] = aviso;
  agregarCardIncremental(id, aviso);
}
queryRecientes.on('child_added', alLlegarUnoReciente);

queryRecientes.once('value')
  .then(() => {
    // Cuando esta promesa se resuelve, Firebase garantiza que ya se
    // disparó 'child_added' para cada uno de los avisos de esta ráfaga
    // inicial (y ya se pintó su tarjeta). De acá en más se desengancha
    // este listener puntual — la Etapa 3 de abajo (el listado completo en
    // vivo) se encarga de todo lo que pase de ahora en adelante.
    queryRecientes.off('child_added', alLlegarUnoReciente);
    actualizarSelectDepartamentos();
  })
  .catch((err) => console.error('Error cargando avisos recientes:', err));

// Etapa 3: el listado completo, en vivo. Cuando llega, reemplaza
// del todo a todosLosAvisos (por eso ya no hace falta mezclar) y
// deja todo guardado en caché para la próxima visita.
db.ref('avisos').on('value', (snapshot) => {
  todosLosAvisos = soloMascotas(snapshot.val());
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

especieToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  [...especieToggle.children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroEspecie = btn.dataset.especie;
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

// Clasifica cada aviso en una de las 3 pestañas del filtro superior.
// El estado "ya resuelto" manda por encima de todo lo demás: no importa
// si lo encontró su propio dueño o alguien ajeno, en cuanto está marcado
// como entregado/reclamado pasa a "Ya encontrado por los dueños".
// 'perdido'    -> lo siguen buscando, nadie avisó haberlo encontrado todavía.
// 'encontrado' -> alguien AJENO (no el dueño) lo encontró y publicó el aviso,
//                 pero todavía nadie lo reclamó (estado sigue "buscando").
// 'resuelto'   -> ya está de vuelta con su dueño/familia, sin importar quién
//                 lo haya encontrado.
function categoriaFiltro(aviso) {
  if (aviso.estado === 'encontrado') return 'resuelto';
  return tipoDe(aviso) === 'encontrado' ? 'encontrado' : 'perdido';
}

// Dice si un aviso debería verse ahora mismo, según los filtros activos
// en pantalla (ubicación, especie, nombre buscado, pestaña
// Perdidos/Encontrados por otras personas/Ya aparecieron). Se usa tanto
// acá como en la carga incremental de la Etapa 2, para no repetir la
// misma lógica en dos lugares.
function pasaFiltrosActuales(aviso) {
  return (
    (filtroDepartamento === 'todas' || aviso.departamento === filtroDepartamento) &&
    (filtroCiudad === 'todas' || aviso.ciudad === filtroCiudad) &&
    (filtroEspecie === 'todas' || aviso.especie === filtroEspecie) &&
    (!filtroNombre || normalizarTexto(aviso.nombre).includes(filtroNombre)) &&
    categoriaFiltro(aviso) === filtroTipo
  );
}

// Agrega UNA tarjeta al listado sin reconstruir todo lo demás — así los
// avisos van apareciendo de a poco (más o menos de a 2, como entran por
// fila en un celular) en vez de esperar a que lleguen los 10 juntos.
//
// Nota honesta: como Firebase entrega estos avisos del más viejo de la
// ráfaga al más nuevo, y acá cada uno se agrega arriba de todo, el orden
// final queda bien (el más reciente termina arriba) recién cuando ya
// llegaron todos — durante el ratito que están llegando, puede verse por
// un instante en un orden que no es 100% el definitivo. Es una
// contrapartida a propósito: se prioriza que algo aparezca ya mismo por
// sobre que el orden intermedio sea perfecto, y se termina de acomodar
// solo en un par de segundos, cuando entra la Etapa 3.
function agregarCardIncremental(id, aviso) {
  if (modoBusquedaFoto) return; // ese modo tiene su propia forma de pintar
  if (!pasaFiltrosActuales(aviso)) return;
  if (grid.querySelector(`[data-id="${id}"]`)) return; // ya está, no duplicar

  emptyState.style.display = 'none';
  const card = crearCard(id, aviso);
  grid.insertBefore(card, grid.firstChild);

  const totalVisible = grid.querySelectorAll('.card').length;
  contador.textContent = totalVisible + (totalVisible === 1 ? ' aviso' : ' avisos');
}

function render() {
  if (modoBusquedaFoto) { renderPorFoto(); return; }

  const coincideFiltrosBase = ([id, a]) =>
    (filtroDepartamento === 'todas' || a.departamento === filtroDepartamento) &&
    (filtroCiudad === 'todas' || a.ciudad === filtroCiudad) &&
    (filtroEspecie === 'todas' || a.especie === filtroEspecie) &&
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

// Modo "búsqueda por foto": compara contra los avisos de "Perdidos" Y
// "Encontrados por otras personas" (los que siguen activos, sea porque su
// dueño los sigue buscando o porque alguien los tiene y no sabe de quién
// son), sin importar cuál pestaña esté seleccionada en pantalla. Se
// descartan los ya resueltos porque esos ya no están en búsqueda. Sigue
// respetando los filtros de ubicación.
let tokenRenderFoto = 0;
async function renderPorFoto() {
  if (!vectorFotoBuscada) {
    grid.innerHTML = '<p class="loading-msg">Analizando la foto…</p>';
    emptyState.style.display = 'none';
    return;
  }

  // Si mientras se está calculando esto llega un dato nuevo de Firebase (o
  // la persona sube otra foto), esta pasada queda vieja: se descarta su
  // resultado en vez de pisar lo que ya se está mostrando.
  const miToken = ++tokenRenderFoto;

  // Compara contra los avisos de "Perdidos" y "Encontrados por otras
  // personas" — tiene sentido buscar en ambos, porque la mascota/persona
  // de la foto puede estar reportada como perdida por su dueño O como
  // encontrada por alguien que la tiene. Se descartan los ya resueltos
  // ("Ya encontrado por los dueños"), porque esos ya no están en búsqueda.
  const candidatos = Object.entries(todosLosAvisos).filter(([id, a]) =>
    (a.imagenMiniBase64 || a.imagenBase64) &&
    (categoriaFiltro(a) === 'perdido' || categoriaFiltro(a) === 'encontrado') &&
    (filtroDepartamento === 'todas' || a.departamento === filtroDepartamento) &&
    (filtroCiudad === 'todas' || a.ciudad === filtroCiudad) &&
    (filtroEspecie === 'todas' || a.especie === filtroEspecie)
  );

  contadorPerdidos.textContent = '–';
  contadorEncontrados.textContent = '–';
  contadorResueltos.textContent = '–';

  if (candidatos.length === 0) {
    grid.innerHTML = '';
    contador.textContent = '0 avisos';
    emptyState.style.display = 'block';
    return;
  }

  grid.innerHTML = '<p class="loading-msg">Buscando coincidencias visuales…</p>';

  // Se compara contra TODOS los avisos de "Perdidos" que coincidan con los
  // filtros de categoría/ubicación (sin tope), priorizando el orden por
  // fecha solo para que el mensaje de avance ("comparando X/Y") tenga
  // sentido mientras corre.
  const aComparar = [...candidatos].sort((a, b) => (b[1].fecha || 0) - (a[1].fecha || 0));

  const conSimilitud = [];
  for (let i = 0; i < aComparar.length; i++) {
    const [id, aviso] = aComparar[i];
    // Si alguna foto puntual falla al analizarse (formato raro, imagen
    // corrupta, etc.), se la salta en vez de cortar toda la búsqueda.
    try {
      // Se usa siempre la miniatura (base64), nunca la foto grande de
      // Storage: así el análisis no depende de configurar permisos
      // especiales entre dominios (CORS) para leer píxeles de una imagen
      // que vive en otro servidor, y de paso es más liviano de procesar.
      const emb = await obtenerEmbedding(id, aviso.imagenMiniBase64 || aviso.imagenBase64);
      const score = similitudCoseno(vectorFotoBuscada, emb);
      conSimilitud.push({ id, aviso, score });
    } catch (err) {
      console.warn('No se pudo comparar el aviso', id, err);
    }
    if (miToken !== tokenRenderFoto) return; // superado por una búsqueda más nueva

    // Un respiro cada pocas imágenes: evita que el navegador se sienta
    // trabado en celulares de gama baja, y de paso muestra avance real.
    // Como ahora el modelo es más pesado (más precisión), se respira más
    // seguido que antes.
    if (i % 2 === 0) {
      fotoBusquedaTexto.textContent = `Comparando fotos... (${i + 1}/${aComparar.length})`;
      await respirar();
    }
  }

  if (!modoBusquedaFoto || !vectorFotoBuscada || miToken !== tokenRenderFoto) return;

  conSimilitud.sort((a, b) => b.score - a.score);
  const mejores = conSimilitud.slice(0, 30);

  fotoBusquedaTexto.textContent = 'Mostrando avisos de "Perdidos" y "Encontrados" parecidos a esta foto, de más a menos parecido.';
  contador.textContent = mejores.length + (mejores.length === 1 ? ' coincidencia' : ' coincidencias');
  grid.innerHTML = '';

  if (mejores.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  mejores.forEach(({ id, aviso, score }) => {
    grid.appendChild(crearCard(id, aviso, score));
  });
}

function crearCard(id, aviso, similitud) {
  const a = document.createElement('a');
  a.href = `aviso.html?id=${id}`;
  a.className = 'card';
  a.dataset.id = id;

  const numComentarios = aviso.comentarios ? Object.keys(aviso.comentarios).length : 0;
  const { stampClass, stampTexto } = calcularSello(aviso);

  // Cualquier aviso ya resuelto (estado "encontrado") lleva la cinta
  // diagonal, sin importar si lo encontró su propio dueño/familia (tipo
  // "perdido") o alguien ajeno que después lo entregó (tipo "encontrado").
  // El texto cambia según el caso para que quede claro qué pasó.
  const yaResuelto = aviso.estado === 'encontrado';
  const textoRibbon = tipoDe(aviso) === 'encontrado' ? 'Ya entregado' : 'Ya apareció';

  a.innerHTML = `
    <div class="card-media">
      <div class="tape"></div>
      <div class="stamp ${stampClass}">${stampTexto}</div>
      <div class="media-wrap">
        ${(aviso.imagenMiniBase64 || aviso.imagenBase64)
          ? `<img class="foto" src="${aviso.imagenMiniBase64 || aviso.imagenBase64}" alt="Foto de ${escapeHtml(aviso.nombre || '')}" loading="lazy" decoding="async">`
        : `<div class="foto sin-foto">Sin foto</div>`}
        ${yaResuelto ? `<div class="ribbon-aparecio">${textoRibbon}</div>` : ''}
        ${typeof similitud === 'number' ? `<div class="badge-similitud">${Math.round(similitud * 100)}% parecido</div>` : ''}
      </div>
    <div class="body">
      <div class="nombre">${escapeHtml(aviso.nombre || 'Sin nombre')}</div>
      <div class="meta">
        <span class="mono">${aviso.especie === 'perro' ? 'PERRO' : aviso.especie === 'gato' ? 'GATO' : 'MASCOTA'}</span>
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

// Calcula el texto y color del sello según tipo (perdido = lo estoy
// buscando / encontrado = lo tengo yo) y estado (buscando = sigue activo /
// encontrado = ya se resolvió el caso).
// aviso.tipo puede no existir en publicaciones viejas: se asume 'perdido'.
function calcularSello(aviso) {
  const esTipoEncontrado = tipoDe(aviso) === 'encontrado';
  const resuelto = aviso.estado === 'encontrado';

  if (esTipoEncontrado) {
    if (resuelto) {
      return { stampClass: 'encontrado', stampTexto: 'YA ENTREGADO' };
    }
    // Todavía nadie confirma que sea el dueño/familia: sello rojo para que
    // se note que está pendiente de que su dueño lo reclame.
    return { stampClass: 'pendiente', stampTexto: 'ENCONTRADO' };
  }

  if (resuelto) {
    return { stampClass: 'encontrado', stampTexto: 'ENCONTRADO' };
  }
  return { stampClass: 'mascota', stampTexto: 'PERDIDO' };
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
