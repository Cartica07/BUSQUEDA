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
const fotoBusquedaRefinar = document.getElementById('fotoBusquedaRefinar');

// Modal elements (may be null if HTML wasn't updated)
const photoSearchModal = document.getElementById('photoSearchModal');
const modalBuscarPerdidos = document.getElementById('modalBuscarPerdidos');
const modalBuscarEncontrados = document.getElementById('modalBuscarEncontrados');
const modalBuscarAmbos = document.getElementById('modalBuscarAmbos');
const modalBuscarCancelar = document.getElementById('modalBuscarCancelar');

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
let vectorFotoBuscada = null; // vector rápido (thumbnail)
let vectorFotoBuscadaFull = null; // vector para refine (mayor resolución)
let modeloIA = null;
let promesaModeloIA = null;
const cacheEmbeddings = {}; // id del aviso -> vector ya calculado (evita recalcular en cada búsqueda)
let selectedPhotoSection = 'ambos'; // 'perdido'|'encontrado'|'ambos'
let pendingPhotoFile = null; // archivo seleccionado por input, a la espera de decisión
let lastConSimilitud = []; // resultados de la búsqueda rápida (para refine)

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
    // Cargamos el modelo (alpha 1.0 por precisión; si va muy lento cambiar a alpha 0.25)
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

// Nuevo: crear thumbnail (dataURL) para enviar a la búsqueda rápida
async function makeThumbnailDataURL(file, maxSide = 320, quality = 0.7) {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    }
  } catch (e) {
    // fallback below
  }
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const img = await cargarImagen(fr.result);
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) { reject(err); }
    };
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    fr.readAsDataURL(file);
  });
}

// Las fotos de celular suelen venir en resolución enorme y hace falta achicarlas antes de analizarlas.
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

// Deja pasar un instante para que el navegador respire entre imagen e imagen.
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

// Nuevo flujo: al cambiar el input abrimos el modal en vez de iniciar de inmediato
inputBuscarFoto.addEventListener('change', () => {
  const file = inputBuscarFoto.files[0];
  if (file) {
    pendingPhotoFile = file;
    openPhotoSectionModal();
  }
});

fotoBusquedaCancelar.addEventListener('click', () => {
  salirDeBusquedaPorFoto();
});

fotoBusquedaRefinar && fotoBusquedaRefinar.addEventListener('click', () => {
  // botón visible después de la búsqueda rápida; ejecuta refine
  refinarBusquedaPorFoto();
});

// Modal handlers
function openPhotoSectionModal() {
  if (!photoSearchModal) {
    // Si no existe modal (por compatibilidad), arrancamos por ambos
    aceptarModalSeccion('ambos');
    return;
  }
  photoSearchModal.style.display = 'flex';
}

function cerrarModalSeccion() {
  if (photoSearchModal) photoSearchModal.style.display = 'none';
}

modalBuscarPerdidos && modalBuscarPerdidos.addEventListener('click', () => aceptarModalSeccion('perdido'));
modalBuscarEncontrados && modalBuscarEncontrados.addEventListener('click', () => aceptarModalSeccion('encontrado'));
modalBuscarAmbos && modalBuscarAmbos.addEventListener('click', () => aceptarModalSeccion('ambos'));
modalBuscarCancelar && modalBuscarCancelar.addEventListener('click', () => {
  pendingPhotoFile = null;
  cerrarModalSeccion();
  inputBuscarFoto.value = '';
});

// Al aceptar, arrancamos la búsqueda (rápida con thumbnail)
async function aceptarModalSeccion(seccion) {
  cerrarModalSeccion();
  selectedPhotoSection = seccion;
  if (!pendingPhotoFile) return;
  await iniciarBusquedaPorFoto(pendingPhotoFile, { section: selectedPhotoSection });
  pendingPhotoFile = null;
}

// iniciarBusquedaPorFoto ahora recibe la sección y usa thumbnail por defecto
async function iniciarBusquedaPorFoto(file, opts = { section: 'ambos' }) {
  modoBusquedaFoto = true;
  vectorFotoBuscada = null;
  vectorFotoBuscadaFull = null;
  filtroNombre = '';
  inputBuscar.value = '';
  inputBuscar.disabled = true;
  btnBuscarFoto.classList.add('activo');
  tipoToggle.classList.add('deshabilitado');

  const urlPreview = URL.createObjectURL(file);
  fotoBusquedaPreview.src = urlPreview;
  fotoBusquedaBar.style.display = 'flex';
  fotoBusquedaTexto.textContent = 'Generando miniatura y analizando (búsqueda rápida)...';
  fotoBusquedaRefinar && (fotoBusquedaRefinar.style.display = 'none');
  render();

  try {
    // thumbnail dataURL (much más liviana)
    const thumbDataUrl = await makeThumbnailDataURL(file, 320, 0.7);

    await cargarModeloIA();
    // embedding de la miniatura: búsqueda rápida
    const img = await cargarImagen(thumbDataUrl);
    const chico = redimensionarImagen(img, 224); // input reducido para rapidez
    const tensor = modeloIA.infer(chico, true);
    vectorFotoBuscada = await tensor.data();
    tensor.dispose();

    fotoBusquedaTexto.textContent = 'Buscando coincidencias (rápido)...';
    render(); // esto llamará a renderPorFoto que usará selectedPhotoSection
  } catch (err) {
    console.error('Error en la búsqueda por foto:', err);
    fotoBusquedaTexto.textContent = 'No se pudo analizar la foto. Probá con otra o intentá de nuevo.';
  }
}

