// ============================================================
// FORMULARIO DE CREACIÓN — crear.html
// ============================================================

// Ciudades afectadas por el terremoto del 10 de agosto de 2026 (mag. 7.4, epicentro
// en San José del Palmar, Chocó). Ajustá esta lista si aparecen más zonas afectadas.
const CIUDADES_AFECTADAS = [
  'Cali',
  'Pereira',
  'Manizales',
  'Quibdó',
  'Armenia',
  'San José del Palmar (Chocó)',
  'Buenaventura',
  'Otra ciudad afectada'
];

let categoriaSeleccionada = 'persona';
let imagenBase64 = null;

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
const ciudadSelect = document.getElementById('ciudad');
const ciudadOtra = document.getElementById('ciudadOtra');
const sectorInput = document.getElementById('sector');

// Poblar el select de ciudades
CIUDADES_AFECTADAS.forEach(c => {
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = c;
  ciudadSelect.appendChild(opt);
});

// Al elegir ciudad: se desbloquea el campo "Sector", y si es "Otra" se pide el nombre
ciudadSelect.addEventListener('change', () => {
  const esOtra = ciudadSelect.value === 'Otra ciudad afectada';
  ciudadOtra.style.display = esOtra ? 'block' : 'none';
  ciudadOtra.required = esOtra;

  sectorInput.disabled = false;
  sectorInput.placeholder = 'Ej: Barrio El Pueblo, Comuna 3...';
});

btnsCategoria.forEach(btn => {
  btn.addEventListener('click', () => {
    btnsCategoria.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    categoriaSeleccionada = btn.dataset.cat;
    if (categoriaSeleccionada === 'mascota') {
      labelNombre.textContent = 'Nombre de la mascota';
      nombreInput.placeholder = 'Ej: Firulais (o "No sé el nombre" si no es tuya)';
      campoEdad.style.display = 'none';
    } else {
      labelNombre.textContent = 'Nombre de la persona';
      nombreInput.placeholder = 'Ej: María Fernanda Rojas';
      campoEdad.style.display = 'block';
    }
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
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

fotoInput.addEventListener('change', () => manejarSeleccionFoto(fotoInput.files[0]));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorMsg.classList.remove('show');

  const nombre = nombreInput.value.trim();
  const ciudad = ciudadSelect.value === 'Otra ciudad afectada'
    ? ciudadOtra.value.trim()
    : ciudadSelect.value;
  const sector = sectorInput.value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();
  const whatsappRaw = document.getElementById('whatsapp').value.trim();
  const redSocial = document.getElementById('redSocial').value.trim();
  const edad = document.getElementById('edad').value.trim();

  if (!imagenBase64) {
    errorMsg.textContent = 'Sube la imagen del poster o aviso antes de publicar.';
    errorMsg.classList.add('show');
    return;
  }

  if (!nombre || !ciudad) {
    errorMsg.textContent = 'Completá al menos nombre y ciudad.';
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
    nombre,
    ciudad,
    descripcion,
    whatsapp: whatsappFinal,
    redSocial,
    imagenBase64: imagenBase64 || null,
    estado: 'buscando',
    fecha: Date.now()
  };
  if (categoriaSeleccionada === 'persona' && edad) nuevoAviso.edad = edad;
  if (sector) nuevoAviso.sector = sector;

  db.ref('avisos').push(nuevoAviso)
    .then((ref) => {
      window.location.href = `aviso.html?id=${ref.key}`;
    })
    .catch((err) => {
      console.error(err);
      errorMsg.textContent = 'No se pudo publicar. Revisá tu conexión e intentá de nuevo.';
      errorMsg.classList.add('show');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Publicar aviso';
    });
});
