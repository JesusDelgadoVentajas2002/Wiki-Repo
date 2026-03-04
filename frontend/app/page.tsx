"use client";
import { useState } from "react";
import Chat from "./components/Chat";
import Diagrama from "./components/Diagrama";

type Vista = "inicio" | "chat" | "diagrama";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [nombreRepo, setNombreRepo] = useState("");
  const [indexado, setIndexado] = useState(false);
  const [indexando, setIndexando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<Vista>("inicio");

  const handleIndexar = async () => {
    if (!repoUrl || !nombreRepo) return;
    setIndexando(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/indexar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl, nombre: nombreRepo }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setIndexado(true);
      } else {
        setError(data.mensaje);
      }
    } catch {
      setError("No se pudo conectar con el backend. ¿Está corriendo uvicorn?");
    }
    setIndexando(false);
  };

  const volver = () => setVista("inicio");

  // ── PANTALLA: menú principal (tras indexar) ──────────────────────────────
  if (indexado && vista === "inicio") {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-blue-400 mb-2">Wiki-Repo</h1>
            <p className="text-slate-400">Repositorio cargado: <span className="text-blue-300 font-semibold">{nombreRepo}</span></p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Chat */}
            <button
              onClick={() => setVista("chat")}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-xl font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">Chat</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Haz preguntas en lenguaje natural sobre el código. El sistema busca los fragmentos más relevantes y el LLM responde con contexto real del repositorio.
              </p>
            </button>

            {/* Diagramas */}
            <button
              onClick={() => setVista("diagrama")}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-xl font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">Diagramas</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Genera automáticamente diagramas de arquitectura del repositorio. Elige entre diagrama de flujo de datos o diagrama de clases.
              </p>
            </button>
          </div>

          <button
            onClick={() => { setIndexado(false); setRepoUrl(""); setNombreRepo(""); }}
            className="mt-8 w-full text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ← Cambiar repositorio
          </button>
        </div>
      </main>
    );
  }

  // ── PANTALLA: chat ────────────────────────────────────────────────────────
  if (indexado && vista === "chat") {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Barra superior */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800">
          <button onClick={volver} className="text-slate-400 hover:text-slate-100 transition-colors text-sm">
            ← Menú principal
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold">Chat</span>
          <span className="ml-auto text-slate-500 text-sm">{nombreRepo}</span>
        </header>
        <div className="flex-1 overflow-hidden">
          <Chat nombreRepo={nombreRepo} />
        </div>
      </main>
    );
  }

  // ── PANTALLA: diagramas ───────────────────────────────────────────────────
  if (indexado && vista === "diagrama") {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        <header className="flex items-center gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800">
          <button onClick={volver} className="text-slate-400 hover:text-slate-100 transition-colors text-sm">
            ← Menú principal
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold">Diagramas</span>
          <span className="ml-auto text-slate-500 text-sm">{nombreRepo}</span>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <Diagrama nombreRepo={nombreRepo} />
        </div>
      </main>
    );
  }

  // ── PANTALLA: formulario de indexación ────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-blue-400 mb-3">Wiki-Repo</h1>
          <p className="text-slate-400">Analiza cualquier repositorio de GitHub con IA local</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <h2 className="text-lg font-semibold mb-6 text-slate-200">Indexar repositorio</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-slate-400 text-sm mb-1 block">URL del repositorio</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="https://github.com/usuario/repo.git"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                disabled={indexando}
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Nombre (sin espacios)</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="mi-repo"
                value={nombreRepo}
                onChange={e => setNombreRepo(e.target.value)}
                disabled={indexando}
                onKeyDown={e => e.key === "Enter" && handleIndexar()}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {indexando && (
              <p className="text-blue-400 text-sm animate-pulse">
                Clonando y vectorizando el repositorio... esto puede tardar varios minutos.
              </p>
            )}

            <button
              onClick={handleIndexar}
              disabled={indexando || !repoUrl || !nombreRepo}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors mt-2"
            >
              {indexando ? "Indexando..." : "Indexar y continuar →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}