// ============================================================
// FORMULARIO DE CREACIÓN — crear.html
// ============================================================
// Nota: la lista de departamentos y municipios (COLOMBIA_DATA) y el
// orden de departamentos afectados (DEPARTAMENTOS_AFECTADOS) vienen
// del archivo js/colombia-data.js, que se carga antes que este script.

// Ya no se pide elegir entre persona/mascota: esta página es solo para
// mascotas (los avisos de personas se manejan aparte). Se deja fijo para
// no tener que tocar el resto del código que todavía distingue por
// categoría (el listado principal, el panel de admin, etc.).
const categoriaSeleccionada = 'mascota';
let tipoSeleccionado = 'perdido';
let especieSeleccionada = null; // 'perro' | 'gato' | null (opcional)
let imagenBase64 = null;
// Versión chica de la misma foto, solo para las tarjetas del listado
// principal — así abrir la página con muchos avisos no obliga a bajarse
// la foto grande de cada uno (esa se sigue usando en la página de detalle).
let imagenMiniBase64 = null;

// Clave usada para guardar el progreso del formulario en este navegador,
// por si se recarga la página o se cierra por error antes de publicar.
const BORRADOR_KEY = 'busqueda_borrador_aviso';
// Mientras se está restaurando un borrador, no queremos que los propios
// eventos que dispara la restauración (click, change) pisen el borrador
// con datos todavía incompletos.
let restaurandoBorrador = false;

const btnsCategoria = document.querySelectorAll('#tipoToggleForm button');
const btnsEspecie = document.querySelectorAll('#especieToggleForm button');
const labelNombre = document.getElementById('labelNombre');
const labelDepartamento = document.getElementById('labelDepartamento');
const labelMunicipio = document.getElementById('labelMunicipio');
const labelSector = document.getElementById('labelSector');
const labelDescripcion = document.getElementById('labelDescripcion');
const descripcionInput = document.getElementById('descripcion');
const nombreInput = document.getElementById('nombre');
const fotoInput = document.getElementById('fotoInput');
const fotoDrop = document.getElementById('fotoDrop');
const fotoTexto = document.getElementById('fotoTexto');
const form = document.getElementById('formAviso');
const btnSubmit = document.getElementById('btnSubmit');
const errorMsg = document.getElementById('errorMsg');
const departamentoSelect = document.getElementById('departamento');
const campoMunicipio = document.getElementById('campoMunicipio');
const municipioSelect = document.getElementById('municipio');
const municipioOtro = document.getElementById('municipioOtro');
const sectorInput = document.getElementById('sector');

const OTRO_MUNICIPIO = 'Otro / no aparece en la lista';

// ---------- Poblar el select de departamentos ----------
// Primero los departamentos con afectación reportada (más rápidos de
// encontrar), después el resto en orden alfabético.
(function poblarDepartamentos() {
  const todos = Object.keys(COLOMBIA_DATA).sort((a, b) => a.localeCompare(b, 'es'));
  const afectados = DEPARTAMENTOS_AFECTADOS.filter(d => todos.includes(d));
  const resto = todos.filter(d => !afectados.includes(d));

  if (afectados.length) {
    const grupoAfectados = document.createElement('optgroup');
    grupoAfectados.label = 'Departamentos con afectación reportada';
    afectados.forEach(dep => {
      const opt = document.createElement('option');
      opt.value = dep;
      opt.textContent = dep;
      grupoAfectados.appendChild(opt);
    });
    departamentoSelect.appendChild(grupoAfectados);
  }

  const grupoResto = document.createElement('optgroup');
  grupoResto.label = 'Todos los departamentos';
  resto.forEach(dep => {
    const opt = document.createElement('option');
    opt.value = dep;
    opt.textContent = dep;
    grupoResto.appendChild(opt);
  });
  departamentoSelect.appendChild(grupoResto);
})();

