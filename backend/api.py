from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama
import chromadb
from backend.indexer import indexar_repositorio

app = FastAPI()

# Permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar modelos
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
Settings.llm = Ollama(model="qwen2.5-coder:7b", request_timeout=300.0)

# Modelos de datos
class RepoRequest(BaseModel):
    url: str
    nombre: str

class ChatRequest(BaseModel):
    nombre_repo: str
    pregunta: str

@app.post("/api/indexar")
async def indexar(request: RepoRequest):
    try:
        indexar_repositorio(request.url, request.nombre)
        return {"status": "ok", "mensaje": f"Repositorio {request.nombre} indexado correctamente"}
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Cargar el índice ya existente de ChromaDB
        cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
        coleccion = cliente_chroma.get_or_create_collection(request.nombre_repo)
        vector_store = ChromaVectorStore(chroma_collection=coleccion)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        
        index = VectorStoreIndex.from_vector_store(
            vector_store,
            storage_context=storage_context
        )

        # Crear motor de consulta con top-k=4
        motor = index.as_query_engine(similarity_top_k=4)
        
        # Obtener respuesta
        respuesta = motor.query(request.pregunta)
        
        return {
            "status": "ok",
            "respuesta": str(respuesta)
        }
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}

@app.get("/")
async def root():
    return {"mensaje": "Wiki-Repo API funcionando"}


# Con estos dos archivos creados, arranca el servidor con:
# uvicorn backend.api:app --reload --port 8000
