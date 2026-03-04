import re
import json
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb
from llama_index.llms.ollama import Ollama

MAX_INTENTOS = 3

EJEMPLOS_FEW_SHOT = """
Ejemplo 1 - Diagrama de flujo:
```mermaid
flowchart TD
    A[Usuario] --> B[FastAPI]
    B --> C[ChromaDB]
    B --> D[Ollama LLM]
    C --> E[Vectores]
    D --> F[Respuesta]
```

Ejemplo 2 - Diagrama de clases:
```mermaid
classDiagram
    class APIServer {
        +indexar_repositorio()
        +chat()
    }
    class ChromaDB {
        +guardar_vectores()
        +buscar_similares()
    }
    APIServer --> ChromaDB
```
"""

SYSTEM_PROMPT = f"""Eres un generador de diagramas Mermaid.js experto en arquitectura de software.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con el bloque de código Mermaid, nada más
2. Empieza siempre con ```mermaid y termina con ```
3. PROHIBIDO cualquier texto antes o después del bloque
4. PROHIBIDO usar paréntesis () dentro de las etiquetas de nodos
5. PROHIBIDO usar caracteres especiales como: < > & " en etiquetas
6. Usa solo caracteres alfanuméricos, espacios y guiones en etiquetas
7. Usa flowchart TD para diagramas de flujo y classDiagram para clases

{EJEMPLOS_FEW_SHOT}
"""

def extraer_bloque_mermaid(texto: str) -> str | None:
    """Extrae el código Mermaid de entre las marcas ```mermaid y ```"""
    patron = r"```mermaid\s*(.*?)\s*```"
    match = re.search(patron, texto, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None

def validar_sintaxis_mermaid(codigo: str) -> tuple[bool, str]:
    """Valida la sintaxis básica de Mermaid y devuelve (valido, mensaje_error)"""
    
    if not codigo or len(codigo.strip()) < 10:
        return False, "El diagrama está vacío o es demasiado corto"
    
    lineas = codigo.strip().split('\n')
    primera_linea = lineas[0].strip().lower()
    
    tipos_validos = ['flowchart', 'graph', 'classDiagram', 'sequenceDiagram', 
                     'erDiagram', 'stateDiagram', 'pie', 'gitGraph']
    if not any(primera_linea.startswith(t.lower()) for t in tipos_validos):
        return False, f"La primera línea debe ser un tipo válido de diagrama (flowchart, classDiagram, etc). Encontrado: '{primera_linea}'"
    
    # Verificar que hay al menos una conexión o definición
    tiene_contenido = any('-->' in l or '---' in l or ':' in l for l in lineas[1:])
    if not tiene_contenido:
        return False, "El diagrama no tiene conexiones ni definiciones"
    
    return True, "OK"

def generar_diagrama_con_contexto(nombre_repo: str, tipo: str = "flujo") -> dict:
    """
    Genera un diagrama Mermaid del repositorio usando RAG + LLM con bucle autocorrector.
    tipo puede ser: 'flujo' o 'clases'
    """
    llm = Ollama(model="qwen2.5-coder:7b", request_timeout=600.0)

    # Recuperar contexto del repositorio desde ChromaDB
    cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
    coleccion = cliente_chroma.get_or_create_collection(nombre_repo)
    vector_store = ChromaVectorStore(chroma_collection=coleccion)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    index = VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)

    # Recuperar los fragmentos más relevantes del repo (reducido a 3 para no saturar el prompt)
    retriever = index.as_retriever(similarity_top_k=3)
    if tipo == "clases":
        nodos = retriever.retrieve("clases funciones métodos estructura del código")
    else:
        nodos = retriever.retrieve("arquitectura flujo de datos endpoints API estructura general")

    # Limitar contexto a 2000 caracteres para no saturar el LLM
    contexto = "\n\n".join([n.text for n in nodos])
    contexto = contexto[:2000]

    instruccion = (
        f"Analiza este código y genera un diagrama Mermaid de {'CLASES' if tipo == 'clases' else 'FLUJO DE DATOS'}.\n\n"
        f"CÓDIGO DEL REPOSITORIO:\n{contexto}\n\n"
        f"Genera el diagrama ahora:"
    )

    codigo_mermaid = None
    ultimo_error = None

    for intento in range(1, MAX_INTENTOS + 1):
        print(f"Intento {intento}/{MAX_INTENTOS} de generacion de diagrama...")

        if intento == 1:
            prompt = instruccion
        else:
            # Bucle autocorrector: le pasamos el error al LLM para que lo repare
            prompt = (
                f"El diagrama Mermaid que generaste tiene un error de sintaxis:\n"
                f"ERROR: {ultimo_error}\n\n"
                f"CÓDIGO CON ERROR:\n```mermaid\n{codigo_mermaid}\n```\n\n"
                f"Corrige ÚNICAMENTE el error de sintaxis y devuelve el diagrama completo corregido."
            )

        respuesta = llm.complete(SYSTEM_PROMPT + "\n\n" + prompt)
        texto = str(respuesta)

        codigo_extraido = extraer_bloque_mermaid(texto)

        if not codigo_extraido:
            ultimo_error = "No se encontró bloque ```mermaid``` en la respuesta"
            codigo_mermaid = texto
            continue

        codigo_mermaid = codigo_extraido
        valido, mensaje = validar_sintaxis_mermaid(codigo_mermaid)

        if valido:
            print(f"Diagrama valido generado en intento {intento}")
            return {
                "status": "ok",
                "tipo": tipo,
                "mermaid": codigo_mermaid,
                "intentos": intento
            }
        else:
            ultimo_error = mensaje
            print(f"Error en intento {intento}: {mensaje}")

    # Si agotamos los intentos, devolvemos el último código aunque tenga errores
    return {
        "status": "warning",
        "tipo": tipo,
        "mermaid": codigo_mermaid or "",
        "error": f"No se pudo validar completamente tras {MAX_INTENTOS} intentos: {ultimo_error}",
        "intentos": MAX_INTENTOS
    }