# Fly and Lodget — Ollama + Tavily + MySQL

Aplicación de viajes con registro e inicio de sesión, búsqueda web mediante Tavily, análisis local con Ollama y CRUD de viajes guardados.

## Arquitectura

- **Tavily:** busca información actual en internet y devuelve enlaces.
- **Ollama:** interpreta la solicitud y compara los resultados localmente, sin costo por consulta de IA.
- **MySQL:** se utiliza únicamente para usuarios, historial, fuentes, resultados y viajes guardados. No se consulta para encontrar vuelos u hoteles.

## Requisitos

- Node.js 18 o superior.
- MySQL funcionando en el puerto 3307.
- Ollama instalado.
- Una clave gratuita de Tavily.

## 1. Preparar Ollama

Instala Ollama y descarga el modelo:

```powershell
ollama pull qwen2.5:7b
```

Comprueba que está disponible:

```powershell
ollama list
```

Normalmente Ollama se inicia automáticamente. Si no está activo:

```powershell
ollama serve
```

## 2. Configurar Tavily

Obtén una clave en Tavily y abre:

```text
Producto/backend/.env
```

Pega la clave aquí:

```env
TAVILY_API_KEY=pega_aqui_tu_clave_tavily
```

La configuración completa incluida es:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=viajes_app
DB_PORT=3307
JWT_SECRET=cambia_esta_clave_en_produccion
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
TAVILY_API_KEY=pega_aqui_tu_clave_tavily
TAVILY_SEARCH_DEPTH=advanced
TAVILY_MAX_RESULTS=10
```

## 3. Iniciar la aplicación

```powershell
cd Producto/backend
npm install
npm run setup-db
npm start
```

Abre:

```text
http://localhost:3000
```

## Funcionamiento de una búsqueda

1. Ollama interpreta origen, destino, presupuesto, fechas, pasajeros y preferencias.
2. El backend construye una consulta web.
3. Tavily busca resultados actuales y entrega URLs.
4. Ollama compara los resultados y selecciona la **Mejor opción**.
5. Si el destino no tiene aeropuerto, propone el aeropuerto práctico más cercano y el traslado final.
6. El backend guarda fuentes y resultados en MySQL.

Los precios obtenidos en internet son referenciales y deben confirmarse en el sitio del proveedor.

## Verificación

- Base de datos: `http://localhost:3000/api/debug/db`
- Estructura: `http://localhost:3000/api/debug/schema`
- Ollama y Tavily: `http://localhost:3000/api/debug/ia`

## Solución de problemas

### Ollama no responde

```powershell
ollama serve
ollama list
```

Si falta el modelo:

```powershell
ollama pull qwen2.5:7b
```

### El computador tiene poca memoria

Usa un modelo más pequeño:

```powershell
ollama pull llama3.2:3b
```

Y cambia:

```env
OLLAMA_MODEL=llama3.2:3b
```

### Tavily rechaza la consulta

Revisa que `TAVILY_API_KEY` sea correcta y que el plan gratuito tenga créditos disponibles.

## Seguridad

`.env` y `node_modules` están ignorados por Git. No subas la clave de Tavily a GitHub.

## Estabilidad de búsquedas prolongadas

La conexión local utiliza los módulos HTTP nativos de Node.js para evitar el error `UND_ERR_HEADERS_TIMEOUT` que puede producir el `fetch` integrado durante respuestas largas. La configuración recomendada es:

```env
OLLAMA_TIMEOUT_MS=900000
OLLAMA_NUM_CTX=4096
OLLAMA_KEEP_ALIVE=15m
OLLAMA_THINK=false
TAVILY_SEARCH_DEPTH=basic
TAVILY_MAX_RESULTS=6
```

Si el análisis local demora demasiado, la aplicación mantiene la búsqueda web y muestra una comparación básica basada en las fuentes encontradas, en lugar de interrumpir toda la operación.
