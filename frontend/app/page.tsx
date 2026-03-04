"use client";
import { useState } from "react";
import Chat from "./components/Chat";
import Diagrama from "./components/Diagrama";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [nombreRepo, setNombreRepo] = useState("");
  const [indexado, setIndexado] = useState(false);
  const [indexando, setIndexando] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"chat" | "diagrama">("chat");

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

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">Wiki-Repo</h1>
          <p className="text-slate-400">Analizador de Repositorios</p>
        </div>

        {/* Formulario de indexación */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 text-slate-200">Repositorio</h2>
          <div className="flex flex-col gap-3">
            <input
              className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              placeholder="https://github.com/usuario/repo.git"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              disabled={indexando || indexado}
            />
            <div className="flex gap-3">
              <input
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="nombre-del-repo"
                value={nombreRepo}
                onChange={e => setNombreRepo(e.target.value)}
                disabled={indexando || indexado}
              />
              <button
                onClick={handleIndexar}
                disabled={indexando || indexado || !repoUrl || !nombreRepo}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {indexando ? "Indexando..." : indexado ? "✓ Indexado" : "Indexar"}
              </button>
              {indexado && (
                <button
                  onClick={() => { setIndexado(false); setRepoUrl(""); setNombreRepo(""); }}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Nuevo
                </button>
              )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {indexando && (
              <p className="text-blue-400 text-sm animate-pulse">
                Clonando y vectorizando el repositorio... esto puede tardar varios minutos.
              </p>
            )}
          </div>
        </div>

        {/* Tabs Chat / Diagrama */}
        {indexado && (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab("chat")}
                className={`px-5 py-2 rounded-lg font-semibold transition-colors ${tab === "chat" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
              >
                Chat
              </button>
              <button
                onClick={() => setTab("diagrama")}
                className={`px-5 py-2 rounded-lg font-semibold transition-colors ${tab === "diagrama" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
              >
                Diagramas
              </button>
            </div>

            {tab === "chat" && <Chat nombreRepo={nombreRepo} />}
            {tab === "diagrama" && <Diagrama nombreRepo={nombreRepo} />}
          </>
        )}
      </div>
    </main>
  );
}