// Al elegir departamento: se despliega el selector de municipio con
// todos los municipios de ese departamento (más la opción "Otro").
departamentoSelect.addEventListener('change', () => {
  poblarMunicipios(departamentoSelect.value);
  guardarBorrador();
});

function poblarMunicipios(depto) {
  municipioSelect.innerHTML = '<option value="" selected>Elegí el municipio</option>';
  municipioOtro.style.display = 'none';
  municipioOtro.value = '';

  if (!depto || !COLOMBIA_DATA[depto]) {
    campoMunicipio.style.display = 'none';
    return;
  }
  campoMunicipio.style.display = 'block';

  COLOMBIA_DATA[depto].forEach(mun => {
    const opt = document.createElement('option');
    opt.value = mun;
    opt.textContent = mun;
    municipioSelect.appendChild(opt);
  });

  const optOtro = document.createElement('option');
  optOtro.value = OTRO_MUNICIPIO;
  optOtro.textContent = 'Otro / no aparece en la lista';
  municipioSelect.appendChild(optOtro);
}

municipioSelect.addEventListener('change', () => {
  const esOtro = municipioSelect.value === OTRO_MUNICIPIO;
  municipioOtro.style.display = esOtro ? 'block' : 'none';
  guardarBorrador();
});

btnsCategoria.forEach(btn => {
  btn.addEventListener('click', () => {
    btnsCategoria.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tipoSeleccionado = btn.dataset.tipo;
    actualizarTextosFormulario();
    guardarBorrador();
  });
});

// Es opcional, así que a diferencia del toggle de arriba (que siempre
// tiene uno activo) acá se puede tocar el botón ya activo para
// deseleccionarlo y dejar la especie sin definir.
btnsEspecie.forEach(btn => {
  btn.addEventListener('click', () => {
    const yaEstabaActivo = btn.classList.contains('active');
    btnsEspecie.forEach(b => b.classList.remove('active'));
    if (yaEstabaActivo) {
      especieSeleccionada = null;
    } else {
      btn.classList.add('active');
      especieSeleccionada = btn.dataset.especie;
    }
    guardarBorrador();
  });
});

// Adapta etiquetas y placeholders según sea perdido/encontrado, porque no
// se le pide lo mismo a quien perdió a su mascota que a quien encontró una
// y no sabe nada de ella.
function actualizarTextosFormulario() {
  const esEncontrado = tipoSeleccionado === 'encontrado';

  labelNombre.textContent = esEncontrado ? 'Nombre de la mascota (si lo sabe)' : 'Nombre de la mascota';

  labelDepartamento.textContent = esEncontrado ? 'Departamento donde la encontraste' : 'Departamento';
  labelMunicipio.textContent = esEncontrado ? 'Municipio o ciudad donde la encontraste' : 'Municipio o ciudad';
  labelSector.innerHTML = (esEncontrado ? 'Sector donde la encontraste ' : 'Sector ') +
    '<span style="font-weight:400;color:var(--muted);">(barrio, comuna o zona)</span>';

  labelDescripcion.textContent = 'Descripción (opcional)';
  descripcionInput.placeholder = esEncontrado
    ? '¿En qué estado la encontraste? Raza, color, tamaño, si tiene collar o placa, cómo se comporta, si está herida...'
    : 'Raza, color, tamaño, señas particulares, si tenía collar, cómo se comporta...';
}

