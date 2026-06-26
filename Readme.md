<p align="center">
  <img src="Producto/frontend/assets/flyandlodget-logo.png" alt="Logo Flyandlodget" width="220">
</p>

# Flyandlodget

**Tu viaje, todo en un solo lugar.**

Flyandlodget es una aplicación web orientada a la búsqueda, comparación y gestión de alternativas de viaje. La plataforma permite que una persona describa su viaje en lenguaje natural —incluyendo origen, destino, fechas, cantidad de pasajeros, duración, presupuesto y preferencias— para obtener opciones de **vuelos y alojamientos** presentadas de forma clara y separada.

El proyecto fue desarrollado con fines académicos y está preparado para publicarse como repositorio público en GitHub.

## Problema que aborda

Planificar un viaje normalmente obliga a consultar diferentes sitios, comparar precios manualmente y calcular si el costo total de vuelo y alojamiento se mantiene dentro del presupuesto disponible. Esto aumenta el tiempo de búsqueda y puede provocar decisiones basadas en información incompleta.

## Propuesta de solución

Flyandlodget centraliza el proceso en una sola interfaz:

1. El usuario describe el viaje que necesita.
2. El sistema interpreta la solicitud y detecta sus condiciones principales.
3. Se realizan búsquedas web independientes para vuelos y alojamientos.
4. Los resultados se organizan y comparan.
5. Solo se presentan alternativas cuyo total verificable respeta el presupuesto máximo indicado.
6. El usuario puede guardar, consultar, actualizar y eliminar sus opciones de viaje.

La base de datos **no se usa para buscar ofertas**. MySQL se utiliza exclusivamente para almacenar usuarios, fuentes consultadas, resultados y viajes guardados.

## Funcionalidades principales

- Registro e inicio de sesión de usuarios.
- Validación de nombre, correo y contraseña en frontend y backend.
- Control de correos electrónicos duplicados.
- Contraseñas protegidas mediante `bcrypt`.
- Edición de perfil y cambio seguro de contraseña.
- Interpretación de solicitudes escritas en lenguaje natural.
- Búsqueda web independiente de vuelos y alojamientos.
- Presentación separada de proveedores de vuelos y alojamientos.
- Recomendación de aeropuerto comercial cuando el destino no cuenta con uno propio.
- Presupuesto total tratado como límite máximo estricto.
- Exclusión de alternativas que superen el presupuesto o no permitan verificar su costo.
- Visualización de proveedores, precios referenciales y enlaces de origen.
- Guardado de alternativas seleccionadas.
- CRUD de viajes guardados: crear, consultar, actualizar y eliminar.
- Corrección del resumen para priorizar siempre el destino escrito por el usuario.
- Interfaz responsiva con identidad visual Flyandlodget.

## Tecnologías utilizadas

### Frontend

- HTML5
- CSS3
- JavaScript
- Diseño responsivo

### Backend

- Node.js
- Express
- API REST
- JSON Web Token (`jsonwebtoken`)
- `bcryptjs`
- `mysql2`
- `dotenv`

### Búsqueda y procesamiento

- **Tavily:** obtiene información web y enlaces de referencia para vuelos y alojamientos.
- **Ollama:** ejecuta localmente el modelo de análisis configurado.
- **Qwen3 8B:** modelo recomendado en la configuración incluida.

### Base de datos

- MySQL
- Base de datos: `viajes_app`
- Puerto configurado: `3307`

## Arquitectura general

```text
Usuario
  │
  ▼
Frontend: HTML + CSS + JavaScript
  │ solicitudes HTTP
  ▼
Backend: Node.js + Express
  ├── Autenticación y perfiles
  ├── Interpretación de la solicitud
  ├── Búsqueda web de vuelos
  ├── Búsqueda web de alojamientos
  ├── Validación estricta del presupuesto
  └── CRUD de viajes guardados
       │
       ├────────► Tavily: resultados y enlaces web
       ├────────► Ollama/Qwen3: análisis local
       └────────► MySQL: almacenamiento
```

## Estructura del repositorio

```text
proyecto-viajes/
├── Producto/
│   ├── backend/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── initDatabase.js
│   │   ├── package.json
│   │   └── .env.example
│   ├── frontend/
│   │   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   └── index.html
│   └── database/
│       ├── script.sql
│       └── datos_prueba.sql
├── Documentacion/
├── Gestion/
├── .gitignore
├── INICIAR-WINDOWS.bat
├── iniciar-mac-linux.sh
└── README.md
```

## Equipo del proyecto

El trabajo se desarrolló de manera colaborativa, incluyendo análisis, implementación, pruebas, documentación y presentación del sistema.

| Integrante | Rol dentro del proyecto | Participación |
|---|---|---|
| Javier Alejandro Aliaga Moreno | Integrante del equipo de desarrollo | Análisis, desarrollo, pruebas y documentación |
| Javiera Paz Apablaza Lorca | Integrante del equipo de desarrollo | Análisis, desarrollo, pruebas y documentación |

## Requisitos

