import os
import shutil
import stat
import git
import chromadb
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext
from llama_index.core.node_parser import CodeSplitter
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.core import Settings

Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")

# Mapeo de extensiones a lenguajes soportados por tree-sitter
LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
}

EXTENSIONES_TEXTO = [".py", ".js", ".ts", ".tsx", ".md", ".txt", ".json"]

def forzar_borrado(func, path, exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def obtener_splitter(extension: str):
    """Devuelve el splitter adecuado según la extensión del archivo."""
    lenguaje = LANGUAGE_MAP.get(extension)
    if lenguaje:
        try:
            return CodeSplitter(
                language=lenguaje,
                chunk_lines=40,        # líneas por fragmento
                chunk_lines_overlap=5, # solapamiento entre fragmentos
                max_chars=1500,        # límite de caracteres por fragmento
            )
        except Exception:
            pass
    # Fallback para .md, .txt, .json y cualquier otro
    from llama_index.core.node_parser import SentenceSplitter
    return SentenceSplitter(chunk_size=512, chunk_overlap=50)

def indexar_repositorio(repo_url: str, nombre_repo: str):
    ruta_temp = f"./temp_{nombre_repo}"

    # Limpiar si ya existe de una ejecución anterior
    if os.path.exists(ruta_temp):
        shutil.rmtree(ruta_temp, onexc=forzar_borrado)

    print(f"Clonando {repo_url}...")
    git.Repo.clone_from(repo_url, ruta_temp)
    print("Clonado correctamente")

    # Leer archivos agrupados por extensión para aplicar el splitter correcto
    todos_los_nodos = []

    for extension in EXTENSIONES_TEXTO:
        try:
            documentos = SimpleDirectoryReader(
                input_dir=ruta_temp,
                recursive=True,
                required_exts=[extension]
            ).load_data()
        except Exception:
            continue

        if not documentos:
            continue

        print(f"  {extension}: {len(documentos)} archivos encontrados")

        splitter = obtener_splitter(extension)

        # Enriquecer cada fragmento con metadatos de contexto
        nodos = splitter.get_nodes_from_documents(documentos)
        for nodo in nodos:
            # Inyectar ruta del archivo como contexto en el fragmento
            ruta_relativa = nodo.metadata.get("file_path", "")
            if ruta_relativa:
                nodo.text = f"# Archivo: {ruta_relativa}\n{nodo.text}"

        todos_los_nodos.extend(nodos)
        print(f"  {extension}: {len(nodos)} fragmentos generados con AST")

    print(f"\nTotal fragmentos a indexar: {len(todos_los_nodos)}")

    # Conectar ChromaDB y persistir vectores
    cliente_chroma = chromadb.PersistentClient(path="./chroma_db")
    
    # Borrar colección anterior si existe para re-indexar limpio
    try:
        cliente_chroma.delete_collection(nombre_repo)
        print(f"Coleccion anterior '{nombre_repo}' eliminada para re-indexar")
    except Exception:
        pass

    coleccion = cliente_chroma.get_or_create_collection(nombre_repo)
    vector_store = ChromaVectorStore(chroma_collection=coleccion)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    print("Indexando con embeddings... esto puede tardar un momento")
    VectorStoreIndex(
        todos_los_nodos,
        storage_context=storage_context,
    )

    # Limpiar carpeta temporal
    shutil.rmtree(ruta_temp, onexc=forzar_borrado)
    print(f"Indexacion completada. Vectores guardados en chroma_db/{nombre_repo}")