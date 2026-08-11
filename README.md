# Se Busca — avisos de personas y mascotas perdidas

Sitio estático (HTML/CSS/JS puro) + Firebase Realtime Database como backend. Sin frameworks, sin build: se despliega tal cual en Vercel.

## Qué hace

- Cualquiera publica un aviso: categoría (persona/mascota), nombre, ciudad, descripción, foto y WhatsApp de contacto.
- La página principal muestra los avisos en tiempo real, con filtro por categoría y por ciudad.
- Cada aviso tiene su propia página con botón directo a WhatsApp (`wa.me`) y un chat público donde cualquiera puede comentar ("lo vi en tal lado", "acá está tu mascota", etc.), también en tiempo real.
- Quien publicó puede marcar el aviso como "encontrado" desde la misma página.

## 1. Crear el proyecto de Firebase

1. Andá a [console.firebase.google.com](https://console.firebase.google.com) → **Crear proyecto**.
2. Dentro del proyecto: **Build → Realtime Database → Crear base de datos**. Elegí la región más cercana (ej. `us-central1`) y arrancá en modo de prueba.
3. Andá a **Configuración del proyecto** (ícono de engranaje) → pestaña **Tus apps** → ícono `</>` (Web) → registrá una app (no hace falta Hosting).
4. Copiá el objeto `firebaseConfig` que te muestra.
5. Pegalo en `js/firebase-config.js`, reemplazando los valores de ejemplo.

## 2. Aplicar las reglas de seguridad

El archivo `database.rules.json` ya está armado para que:
- Cualquiera pueda leer y crear avisos y comentarios.
- **Nadie pueda editar o borrar** un aviso ya creado (evita que borren avisos ajenos).
- Cualquiera pueda cambiar el campo `estado` a `encontrado` (para el botón de "marcar como encontrado").
- Se limite el tamaño de texto e imagen para evitar abuso.

Para aplicarlas: en la consola de Firebase, andá a **Realtime Database → Reglas**, pegá el contenido de `database.rules.json` y publicá.

> Nota: como no hay login de usuarios, cualquiera que tenga el link puede comentar o marcar como encontrado. Es una decisión a propósito para bajar la fricción en una emergencia, pero es bueno que lo sepas.

## 3. Subir a GitHub

```bash
cd busqueda-terremoto
git init
git add .
git commit -m "Primera versión: avisos de personas y mascotas perdidas"
git branch -M main
git remote add origin https://github.com/Cartica07/TU_REPO.git
git push -u origin main
```

## 4. Desplegar en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New → Project**.
2. Importá el repo que acabás de subir.
3. Framework Preset: **Other** (es un sitio estático, no necesita build command ni output directory).
4. Deploy.

Listo — te va a quedar una URL tipo `https://tu-proyecto.vercel.app`.

## Estructura del proyecto

```
busqueda-terremoto/
├── index.html          → feed principal con filtros
├── crear.html           → formulario para publicar un aviso
├── aviso.html            → detalle de un aviso + chat
├── database.rules.json   → reglas de seguridad de Firebase
├── css/style.css
└── js/
    ├── firebase-config.js  → tus credenciales (completar)
    ├── main.js              → lógica del feed
    ├── crear.js             → lógica del formulario
    └── aviso.js             → lógica del detalle + chat
```

## Posibles mejoras a futuro

- Botón "compartir" por aviso (WhatsApp / copiar link) para que se difundan más rápido.
- Ordenar por ciudad más cercana usando geolocalización.
- Notificación (Firebase Cloud Messaging) al autor cuando le llega un comentario nuevo.
- Moderación básica: reportar un aviso como falso/spam.
