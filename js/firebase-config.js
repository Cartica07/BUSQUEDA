// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================
// 1. Andá a https://console.firebase.google.com
// 2. Creá un proyecto nuevo (ej: "busqueda-terremoto-co")
// 3. Dentro del proyecto: Build > Realtime Database > Crear base de datos
//    (elegí modo "de prueba" para arrancar, después ajustá las reglas
//    con el archivo database.rules.json que te dejé en este proyecto)
// 4. En el ícono de engranaje > Configuración del proyecto > tus apps
//    > ícono "</>" (Web) > registrá la app y copiá el firebaseConfig
// 5. Pegalo acá abajo, reemplazando los valores de ejemplo.
//
// Para el panel de administración (admin.html) hace falta un paso extra:
// ver las instrucciones en el README, sección "Panel de administración".
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBVDXnEsXPUJG8pPTkjXUKKpO3l3IRuu-8",
  authDomain: "busqueda-855cb.firebaseapp.com",
  databaseURL: "https://busqueda-855cb-default-rtdb.firebaseio.com",
  projectId: "busqueda-855cb",
  storageBucket: "busqueda-855cb.firebasestorage.app",
  messagingSenderId: "845156228134",
  appId: "1:845156228134:web:43f928ebff7ef1648c9ae7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// El SDK de Auth solo se carga en admin.html (las demás páginas no lo
// necesitan), por eso se crea `auth` únicamente si está disponible.
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
// El SDK de Storage solo se carga en crear.html (para subir fotos) y en
// admin.html (para poder borrarlas al eliminar un aviso). El resto de
// páginas solo muestra <img> apuntando a URLs de Storage, sin necesitar
// el SDK para nada.
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