// Aplica los textos correctos para el estado inicial (perdido)
actualizarTextosFormulario();
function manejarSeleccionFoto(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      imagenBase64 = redimensionarADataURL(img, 900, 0.72);
      imagenMiniBase64 = redimensionarADataURL(img, 360, 0.6);

      fotoDrop.innerHTML = `<img src="${imagenBase64}" alt="Vista previa">
        <input type="file" id="fotoInput" accept="image/*">`;
      const nuevoInput = document.getElementById('fotoInput');
      nuevoInput.addEventListener('change', () => manejarSeleccionFoto(nuevoInput.files[0]));
      guardarBorrador();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Reescala una imagen ya cargada a un ancho máximo y la devuelve como JPEG
// en base64. Se usa dos veces por cada foto: una versión grande (para la
// página de detalle) y una chica y más comprimida (para las tarjetas del
// listado, que se cargan todas juntas).
function redimensionarADataURL(img, maxWidth, calidad) {
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', calidad);
}

fotoInput.addEventListener('change', () => manejarSeleccionFoto(fotoInput.files[0]));

// ============================================================
// GUARDADO AUTOMÁTICO DEL BORRADOR (localStorage)
// ============================================================
// Guarda el progreso del formulario para que, si la página se recarga
// o se cierra por error antes de publicar, no se pierda lo ya escrito.

function guardarBorrador() {
  if (restaurandoBorrador) return;
  try {
    const borrador = {
      tipo: tipoSeleccionado,
      especie: especieSeleccionada,
      nombre: nombreInput.value,
      departamento: departamentoSelect.value,
      municipio: municipioSelect.value,
      municipioOtro: municipioOtro.value,
      sector: sectorInput.value,
      descripcion: document.getElementById('descripcion').value,
      whatsapp: document.getElementById('whatsapp').value,
      redSocial: document.getElementById('redSocial').value,
      imagenBase64,
      imagenMiniBase64
    };
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(borrador));
  } catch (err) {
    // Si el navegador bloquea localStorage (modo privado, cuota llena, etc.)
    // simplemente no se guarda el borrador; no debe romper el formulario.
    console.warn('No se pudo guardar el borrador:', err);
  }
}

function borrarBorrador() {
  try {
    localStorage.removeItem(BORRADOR_KEY);
  } catch (err) { /* nada que hacer */ }
}

function restaurarBorrador() {
  let borrador = null;
  try {
    const raw = localStorage.getItem(BORRADOR_KEY);
    if (raw) borrador = JSON.parse(raw);
  } catch (err) {
    return;
  }
  if (!borrador) return;

  restaurandoBorrador = true;

  const tipoBorrador = borrador.tipo === 'encontrado' ? 'encontrado' : 'perdido';
  const btnCoincidente = document.querySelector(
    `#tipoToggleForm button[data-tipo="${tipoBorrador}"]`
  );
  if (btnCoincidente) btnCoincidente.click();

  if (borrador.especie === 'perro' || borrador.especie === 'gato') {
    const btnEspecieCoincidente = document.querySelector(
      `#especieToggleForm button[data-especie="${borrador.especie}"]`
    );
    if (btnEspecieCoincidente) btnEspecieCoincidente.click();
  }

  if (borrador.nombre) nombreInput.value = borrador.nombre;

  if (borrador.departamento) {
    departamentoSelect.value = borrador.departamento;
    poblarMunicipios(borrador.departamento);
    if (borrador.municipio) municipioSelect.value = borrador.municipio;
    if (borrador.municipioOtro) {
      municipioOtro.value = borrador.municipioOtro;
      municipioOtro.style.display = municipioSelect.value === OTRO_MUNICIPIO ? 'block' : 'none';
    }
  }

  if (borrador.sector) sectorInput.value = borrador.sector;
  if (borrador.descripcion) document.getElementById('descripcion').value = borrador.descripcion;
  if (borrador.whatsapp) document.getElementById('whatsapp').value = borrador.whatsapp;
  if (borrador.redSocial) document.getElementById('redSocial').value = borrador.redSocial;

  if (borrador.imagenBase64) {
    imagenBase64 = borrador.imagenBase64;
    // Los borradores guardados antes de que existiera la miniatura no la
    // van a tener: en ese caso se usa la foto grande como respaldo, así el
    // aviso publicado igual queda con algo en el campo imagenMiniBase64.
    imagenMiniBase64 = borrador.imagenMiniBase64 || borrador.imagenBase64;
    fotoDrop.innerHTML = `<img src="${imagenBase64}" alt="Vista previa">
      <input type="file" id="fotoInput" accept="image/*">`;
    const nuevoInput = document.getElementById('fotoInput');
    nuevoInput.addEventListener('change', () => manejarSeleccionFoto(nuevoInput.files[0]));
  }

  restaurandoBorrador = false;
}

