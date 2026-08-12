// ============================================================
// FORMULARIO DE CREACIÓN — crear.html
// ============================================================
// Nota: la lista de departamentos y municipios (COLOMBIA_DATA) y el
// orden de departamentos afectados (DEPARTAMENTOS_AFECTADOS) vienen
// del archivo js/colombia-data.js, que se carga antes que este script.

let categoriaSeleccionada = 'persona';
let imagenBase64 = null;

// Clave usada para guardar el progreso del formulario en este navegador,
// por si se recarga la página o se cierra por error antes de publicar.
const BORRADOR_KEY = 'busqueda_borrador_aviso';
// Mientras se está restaurando un borrador, no queremos que los propios
// eventos que dispara la restauración (click, change) pisen el borrador
// con datos todavía incompletos.
let restaurandoBorrador = false;

const btnsCategoria = document.querySelectorAll('.categoria-toggle button');
const labelNombre = document.getElementById('labelNombre');
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
    if (categoriaSeleccionada === 'mascota') {
      labelNombre.textContent = 'Nombre de la mascota';
      nombreInput.placeholder = '';
      campoEdad.style.display = 'none';
    } else {
      labelNombre.textContent = 'Nombre de la persona';
      nombreInput.placeholder = '';
      campoEdad.style.display = 'block';
    }
    guardarBorrador();
  });
});

// Comprime la imagen en el navegador antes de guardarla (máx 900px de ancho, JPEG)
function manejarSeleccionFoto(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      imagenBase64 = canvas.toDataURL('image/jpeg', 0.72);

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
      nombre: nombreInput.value,
      departamento: departamentoSelect.value,
      municipio: municipioSelect.value,
      municipioOtro: municipioOtro.value,
      sector: sectorInput.value,
      descripcion: document.getElementById('descripcion').value,
      whatsapp: document.getElementById('whatsapp').value,
      redSocial: document.getElementById('redSocial').value,
      edad: document.getElementById('edad').value,
      imagenBase64
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

  if (borrador.categoria === 'mascota') {
    const btnMascota = document.querySelector('.categoria-toggle button[data-cat="mascota"]');
    if (btnMascota) btnMascota.click();
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
  if (borrador.edad) document.getElementById('edad').value = borrador.edad;

  if (borrador.imagenBase64) {
    imagenBase64 = borrador.imagenBase64;
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
    errorMsg.textContent = 'Sube el aviso de búsqueda antes de publicar.';
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
  btnSubmit.textContent = 'Publicando...';

  const nuevoAviso = {
    categoria: categoriaSeleccionada,
    nombre: nombre || (categoriaSeleccionada === 'mascota' ? 'Mascota sin nombre' : 'Sin nombre'),
    descripcion,
    whatsapp: whatsappFinal,
    redSocial,
    imagenBase64: imagenBase64 || null,
    estado: 'buscando',
    fecha: Date.now()
  };
  if (departamento) nuevoAviso.departamento = departamento;
  if (municipio) nuevoAviso.ciudad = municipio;
  if (categoriaSeleccionada === 'persona' && edad) nuevoAviso.edad = edad;
  if (sector) nuevoAviso.sector = sector;

  // Si la conexión está lenta o inestable, el guardado puede tardar. Si pasan
  // más de 12 segundos sin respuesta, avisamos en vez de dejar el botón trabado.
  let yaResolvio = false;
  const avisoLento = setTimeout(() => {
    if (!yaResolvio) {
      errorMsg.textContent = 'Está tardando más de lo normal — revisá tu conexión a internet. El aviso puede tardar en aparecer si la señal es débil, no hace falta que lo publiques de nuevo todavía.';
      errorMsg.classList.add('show');
      btnSubmit.textContent = 'Publicando... (esperando conexión)';
    }
  }, 12000);

  try {
    db.ref('avisos').push(nuevoAviso)
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
        btnSubmit.textContent = 'Publicar aviso';
      });
  } catch (err) {
    yaResolvio = true;
    clearTimeout(avisoLento);
    console.error('Error inesperado al intentar publicar:', err);
    errorMsg.textContent = 'Ocurrió un error inesperado. Revisá la consola del navegador (F12) para más detalle.';
    errorMsg.classList.add('show');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Publicar aviso';
  }
});
