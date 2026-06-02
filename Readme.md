# Fly and Lodget

Proyecto organizado con la estructura original:

```text
Producto/
├── backend
├── frontend
└── database
```

## Requisitos

- Node.js
- MySQL

## Instalación

1. Crear la base de datos desde MySQL Workbench o consola:

```sql
source Producto/database/script.sql;
source Producto/database/datos_prueba.sql;
```

También puedes abrir ambos archivos en MySQL Workbench y ejecutarlos en orden.

2. Configurar variables:

```bash
cd Producto/backend
copy .env.example .env
```

Edita `.env` con tu usuario y contraseña de MySQL.

3. Instalar dependencias:

```bash
npm install
```

4. Iniciar:

```bash
npm start
```

5. Abrir:

```text
http://localhost:3000
```

## Gemini

La clave `GEMINI_API_KEY` es opcional. Si no existe, el sistema interpreta la búsqueda con reglas locales y sigue funcionando con MySQL.

Ejemplos de búsqueda:

- Quiero viajar a Rio de Janeiro del 2026-07-10 al 2026-07-17
- Santiago a Buenos Aires entre 2026-07-10 y 2026-07-17
- Lima del 2026-08-05 al 2026-08-12