// Cualquier cambio en estos campos actualiza el borrador guardado
[nombreInput, sectorInput, municipioOtro, document.getElementById('descripcion'),
 document.getElementById('whatsapp'), document.getElementById('redSocial')].forEach(el => {
  el.addEventListener('input', guardarBorrador);
});

restaurarBorrador();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorMsg.classList.remove('show');

  const nombre = nombreInput.value.trim();
  const departamento = departamentoSelect.value;
  const municipio = municipioSelect.value === OTRO_MUNICIPIO
    ? municipioOtro.value.trim()
    : municipioSelect.value;
  const sector = sectorInput.value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();
  const whatsappRaw = document.getElementById('whatsapp').value.trim();
  const redSocial = document.getElementById('redSocial').value.trim();

  // El único dato realmente obligatorio es el aviso/foto: ya viene con
  // toda la información escrita, así que el resto de campos son de apoyo
  // para poder filtrar y buscar, no un requisito para publicar.
  if (!imagenBase64) {
    errorMsg.textContent = 'Sube el aviso o foto antes de publicar.';
    errorMsg.classList.add('show');
    return;
  }

  let whatsappFinal = null;
  if (whatsappRaw) {
    const soloNumeros = whatsappRaw.replace(/\D/g, '');
    if (soloNumeros.length < 7) {
      errorMsg.textContent = 'Revisá el número de WhatsApp, parece incompleto.';
      errorMsg.classList.add('show');
      return;
    }
    whatsappFinal = '57' + soloNumeros;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Subiendo foto...';

  const nuevoAviso = {
    categoria: categoriaSeleccionada,
    tipo: tipoSeleccionado,
    nombre: nombre || nombrePorDefecto(),
    descripcion,
    whatsapp: whatsappFinal,
    redSocial,
    imagenMiniBase64: imagenMiniBase64 || imagenBase64 || null,
    estado: 'buscando',
    fecha: Date.now()
  };
  if (departamento) nuevoAviso.departamento = departamento;
  if (municipio) nuevoAviso.ciudad = municipio;
  if (sector) nuevoAviso.sector = sector;
  if (especieSeleccionada) nuevoAviso.especie = especieSeleccionada;

  function nombrePorDefecto() {
    if (tipoSeleccionado === 'encontrado') return 'Mascota no identificada';
    return 'Mascota sin nombre';
  }

  // La foto grande (la que se ve en el detalle del aviso) ya no se guarda
  // adentro del mismo registro que usa el listado principal — eso es lo
  // que hacía tan pesada la carga inicial de la página principal. Primero
  // se intenta subir a Firebase Storage (si está activado en el proyecto)
  // y solo se guarda su URL, que pesa unos pocos bytes. Si Storage no está
  // disponible (por ejemplo, todavía no se activó el plan Blaze), la foto
  // grande se guarda igual, pero en un nodo APARTE de Realtime Database
  // ("avisos_fotos"), para que nunca viaje junto con el listado — solo se
  // pide cuando alguien entra al detalle de ESE aviso puntual.
  // La miniatura sigue viviendo en el registro liviano porque es chica y la
  // usan tanto las tarjetas del listado como la búsqueda por foto.
  let yaResolvio = false;

  // Si el navegador no logra conectarse a Firebase en tiempo real (wifi con
  // portal cautivo, señal mala, firewall que bloquea WebSockets), el SDK NO
  // tira error: deja el envío en cola esperando reconexión indefinidamente.
  // Antes eso dejaba el botón trabado para siempre sin ningún aviso real.
  // Este aviso "blando" a los 20s solo avisa; el "duro" de abajo (40s) corta
  // la espera de verdad y libera el botón para que se pueda reintentar.
  const avisoLento = setTimeout(() => {
    if (!yaResolvio) {
      errorMsg.textContent = 'Está tardando más de lo normal — revisá tu conexión a internet. El aviso puede tardar en aparecer si la señal es débil, no hace falta que lo publiques de nuevo todavía.';
      errorMsg.classList.add('show');
      btnSubmit.textContent = 'Publicando... (esperando conexión)';
    }
  }, 20000);

  const LIMITE_DURO_MS = 40000;
  const timeoutDuro = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT_CONEXION')), LIMITE_DURO_MS);
  });

  const publicacion = subirFotoAStorage(imagenBase64)
    .then((url) => {
      nuevoAviso.imagenURL = url;
    })
    .catch((err) => {
      console.warn('No se pudo subir la foto a Storage, se guarda aparte en la base de datos:', err);
    })
    .then(() => {
      if (yaResolvio) return; // el límite duro ya cortó la espera, no seguir
      btnSubmit.textContent = 'Publicando...';
      // Se reserva la key de antemano (push() sin datos genera el id al
      // instante, sin escribir nada todavía) para poder guardar en una
      // sola operación atómica el registro liviano en "avisos" y, si hizo
      // falta el respaldo, la foto pesada en "avisos_fotos".
      const nuevaRef = db.ref('avisos').push();
      const actualizaciones = {};
      actualizaciones['avisos/' + nuevaRef.key] = nuevoAviso;
      if (!nuevoAviso.imagenURL) {
        actualizaciones['avisos_fotos/' + nuevaRef.key] = { imagenBase64 };
      }
      return db.ref().update(actualizaciones).then(() => nuevaRef);
    });

  Promise.race([publicacion, timeoutDuro])
    .then((ref) => {
      // Si ya se venció el límite duro antes de que esto resolviera, el
      // aviso puede terminar publicándose igual unos segundos después en
      // segundo plano — no forzamos la redirección para no confundir a
      // alguien que ya vio el error y quizás reintentó.
      if (yaResolvio || !ref) return;
      yaResolvio = true;
      clearTimeout(avisoLento);
      borrarBorrador();
      window.location.href = `aviso.html?id=${ref.key}`;
    })
    .catch((err) => {
      if (yaResolvio) return;
      yaResolvio = true;
      clearTimeout(avisoLento);
      console.error('Error al publicar en Firebase:', err);
      const esTimeout = err && err.message === 'TIMEOUT_CONEXION';
      errorMsg.textContent = esTimeout
        ? 'No se pudo conectar con el servidor después de 40 segundos. Revisá tu conexión a internet (wifi/datos) e intentá de nuevo — si el aviso anterior llegó a publicarse igual más tarde en segundo plano, no pasa nada, simplemente no lo publiques dos veces si lo ves aparecer.'
        : 'No se pudo publicar (' + (err && err.code ? err.code : 'error de conexión') + '). Revisá tu conexión e intentá de nuevo.';
      errorMsg.classList.add('show');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Publicar aviso o foto';
    });
});

// Sube la foto grande (dataURL en base64) a Firebase Storage como archivo
// JPEG y devuelve su URL pública de descarga. Si el SDK de Storage no está
// disponible en la página (o no se activó Storage en el proyecto todavía),
// rechaza la promesa para que quien llama pueda usar el respaldo en base64.
async function subirFotoAStorage(dataUrl) {
  if (!storage) throw new Error('Firebase Storage no está disponible');
  const blob = await (await fetch(dataUrl)).blob();
  const nombreArchivo = `avisos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const ref = storage.ref(nombreArchivo);
  await ref.put(blob, { contentType: 'image/jpeg' });
  return await ref.getDownloadURL();
}
