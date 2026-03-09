import git
import os
import shutil
import stat
from llama_index.llms.ollama import Ollama

def forzar_borrado(func, path, exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def analizar_cambios_recientes(repo_url: str, num_commits: int = 5) -> dict:
    """
    Clona el repo, extrae los últimos N commits con sus diffs
    y pide al LLM que resuma los cambios más relevantes.
    """
    ruta_temp = "./temp_git_analysis"

    if os.path.exists(ruta_temp):
        shutil.rmtree(ruta_temp, onexc=forzar_borrado)

    print(f"Clonando {repo_url} para analizar commits...")
    repo = git.Repo.clone_from(repo_url, ruta_temp)

    commits = list(repo.iter_commits(max_count=num_commits))

    if not commits:
        shutil.rmtree(ruta_temp, onexc=forzar_borrado)
        return {"status": "error", "mensaje": "No se encontraron commits en el repositorio"}

    # Construir el texto con los diffs de cada commit
    texto_commits = []
    for i, commit in enumerate(commits):
        fecha = commit.committed_datetime.strftime("%Y-%m-%d %H:%M")
        autor = commit.author.name
        mensaje = commit.message.strip()

        # Obtener el diff con el commit anterior
        if commit.parents:
            diff = repo.git.diff(commit.parents[0].hexsha, commit.hexsha)
        else:
            # Primer commit del repo, diff contra árbol vacío
            diff = repo.git.show(commit.hexsha, "--stat")

        texto_commits.append(
            f"--- COMMIT {i+1} ---\n"
            f"Fecha: {fecha} | Autor: {autor}\n"
            f"Mensaje: {mensaje}\n"
            f"Cambios:\n{diff}\n"
        )

    contexto_commits = "\n".join(texto_commits)

    # Pedir al LLM que resuma
    llm = Ollama(model="qwen2.5-coder:7b", request_timeout=300.0)

    prompt = f"""Analiza estos {num_commits} commits recientes de un repositorio de código y genera un resumen claro en español.

Para cada commit explica:
- Qué se cambió exactamente
- Por qué parece importante ese cambio
- Si hay algo destacable (nueva funcionalidad, bug fix, refactor, etc.)

Al final añade un párrafo de resumen general de la evolución reciente del proyecto.

COMMITS:
{contexto_commits}

Resumen:"""

    respuesta = llm.complete(prompt)

    shutil.rmtree(ruta_temp, onexc=forzar_borrado)

    return {
        "status": "ok",
        "num_commits": len(commits),
        "resumen": str(respuesta)
    }