- Node.js 18 o superior.
- npm.
- MySQL activo en el puerto `3307`.
- Ollama instalado y en ejecución.
- Modelo `qwen3:8b` descargado, o un modelo compatible configurado.
- Clave de Tavily con cuota disponible.

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Vermmonts/proyecto-viajes.git
cd proyecto-viajes/Producto/backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear la configuración local

Copia el archivo de ejemplo:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux o macOS**

```bash
cp .env.example .env
```

Luego edita `Producto/backend/.env`:

```env
PORT=3000

DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=viajes_app
DB_PORT=3307

JWT_SECRET=coloca_una_clave_segura

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=900000
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=1800
OLLAMA_KEEP_ALIVE=15m
OLLAMA_THINK=false

TAVILY_API_KEY=pega_aqui_tu_clave_tavily
TAVILY_SEARCH_DEPTH=basic
TAVILY_MAX_RESULTS=6
TAVILY_TIMEOUT_MS=90000
```

> El archivo `.env` contiene información privada y está excluido mediante `.gitignore`. No debe subirse a GitHub.

### 4. Preparar Ollama

```bash
ollama pull qwen3:8b
```

Si Ollama no se inicia automáticamente:

```bash
ollama serve
```

Verifica el modelo:

```bash
ollama list
```

### 5. Preparar MySQL

Asegúrate de que MySQL esté funcionando en `127.0.0.1:3307` y ejecuta:

```bash
npm run setup-db
```

Este comando crea o actualiza la base de datos y sus tablas sin eliminar los datos existentes.

### 6. Iniciar la aplicación

```bash
npm start
```

Abre en el navegador:

```text
http://localhost:3000
```

## Uso básico

Una solicitud de ejemplo es:

```text
Tengo $500.000 para vuelo y alojamiento. Quiero viajar desde Santiago a Lima por cuatro noches y no deseo superar ese presupuesto.
```

El sistema debe:

1. Mostrar **Lima** como destino en el resumen.
2. Buscar referencias de vuelos.
3. Buscar referencias de alojamientos.
4. Comparar los resultados.
5. Descartar cualquier alternativa que supere los `$500.000`.
6. Permitir guardar una opción válida en la cuenta del usuario.

## Rutas principales de la API

| Método | Ruta | Función |
|---|---|---|
| `POST` | `/api/auth/registro` | Registrar usuario |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `GET` | `/api/auth/perfil` | Consultar perfil autenticado |
| `PUT` | `/api/auth/perfil` | Actualizar nombre o contraseña |
| `POST` | `/api/buscar` | Buscar vuelos y alojamientos |
| `GET` | `/api/mis-viajes` | Listar viajes guardados |
| `POST` | `/api/mis-viajes` | Guardar una alternativa |
| `PUT` | `/api/mis-viajes/:id` | Actualizar una reserva |
| `DELETE` | `/api/mis-viajes/:id` | Eliminar una reserva |

## Verificación técnica

Con la aplicación iniciada:

- Base de datos: `http://localhost:3000/api/debug/db`
- Esquema: `http://localhost:3000/api/debug/schema`
- Configuración de búsqueda: `http://localhost:3000/api/debug/ia`

## Seguridad

- El correo se normaliza en minúsculas.
- La base impide cuentas duplicadas por correo.
- Las contraseñas deben cumplir requisitos de seguridad.
- Las contraseñas se almacenan mediante hash.
- El cambio de contraseña exige validar la contraseña actual.
- Las rutas personales requieren autenticación.
- `.env`, `node_modules`, archivos de registro y archivos temporales no se publican.
- La clave de Tavily se utiliza únicamente desde el backend.

## Alcances y limitaciones

- Los precios obtenidos desde internet son referenciales y deben confirmarse en el sitio del proveedor.
- La aplicación no compra ni reserva directamente vuelos o alojamientos.
- La disponibilidad depende de las fuentes consultadas y de la cuota de Tavily.
- El tiempo de respuesta depende del rendimiento del equipo que ejecuta Ollama.
- La búsqueda contempla vuelos y alojamientos; no calcula traslados terrestres.

## Solución de problemas

### Ollama no responde

```bash
ollama serve
ollama list
```

Si el modelo no está instalado:

```bash
ollama pull qwen3:8b
```

En equipos con menos memoria puede configurarse un modelo más pequeño en `.env`.

### Tavily no devuelve resultados

- Revisa `TAVILY_API_KEY`.
- Confirma que la cuenta tenga créditos disponibles.
- Revisa la conexión a internet.

### MySQL no conecta

Confirma que:

- El servicio esté iniciado.
- El puerto sea `3307`.
- El usuario, contraseña y nombre de base coincidan con `.env`.

## Estado del proyecto

Versión final académica basada en la versión 18 del sistema, con:

- vuelos y alojamientos por separado;
- validaciones completas de usuarios;
- búsqueda web robusta;
- presupuesto máximo estricto;
- edición de perfil;
- destino explícito correctamente reflejado en el resumen.

## Uso académico

Proyecto desarrollado con fines académicos. El código puede ser revisado y evaluado desde un repositorio público, siempre que no se publiquen credenciales privadas.
