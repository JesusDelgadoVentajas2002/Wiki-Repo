# Documentación v2 — Wiki-Repo

Cambios y novedades respecto a la v1. Para la configuración base (Python, Ollama, modelos, pip) consulta `documentacion_v1.md`.

---

## Nuevo en v2: Node.js

Las nuevas funcionalidades requieren Node.js. Descarga los binarios desde [https://nodejs.org](https://nodejs.org) y descomprime en `C:\Users\EM2025008077\node\`.

```powershell
# Añadir al PATH en esta sesión
$env:Path += ";C:\Users\EM2025008077\node\node-v24.14.0-win-x64"

# Hacer el cambio permanente
[System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\EM2025008077\node\node-v24.14.0-win-x64", "User")

# Verificación
node --version
npm.cmd --version
```

> ⚠️ Usar `npm.cmd` en vez de `npm` — PowerShell bloquea `npm.ps1` por política de seguridad.

---

## Arranque del sistema completo

```powershell
# Terminal 1 — Backend (igual que en v1)
cd wiki-repo\backend
uvicorn api:app --port 8000

# Terminal 2 — Frontend (nuevo en v2)
cd wiki-repo\frontend
npm.cmd install   # solo la primera vez
npm.cmd run dev
# Abre http://localhost:3000
```

---

## Cambios respecto a v1

### 1. AST Chunking con tree-sitter

**Qué cambia:** la fragmentación ya no corta el código cada 400-512 caracteres sino que usa análisis sintáctico real con `tree-sitter`, respetando clases y funciones completas.

**Por qué:** antes era como cortar un libro por número de páginas sin respetar capítulos — podía partir una función por la mitad y perder contexto en los bordes.

| Extensión | Parser |
|---|---|
| `.py` | `tree-sitter-python` |
| `.js` | `tree-sitter-javascript` |
| `.ts` / `.tsx` | `tree-sitter-typescript` |
| `.md`, `.txt`, `.json` | `SentenceSplitter` (fallback) |

Configuración: 40 líneas por fragmento, 5 de solapamiento, máx. 1500 caracteres. Cada fragmento lleva la ruta del archivo como metadato.

---

### 2. Streaming SSE en `/api/chat`

**Qué cambia:** el chat ahora emite la respuesta token a token en lugar de esperar a que el LLM termine de generar todo.

**Por qué:** en v1 el servidor acumulaba la respuesta entera en memoria y la mandaba de golpe, causando esperas de varios minutos sin feedback visual.

Formato del stream:
```
data: {"token": "Este"}
data: {"token": " repositorio"}
data: {"token": "", "fin": true}
```

---

### 3. Generación de diagramas Mermaid (`/api/diagrama`)

Nuevo endpoint que genera diagramas de arquitectura visual con bucle autocorrector.

```
POST /api/diagrama  {"nombre_repo": "mi-repo", "tipo": "flujo"}
    ↓
ChromaDB → 3 fragmentos más similares a la arquitectura del repo (máx. 2000 chars)
    ↓
LLM genera diagrama Mermaid
    ↓
Validador: si falla sintaxis → reintenta hasta 3 veces con el error como contexto
    ↓
{"status": "ok", "mermaid": "flowchart TD ..."}
```

Tipos: `"flujo"` (flowchart TD) · `"clases"` (classDiagram)

---

### 4. Frontend en Next.js

Interfaz gráfica en `http://localhost:3000` que sustituye los comandos de PowerShell.

| Componente | Descripción |
|---|---|
| `app/page.tsx` | Formulario de indexación + tabs Chat / Diagramas |
| `app/components/Chat.tsx` | Chat con streaming token a token |
| `app/components/Diagrama.tsx` | Generador y renderizador Mermaid en el navegador |
