# Documentación v1 — Wiki-Repo

Sistema de indexación y consulta de repositorios de GitHub usando LLMs locales (Ollama) y ChromaDB.

---

## Requisitos previos

- Python 3.12
- [Ollama](https://ollama.com) instalado
- Git

---

## Paso 1 — Configurar Python 3.12 como `python` en PowerShell

```powershell
if (!(Test-Path $PROFILE)) { New-Item -Path $PROFILE -ItemType File -Force }; Add-Content $PROFILE "`nSet-Alias python312 'C:\Users\EM2025008077\AppData\Local\Programs\Python\Python312\python.exe'"; Add-Content $PROFILE "`nfunction python { & 'C:\Users\EM2025008077\AppData\Local\Programs\Python\Python312\python.exe' @args }"
```

> **En otra máquina:** localiza la ruta de tu Python 3.12 con:
> ```powershell
> py -3.12 -c "import sys; print(sys.executable)"
> ```
> y reemplaza la ruta en el comando anterior.

---

## Paso 2 — Instalar Ollama y añadirlo al PATH

```powershell
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:LOCALAPPDATA\Programs\Ollama", "User")
```

---

## Paso 3 — Descargar los modelos

```powershell
# Modelo generativo (el que responde)
ollama pull qwen2.5-coder:7b

# Modelo de embeddings (el que indexa)
ollama pull nomic-embed-text
```

---

## Paso 4 — Instalar dependencias

```powershell
pip install fastapi uvicorn llama-index llama-index-vector-stores-chroma llama-index-embeddings-ollama llama-index-llms-ollama chromadb gitpython
```

---

## Paso 5 — Arrancar el servidor

Desde `wiki-repo/backend`:

```powershell
cd backend
uvicorn api:app --reload --port 8000
```

El servidor estará en `http://127.0.0.1:8000`. Deja esta terminal abierta.

---

## Paso 6 — Usar la API

### Opción A — Desde PowerShell (otra terminal)

**Indexar un repo:**
```powershell
$r = Invoke-RestMethod -Uri "http://localhost:8000/api/indexar" -Method POST -ContentType "application/json" -Body '{"url": "https://github.com/JesusDelgadoVentajas2002/Finanzas.git", "nombre": "finanzas"}'
$r
```

**Hacer una pregunta:**
```powershell
$body = '{"nombre_repo": "finanzas", "pregunta": "What does this repository do?"}'
$c = Invoke-RestMethod -Uri "http://localhost:8000/api/chat" -Method POST -ContentType "application/json" -Body $body
$c.respuesta
```

> ⚠️ Evita tildes y `¿` en las preguntas desde PowerShell — usa inglés o español sin caracteres especiales.

---

### Opción B — Desde el navegador (Swagger UI)

Abre `http://127.0.0.1:8000/docs`

**Indexar:**
1. `POST /api/indexar` → **Try it out** → pega en el body → **Execute**
```json
{
  "url": "https://github.com/JesusDelgadoVentajas2002/Finanzas.git",
  "nombre": "finanzas"
}
```
Espera a que la terminal de uvicorn diga `Indexación completada` (2-3 min).

**Preguntar:**
2. `POST /api/chat` → **Try it out** → pega en el body → **Execute**
```json
{
  "nombre_repo": "finanzas",
  "pregunta": "What does this repository do?"
}
```

> ⚠️ El `nombre_repo` debe ser **exactamente igual** al `nombre` usado al indexar.

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Comprueba que el servidor está vivo |
| `POST` | `/api/indexar` | Clona e indexa un repositorio |
| `POST` | `/api/chat` | Hace una pregunta sobre un repo indexado |

---

## Carpetas generadas automáticamente

| Carpeta | Descripción |
|---------|-------------|
| `chroma_db/` | Base de datos vectorial. **No borrar** — es el cerebro del sistema |
| `temp_<nombre>/` | Carpeta temporal del clonado. Se borra sola al terminar. Si persiste, puedes borrarla manualmente |

---

## Comportamiento del sistema

- Si indexas el **mismo repo dos veces**, ChromaDB actualiza la colección existente (no duplica).
- La carpeta `temp_` se crea, usa y borra automáticamente en cada indexación.
- `chroma_db/` crece y persiste entre ejecuciones.
