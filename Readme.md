# Fly and Lodget - Proyecto de viajes con MySQL, CRUD e IA

## Configuración incluida

El proyecto mantiene su estructura original:

- `Producto/backend`: servidor Node.js + Express.
- `Producto/frontend`: interfaz web.
- `Producto/database`: scripts SQL.
- `Documentación` y `Gestion`: archivos del proyecto original.

Esta versión queda configurada para:

- MySQL en puerto `3307`.
- Base de datos `viajes_app`.
- Registro e inicio de sesión con usuarios guardados en MySQL.
- Búsqueda inteligente con IA Gemini usando la clave del archivo `.env`.
- CRUD funcional de viajes guardados:
  - Crear: botón `Guardar` desde resultados.
  - Leer: sección `Mis viajes guardados`.
  - Actualizar: botón `Editar`, estado y notas.
  - Eliminar: botón `Quitar`.

## Pasos para ejecutar

Abre una terminal en:

```bash
Producto/backend
```

Instala dependencias si aún no están instaladas:

```bash
npm install
```

Crea/verifica la base de datos y tablas:

```bash
npm run setup-db
```

Inicia el proyecto:

```bash
npm start
```

Luego abre:

```text
http://localhost:3000
```

## Archivo .env

La configuración principal está en `Producto/backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=viajes_app
DB_PORT=3307
GEMINI_API_KEY=clave_configurada
GEMINI_MODEL=gemini-1.5-flash
```

Si tu MySQL tiene contraseña, colócala en `DB_PASSWORD`.

## Rutas de verificación

Base de datos:

```text
http://localhost:3000/api/debug/db
```

IA:

```text
http://localhost:3000/api/debug/ia
```

La ruta de IA no muestra la clave completa, solo confirma si fue detectada.

## Pruebas rápidas para la presentación

1. Crear cuenta desde `Crear cuenta`.
2. Buscar, por ejemplo:

```text
Quiero viajar a Río de Janeiro del 2026-07-10 al 2026-07-17
```

3. Guardar un resultado.
4. Ir a `Mis viajes`.
5. Presionar `Editar`, cambiar estado o nota y guardar.
6. Presionar `Quitar` para eliminarlo.

## Scripts SQL

También puedes crear la base manualmente ejecutando:

1. `Producto/database/script.sql`
2. `Producto/database/datos_prueba.sql`

El backend igualmente intenta crear/verificar la base automáticamente al iniciar.


## Si registro o login indica "No se pudo completar la operación"

Esta versión incluye migraciones automáticas para bases creadas con scripts anteriores. Ejecuta:

```bash
cd Producto/backend
npm install
npm run setup-db
npm start
```

Luego revisa:

```text
http://localhost:3000/api/debug/db
http://localhost:3000/api/debug/schema
```

La tabla `usuarios` puede tener `password_hash` o venir desde el script antiguo con `password`; el backend acepta ambos formatos y actualiza automáticamente los usuarios antiguos al iniciar sesión.


## Versión v4
- Corrección de búsqueda Desde/Hasta: el primer valor se interpreta como origen y el segundo como destino.
- El botón Inicio limpia resultados, destacados y formulario para volver a una pantalla inicial en blanco.
