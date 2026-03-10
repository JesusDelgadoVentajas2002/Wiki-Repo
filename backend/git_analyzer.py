import gc
import git
import os
import shutil
import stat
import time
from llama_index.llms.ollama import Ollama

def forzar_borrado(func, path, exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def borrar_carpeta_temp(ruta: str):
    """Intenta borrar la carpeta hasta 3 veces con pausa entre intentos (Windows libera handles con delay)."""
    for intento in range(3):
        try:
            shutil.rmtree(ruta, onexc=forzar_borrado)
            return
        except Exception:
            if intento < 2:
                time.sleep(1)

def analizar_cambios_recientes(repo_url: str, num_commits: int = 5) -> dict:
    """
    Clona el repo superficialmente (solo los últimos N commits),
    extrae los diffs y pide al LLM que resuma los cambios más relevantes.
    """
    ruta_temp = "./temp_git_analysis"

    if os.path.exists(ruta_temp):
        borrar_carpeta_temp(ruta_temp)

    # ── Clonar superficialmente (solo los últimos N commits) ─────────────────
    print(f"Clonando {repo_url} (depth={num_commits})...")
    repo = None
    try:
        repo = git.Repo.clone_from(repo_url, ruta_temp, depth=num_commits)
    except git.exc.GitCommandError as e:
        msg_lower = str(e).lower()
        if any(k in msg_lower for k in ["not found", "repository", "does not exist", "could not read"]):
            return {
                "status": "error",
                "mensaje": (
                    "No se pudo clonar el repositorio. Comprueba que la URL es correcta "
                    "y que el repositorio existe y es accesible.\n\n"
                    f"Detalle técnico: {str(e)}"
                )
            }
        return {
            "status": "error",
            "mensaje": f"Error de Git al clonar el repositorio: {str(e)}"
        }
    except Exception as e:
        return {
            "status": "error",
            "mensaje": f"Error inesperado al clonar el repositorio: {str(e)}"
        }

    try:
        commits = list(repo.iter_commits(max_count=num_commits))

        # ── Sin commits ──────────────────────────────────────────────────────
        if not commits:
            return {
                "status": "error",
                "mensaje": (
                    "Este repositorio no tiene commits. "
                    "Parece que está vacío o recién inicializado y todavía no se ha hecho ningún commit."
                )
            }

        # ── Construir texto con diffs ────────────────────────────────────────
        MAX_DIFF_CHARS = 2000
        texto_commits = []
        info_commits_frontend = []

        for i, commit in enumerate(commits):
            fecha = commit.committed_datetime.strftime("%Y-%m-%d %H:%M")
            autor = commit.author.name
            mensaje = commit.message.strip()

            info_commits_frontend.append({
                "hash": commit.hexsha[:7],
                "autor": autor,
                "fecha": fecha,
                "mensaje": mensaje
            })

            # En clones superficiales el commit padre puede no existir localmente
            # → intentamos diff, y si falla (bad object) usamos git show como fallback
            # Excluimos archivos de ruido (lock files, binarios) para reducir el tamaño del diff
            EXCLUDE_PATTERNS = [
                "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
                "*.lock", "*.min.js", "*.min.css", "*.map",
            ]
            pathspec_excludes = [f":!{p}" for p in EXCLUDE_PATTERNS]
            try:
                if commit.parents:
                    diff = repo.git.diff(
                        commit.parents[0].hexsha, commit.hexsha,
                        "--", ".", *pathspec_excludes
                    )
                else:
                    diff = repo.git.show(commit.hexsha, "--stat")
            except git.exc.GitCommandError:
                diff = repo.git.show(commit.hexsha, "--stat")

            if len(diff) > MAX_DIFF_CHARS:
                diff = diff[:MAX_DIFF_CHARS] + "\n... [diff truncado] ..."

            texto_commits.append(
                f"--- COMMIT {i+1} ---\n"
                f"Fecha: {fecha} | Autor: {autor}\n"
                f"Mensaje: {mensaje}\n"
                f"Cambios:\n{diff}\n"
            )

        contexto_commits = "\n".join(texto_commits)

        # ── Pedir resumen al LLM ─────────────────────────────────────────────
        llm = Ollama(model="qwen2.5-coder:7b", request_timeout=600.0)

        prompt = f"""Analiza estos {len(commits)} commits recientes de un repositorio de código y genera un resumen claro en español.

Para cada commit explica:
- Qué se cambió exactamente
- Por qué parece importante ese cambio
- Si hay algo destacable (nueva funcionalidad, bug fix, refactor, etc.)

Al final añade un párrafo de resumen general de la evolución reciente del proyecto.

COMMITS:
{contexto_commits}

Resumen:"""

        respuesta = llm.complete(prompt)

        return {
            "status": "ok",
            "num_commits": len(commits),
            "commits": info_commits_frontend,
            "resumen": str(respuesta)
        }

    except git.exc.GitCommandError as e:
        return {
            "status": "error",
            "mensaje": f"Error de Git al leer los commits: {str(e)}"
        }
    except Exception as e:
        return {
            "status": "error",
            "mensaje": f"Error inesperado al analizar el repositorio: {repr(e)}"
        }
    finally:
        # Cerrar el repo explícitamente para liberar los file handles en Windows
        if repo is not None:
            try:
                repo.close()
            except Exception:
                pass
        gc.collect()
        time.sleep(0.5)
        if os.path.exists(ruta_temp):
            borrar_carpeta_temp(ruta_temp)