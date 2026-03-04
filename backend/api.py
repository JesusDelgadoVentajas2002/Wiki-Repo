from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
import chromadb
import json
import asyncio
from indexer import indexar_repositorio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
Settings.llm = Ollama(model="qwen2.5-coder:7b", request_timeout=300.0)

class RepoRequest(BaseModel):
    url: str
    nombre: str

class ChatRequest(BaseModel):
    nombre_repo: str
    pregunta: str

@app.post("/api/indexar")
async def indexar(request: RepoRequest):
    try:
        await asyncio.get_event_loop().run_in_executor(
            None, indexar_repositorio, request.url, request.nombre
        )
        return {"status": "ok", "mensaje": f"Repositorio {request.nombre} indexado correctamente"}
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}

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

@app.get("/")
async def root():
    return {"mensaje": "Wiki-Repo API funcionando"}