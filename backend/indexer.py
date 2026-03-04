import os
import shutil
import git
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.core import Settings
import chromadb

# Configurar el modelo de embeddings
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
Settings.llm = None  # El LLM lo usamos solo en el chat, no aquí

def indexar_repositorio(repo_url: str, nombre_repo: str):
    # Clonar el repo en una carpeta temporal
    ruta_temp = f"./temp_{nombre_repo}"
    
    if os.path.exists(ruta_temp):
        shutil.rmtree(ruta_temp)
    
    print(f"Clonando {repo_url}...")
    git.Repo.clone_from(repo_url, ruta_temp)
    print("Clonado correctamente")

    # Leer todos los archivos de texto del repo
    documentos = SimpleDirectoryReader(
        input_dir=ruta_temp,
        recursive=True,
        required_exts=[".py", ".js", ".ts", ".md", ".txt", ".json"]
    ).load_data()
    
    print(f"Archivos leídos: {len(documentos)}")

    # Conectar con ChromaDB
    cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
    coleccion = cliente_chroma.get_or_create_collection(nombre_repo)
    vector_store = ChromaVectorStore(chroma_collection=coleccion)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Indexar y guardar vectores
    print("Indexando... esto puede tardar un momento")
    index = VectorStoreIndex.from_documents(
        documentos,
        storage_context=storage_context,
    )
    
    # Limpiar carpeta temporal
    shutil.rmtree(ruta_temp)
    print(f"Indexación completada. Vectores guardados en chroma_db/{nombre_repo}")
    
    return index