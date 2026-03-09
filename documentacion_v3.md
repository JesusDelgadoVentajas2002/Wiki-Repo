# Documentación v3 — Wiki-Repo

Cambios y novedades respecto a la v2. Para la configuración base (Python, Ollama, Node.js, arranque del sistema) consulta `documentacion_v1.md` y `documentacion_v2.md`.

---

## Nuevo en v3

### 1. Análisis de cambios recientes (`/api/cambios`)

Nueva funcionalidad que clona el repositorio, extrae los últimos N commits con sus diffs y pide al LLM que explique qué cambió, por qué y qué representa cada commit.

**Flujo:**

```
POST /api/cambios  { "url": "https://github.com/...", "num_commits": 5 }
    ↓
Clone superficial del repo (depth=N) → solo los commits necesarios
    ↓
Para cada commit: extrae diff con el padre (o git show si el padre no está disponible)
    ↓
LLM analiza todos los commits y genera un resumen en español
    ↓
{ "status": "ok", "num_commits": N, "commits": [...], "resumen": "..." }
```

**Respuesta:**

| Campo | Descripción |
|---|---|
| `commits` | Array con `hash`, `autor`, `fecha` y `mensaje` de cada commit |
| `resumen` | Texto generado por el LLM explicando qué se cambió y su relevancia |

**Detalles técnicos:**

- Clone superficial (`depth=N`): descarga solo los commits necesarios, no el historial completo → mucho más rápido.
- Si el diff falla porque el commit padre no está en el clone superficial (`bad object`), cae automáticamente a `git show --stat`.
- Limpieza de la carpeta temporal garantizada en el `finally`: `repo.close()` + `gc.collect()` + `sleep(0.5)` para liberar file handles en Windows antes de borrar.
- Diffs individuales truncados a 3000 caracteres para no saturar el contexto del LLM.
- Manejo de errores descriptivo: distingue entre "URL inválida / repo no accesible", "repo sin commits" y errores inesperados.

---

### 2. Filtro de relevancia en el chat

El endpoint `/api/chat` ahora lleva un prompt de sistema personalizado que instruye al LLM sobre qué responder y qué no.

**Comportamiento:**

| Tipo de pregunta | Respuesta |
|---|---|
| Sobre el código, arquitectura, funciones, archivos o dependencias del repo | Responde usando el contexto de ChromaDB |
| Ajena al repositorio (cultura general, preguntas random, etc.) | Redirige educadamente: *"Solo puedo ayudarte con preguntas sobre este repositorio"* |
| Conceptos técnicos generales (buenas prácticas, patrones, etc.) | Los responde — no es excesivamente restrictivo |

**Por qué así:** el LLM usa su propio criterio para juzgar la relevancia. Es más fiable y flexible que cualquier filtro por palabras clave, y el tono del prompt evita que sea exagerado con preguntas legítimas.

---

### 3. Nuevo componente de frontend: `Cambios.tsx`

| Componente | Descripción |
|---|---|
| `app/page.tsx` | Tercer botón en el menú: **"Cambios recientes"**. Tipo `Vista` ampliado con `"cambios"` |
| `app/components/Cambios.tsx` | Selector de commits (slider 1–20, por defecto 5), lista de commits con hash/autor/fecha/mensaje, y bloque con el resumen del LLM |

---

## Archivos modificados en v3

| Archivo | Cambio |
|---|---|
| `backend/git_analyzer.py` | Nuevo — lógica de clone superficial, extracción de diffs y resumen con LLM |
| `backend/api.py` | Nuevo endpoint `POST /api/cambios` + prompt de sistema en `/api/chat` |
| `frontend/app/components/Cambios.tsx` | Nuevo — componente completo de análisis de cambios |
| `frontend/app/page.tsx` | Tercer opción en el menú y pantalla de cambios |

---

## Endpoints disponibles (v3 completo)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Comprueba que el servidor está vivo |
| `POST` | `/api/indexar` | Clona e indexa un repositorio en ChromaDB |
| `POST` | `/api/chat` | Chat con RAG sobre el código indexado (con filtro de relevancia) |
| `POST` | `/api/diagrama` | Genera un diagrama Mermaid del repositorio |
| `POST` | `/api/cambios` | Analiza los últimos N commits con el LLM |