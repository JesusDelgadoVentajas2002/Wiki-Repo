# 1. IMPORTS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
from diagramas import generar_diagrama_con_contexto
import chromadb
import json
import asyncio
from indexer import indexar_repositorio


# 2. SET-UP INICIAL.
# 2.1. CREA LA APP FASTAPI
# 2.2. AÑADE CORS, PARA QUE EL BACKEND PUEDA HABLAR CON EL FRONTED SIN SER BLOQUEADO POR EL NAVEGADOR
# 2.3. CONFIGURA GLOBALMENTE LOS DOS MODELOS QUE USARÁ LLAMAINDEX: EL DE EMBEDDING Y EL DE LLM
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# VALIDA QUE LAS PETICIONES LLEGUEN CON LOS CAMPOS Y TIPOS CORRECTOS
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
Settings.llm = Ollama(model="qwen2.5-coder:7b", request_timeout=300.0)


# 3. MODELOS DE DATOS
# FastAPI utiliza pydantic para validar los datos que llegan en las peticiones. Si llega una peticion sin url o con un tipo incorrecto,
# FastAPI devolverá un error 422
class RepoRequest(BaseModel):
    url: str
    nombre: str

class ChatRequest(BaseModel):
    nombre_repo: str
    pregunta: str


# 4. ENDPOINT INDEXAR
# "Un endpoint es una ruta que recibe una peticion y devuelve una respuesta."
# Esto llama a indexar_repositorio() en un hilo separado para no bloquear la respuesta.
@app.post("/api/indexar")
async def indexar(request: RepoRequest):
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, indexar_repositorio, request.url, request.nombre
        )
        return {"status": "ok", "mensaje": f"Repositorio {request.nombre} indexado correctamente"}
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}


# 5. ENDPOINT CHAT
# "Un endpoint es una ruta que recibe una peticion y devuelve una respuesta."
# Este endpoint recibe una peticion con el nombre del repositorio y la pregunta del usuario.
# Llama a chat_repositorio() en un hilo separado para no bloquear la respuesta.
@app.post("/api/chat")
async def chat(request: ChatRequest):
    async def generar_stream():
        try:
            # Cargar índice desde ChromaDB
            cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
            coleccion = cliente_chroma.get_or_create_collection(request.nombre_repo)
            vector_store = ChromaVectorStore(chroma_collection=coleccion)
            storage_context = StorageContext.from_defaults(vector_store=vector_store)

            index = VectorStoreIndex.from_vector_store(
                vector_store,
                storage_context=storage_context
            )

            # Motor de consulta con streaming activado
            motor = index.as_query_engine(
                similarity_top_k=4,
                streaming=True
            )

            # Obtener respuesta en streaming
            respuesta = motor.query(request.pregunta)

            # Emitir cada token según llega
            for token in respuesta.response_gen:
                dato = json.dumps({"token": token})
                yield f"data: {dato}\n\n"

            # Señal de fin de stream
            yield f"data: {json.dumps({'token': '', 'fin': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generar_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# 6. ENDPOINT DIAGRAMA
# "Un endpoint es una ruta que recibe una peticion y devuelve una respuesta."
# Este endpoint recibe una peticion con el nombre del repositorio y el tipo de diagrama.
# Llama a generar_diagrama_con_contexto() en un hilo separado para no bloquear la respuesta.

class DiagramaRequest(BaseModel):
    nombre_repo: str
    tipo: str = "flujo"  # "flujo" o "clases"

@app.post("/api/diagrama")
async def diagrama(request: DiagramaRequest):
    try:
        resultado = await asyncio.get_event_loop().run_in_executor(
            None, generar_diagrama_con_contexto, request.nombre_repo, request.tipo
        )
        return resultado
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}









from git_analyzer import analizar_cambios_recientes

class CambiosRequest(BaseModel):
    url: str
    num_commits: int = 5

@app.post("/api/cambios")
async def cambios(request: CambiosRequest):
    try:
        resultado = await asyncio.get_event_loop().run_in_executor(
            None, analizar_cambios_recientes, request.url, request.num_commits
        )
        return resultado
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}



# 7. CHEQUEO DE QUE NO HA HABIDO ERRORES
@app.get("/")
async def root():
    return {"mensaje": "Wiki-Repo API funcionando"}