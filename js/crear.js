// ============================================================
// FORMULARIO DE CREACIÓN — crear.html
// ============================================================
// Nota: la lista de departamentos y municipios (COLOMBIA_DATA) y el
// orden de departamentos afectados (DEPARTAMENTOS_AFECTADOS) vienen
// del archivo js/colombia-data.js, que se carga antes que este script.

let categoriaSeleccionada = 'persona';
let tipoSeleccionado = 'perdido';
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

const btnsCategoria = document.querySelectorAll('.categoria-toggle button');
const labelNombre = document.getElementById('labelNombre');
const labelEdad = document.getElementById('labelEdad');
const labelDepartamento = document.getElementById('labelDepartamento');
const labelMunicipio = document.getElementById('labelMunicipio');
const labelSector = document.getElementById('labelSector');
const labelDescripcion = document.getElementById('labelDescripcion');
const descripcionInput = document.getElementById('descripcion');
const campoEdad = document.getElementById('campoEdad');
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
    categoriaSeleccionada = btn.dataset.cat;
    tipoSeleccionado = btn.dataset.tipo;
    actualizarTextosFormulario();
    guardarBorrador();
  });
});

// Adapta etiquetas y placeholders según sea persona/mascota y perdido/encontrado,
// porque no se le pide lo mismo a quien perdió a alguien que a quien encontró
// a alguien y no sabe nada de esa persona o animal.
function actualizarTextosFormulario() {
  const esMascota = categoriaSeleccionada === 'mascota';
  const esEncontrado = tipoSeleccionado === 'encontrado';

  labelNombre.textContent = esMascota
    ? (esEncontrado ? 'Nombre de la mascota (si lo sabe)' : 'Nombre de la mascota')
    : (esEncontrado ? 'Nombre de la persona (si lo sabe)' : 'Nombre de la persona');

  campoEdad.style.display = esMascota ? 'none' : 'block';
  labelEdad.textContent = esEncontrado ? 'Edad aproximada (opcional)' : 'Edad (opcional)';

  labelDepartamento.textContent = esEncontrado ? 'Departamento donde la encontraste' : 'Departamento';
  labelMunicipio.textContent = esEncontrado ? 'Municipio o ciudad donde la encontraste' : 'Municipio o ciudad';
  labelSector.innerHTML = (esEncontrado ? 'Sector donde la encontraste ' : 'Sector ') +
    '<span style="font-weight:400;color:var(--muted);">(barrio, comuna o zona)</span>';

  labelDescripcion.textContent = 'Descripción (opcional)';
  if (esEncontrado) {
    descripcionInput.placeholder = esMascota
      ? '¿En qué estado la encontraste? Raza, color, tamaño, si tiene collar o placa, cómo se comporta, si está herida...'
      : '¿En qué estado la encontraste? ¿Ha dicho algo, sabe su nombre o dónde vive? Ropa, señas particulares, edad aproximada...';
  } else {
    descripcionInput.placeholder = esMascota
      ? 'Raza, color, tamaño, señas particulares, si tenía collar, cómo se comporta...'
      : 'Última vez visto/a, ropa, señas particulares, cualquier detalle que ayude a identificarla...';
  }
}

// Aplica los textos correctos para el estado inicial (persona + perdido)
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
      categoria: categoriaSeleccionada,
      tipo: tipoSeleccionado,
      nombre: nombreInput.value,
      departamento: departamentoSelect.value,
      municipio: municipioSelect.value,
      municipioOtro: municipioOtro.value,
      sector: sectorInput.value,
      descripcion: document.getElementById('descripcion').value,
      whatsapp: document.getElementById('whatsapp').value,
      redSocial: document.getElementById('redSocial').value,
      edad: document.getElementById('edad').value,
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
  const catBorrador = borrador.categoria === 'mascota' ? 'mascota' : 'persona';
  const btnCoincidente = document.querySelector(
    `.categoria-toggle button[data-cat="${catBorrador}"][data-tipo="${tipoBorrador}"]`
  );
  if (btnCoincidente) btnCoincidente.click();

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
  if (borrador.edad) document.getElementById('edad').value = borrador.edad;

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
 document.getElementById('whatsapp'), document.getElementById('redSocial'),
 document.getElementById('edad')].forEach(el => {
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
  const edad = document.getElementById('edad').value.trim();

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
  if (categoriaSeleccionada === 'persona' && edad) nuevoAviso.edad = edad;
  if (sector) nuevoAviso.sector = sector;

  function nombrePorDefecto() {
    if (tipoSeleccionado === 'encontrado') {
      return categoriaSeleccionada === 'mascota' ? 'Mascota no identificada' : 'Persona no identificada';
    }
    return categoriaSeleccionada === 'mascota' ? 'Mascota sin nombre' : 'Sin nombre';
  }

  // La foto grande (la que se ve en el detalle del aviso) ya no se guarda
  // como texto dentro de la base de datos — eso es lo que hacía tan pesada
  // la carga inicial de la página principal. Ahora se sube como archivo a
  // Firebase Storage y solo se guarda su URL, que pesa unos pocos bytes.
  // La miniatura sigue viviendo en la base de datos porque es chica y la
  // usan tanto las tarjetas del listado como la búsqueda por foto.
  //
  // Si por algún motivo falla la subida a Storage (por ejemplo, todavía no
  // está activado en el proyecto), el aviso igual se publica usando la
  // foto grande en base64 como antes, para no dejar a nadie sin poder
  // publicar en medio de una emergencia.
  let yaResolvio = false;
  const avisoLento = setTimeout(() => {
    if (!yaResolvio) {
      errorMsg.textContent = 'Está tardando más de lo normal — revisá tu conexión a internet. El aviso puede tardar en aparecer si la señal es débil, no hace falta que lo publiques de nuevo todavía.';
      errorMsg.classList.add('show');
      btnSubmit.textContent = 'Publicando... (esperando conexión)';
    }
  }, 20000);

  subirFotoAStorage(imagenBase64)
    .then((url) => {
      nuevoAviso.imagenURL = url;
    })
    .catch((err) => {
      console.warn('No se pudo subir la foto a Storage, se guarda como antes:', err);
      nuevoAviso.imagenBase64 = imagenBase64;
    })
    .then(() => {
      btnSubmit.textContent = 'Publicando...';
      return db.ref('avisos').push(nuevoAviso);
    })
    .then((ref) => {
      yaResolvio = true;
      clearTimeout(avisoLento);
      borrarBorrador();
      window.location.href = `aviso.html?id=${ref.key}`;
    })
    .catch((err) => {
      yaResolvio = true;
      clearTimeout(avisoLento);
      console.error('Error al publicar en Firebase:', err);
      errorMsg.textContent = 'No se pudo publicar (' + (err && err.code ? err.code : 'error de conexión') + '). Revisá tu conexión e intentá de nuevo.';
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