function salirDeBusquedaPorFoto() {
  modoBusquedaFoto = false;
  vectorFotoBuscada = null;
  vectorFotoBuscadaFull = null;
  inputBuscar.disabled = false;
  btnBuscarFoto.classList.remove('activo');
  tipoToggle.classList.remove('deshabilitado');
  fotoBusquedaBar.style.display = 'none';
  inputBuscarFoto.value = '';
  fotoBusquedaRefinar && (fotoBusquedaRefinar.style.display = 'none');
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
//     pedir de a pocos es lo que más acelera el primer pantallazo).
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

// Etapa 2: los 10 más recientes (REST)
const urlBase = db.ref().toString().replace(/\/$/, '');
const urlRecientes = urlBase + '/avisos.json?orderBy=%22fecha%22&limitToLast=10';

fetch(urlRecientes)
  .then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then((datos) => {
    const recientes = soloMascotas(datos);
    Object.entries(recientes).forEach(([id, aviso]) => {
      todosLosAvisos[id] = aviso;
      agregarCardIncremental(id, aviso);
    });
    actualizarSelectDepartamentos();
  })
  .catch((err) => console.error('Error cargando avisos recientes (REST):', err));

// Etapa 3: listado completo en vivo
db.ref('avisos').on('value', (snapshot) => {
  todosLosAvisos = soloMascotas(snapshot.val());
  actualizarSelectDepartamentos();
  render();
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(todosLosAvisos));
  } catch (e) {
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

// Búsqueda por nombre
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
  poblarSelectCiudad(filtroDepartamento);
}

// El filtro de ciudad depende del departamento elegido
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

// Un aviso sin campo "tipo" se trata como "perdido"
function tipoDe(aviso) {
  return aviso.tipo === 'encontrado' ? 'encontrado' : 'perdido';
}

// Clasificación en las 3 pestañas
function categoriaFiltro(aviso) {
  if (aviso.estado === 'encontrado') return 'resuelto';
  return tipoDe(aviso) === 'encontrado' ? 'encontrado' : 'perdido';
}

// Comprueba si un aviso pasa los filtros actuales
function pasaFiltrosActuales(aviso) {
  return (
    (filtroDepartamento === 'todas' || aviso.departamento === filtroDepartamento) &&
    (filtroCiudad === 'todas' || aviso.ciudad === filtroCiudad) &&
    (filtroEspecie === 'todas' || aviso.especie === filtroEspecie) &&
    (!filtroNombre || normalizarTexto(aviso.nombre).includes(filtroNombre)) &&
    categoriaFiltro(aviso) === filtroTipo
  );
}

// Agrega UNA tarjeta al listado sin reconstruir todo
function agregarCardIncremental(id, aviso) {
  if (modoBusquedaFoto) return; // ese modo pinta distinto
  if (!pasaFiltrosActuales(aviso)) return;
  if (grid.querySelector(`[data-id="${id}"]`)) return; // ya está

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

// Modo "búsqueda por foto": compara contra avisos según selectedPhotoSection
let tokenRenderFoto = 0;
async function renderPorFoto() {
  if (!vectorFotoBuscada) {
    grid.innerHTML = '<p class="loading-msg">Analizando la foto…</p>';
    emptyState.style.display = 'none';
    return;
  }

  const miToken = ++tokenRenderFoto;

  const candidatos = Object.entries(todosLosAvisos).filter(([id, a]) =>
    (a.imagenMiniBase64 || a.imagenBase64) &&
    ((selectedPhotoSection === 'ambos') ||
      (selectedPhotoSection === 'perdido' && categoriaFiltro(a) === 'perdido') ||
      (selectedPhotoSection === 'encontrado' && categoriaFiltro(a) === 'encontrado')) &&
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

  const aComparar = [...candidatos].sort((a, b) => (b[1].fecha || 0) - (a[1].fecha || 0));

  const conSimilitud = [];
  // Limitar la búsqueda inicial para que no se trabe (ajustar según necesidad)
  const LIMITE_RAPIDO = 300;
  for (let i = 0; i < Math.min(aComparar.length, LIMITE_RAPIDO); i++) {
    const [id, aviso] = aComparar[i];
    try {
      const emb = await obtenerEmbedding(id, aviso.imagenMiniBase64 || aviso.imagenBase64);
      const score = similitudCoseno(vectorFotoBuscada, emb);
      conSimilitud.push({ id, aviso, score });
    } catch (err) {
      console.warn('No se pudo comparar el aviso', id, err);
    }
    if (miToken !== tokenRenderFoto) return;

    if (i % 4 === 0) {
      fotoBusquedaTexto.textContent = `Comparando fotos... (${i + 1}/${Math.min(aComparar.length, LIMITE_RAPIDO)})`;
      await respirar();
    }
  }

  if (!modoBusquedaFoto || !vectorFotoBuscada || miToken !== tokenRenderFoto) return;

  conSimilitud.sort((a, b) => b.score - a.score);
  const TOP_RAPIDO = 30;
  const mejores = conSimilitud.slice(0, TOP_RAPIDO);

  lastConSimilitud = conSimilitud;

  // Texto modificado:
  fotoBusquedaTexto.textContent = 'Mostrando resultados. Tocá el botón de abajo para que sea más preciso (tarda más).';
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

  fotoBusquedaRefinar && (fotoBusquedaRefinar.style.display = 'inline-block');
}

// Refine: recalcula embeddings con mayor resolución y re-rankea solo top-N
async function refinarBusquedaPorFoto() {
  if (!lastConSimilitud || lastConSimilitud.length === 0) return;
  if (!fotoBusquedaPreview || !fotoBusquedaPreview.src) return;

  fotoBusquedaTexto.textContent = 'Refinando búsqueda (mayor precisión)...';
  fotoBusquedaRefinar && (fotoBusquedaRefinar.style.display = 'none');

  try {
    await cargarModeloIA();

    // Recalcular vector de la foto de usuario con mayor resolución (más precisión)
    if (!vectorFotoBuscadaFull) {
      const imgUser = await cargarImagen(fotoBusquedaPreview.src);
      const chicoFull = redimensionarImagen(imgUser, 800); // aumentado a 800 para más detalle
      const tensorFull = modeloIA.infer(chicoFull, true);
      vectorFotoBuscadaFull = await tensorFull.data();
      tensorFull.dispose();
    }

    // Tomar más candidatos para refine (más opciones para re-rankear)
    const TOP_REFINE = 50; // aumentamos a 50 candidatos
    const candidatosParaRefinar = lastConSimilitud.slice(0, TOP_REFINE);

    const refinados = [];
    for (let i = 0; i < candidatosParaRefinar.length; i++) {
      const { id, aviso } = candidatosParaRefinar[i];
      try {
        // Si la publicación contiene imagen full-res la usamos, si no la miniatura
        const fuente = aviso.imagenBase64 || aviso.imagenMiniBase64;
        const img = await cargarImagen(fuente);
        const canvas = redimensionarImagen(img, 720); // más detalle que el rápido
        const tensor = modeloIA.infer(canvas, true);
        const emb = await tensor.data();
        tensor.dispose();
        const score = similitudCoseno(vectorFotoBuscadaFull, emb);
        refinados.push({ id, aviso, score });
      } catch (err) {
        console.warn('Error refinando aviso', id, err);
      }
      // respiramos de vez en cuando para no bloquear UI
      if (i % 3 === 0) await respirar();
    }

    refinados.sort((a, b) => b.score - a.score);
    const final = refinados.slice(0, 40);
    fotoBusquedaTexto.textContent = 'Resultados refinados — de más a menos parecido.';
    grid.innerHTML = '';
    if (final.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';
    final.forEach(({ id, aviso, score }) => {
      grid.appendChild(crearCard(id, aviso, score));
    });
    contador.textContent = final.length + (final.length === 1 ? ' coincidencia' : ' coincidencias');
  } catch (err) {
    console.error('Error refinando búsqueda:', err);
    fotoBusquedaTexto.textContent = 'No se pudo refinar la búsqueda. Probá de nuevo.';
    fotoBusquedaRefinar && (fotoBusquedaRefinar.style.display = 'inline-block');
  }
}

function crearCard(id, aviso, similitud) {
  const a = document.createElement('a');
  a.href = `aviso.html?id=${id}`;
  a.className = 'card';
  a.dataset.id = id;

  const numComentarios = aviso.comentarios ? Object.keys(aviso.comentarios).length : 0;
  const { stampClass, stampTexto } = calcularSello(aviso);

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

function calcularSello(aviso) {
  const esTipoEncontrado = tipoDe(aviso) === 'encontrado';
  const resuelto = aviso.estado === 'encontrado';

  if (esTipoEncontrado) {
    if (resuelto) {
      return { stampClass: 'encontrado', stampTexto: 'YA ENTREGADO' };
    }
    return { stampClass: 'pendiente', stampTexto: 'ENCONTRADO' };
  }

  if (resuelto) {
    return { stampClass: 'encontrado', stampTexto: 'ENCONTRADO' };
  }
  return { stampClass: 'mascota', stampTexto: 'PERDIDO' };
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
