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
// ============================================================

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
