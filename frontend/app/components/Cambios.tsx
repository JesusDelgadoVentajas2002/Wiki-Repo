"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CommitInfo {
    hash: string;
    autor: string;
    fecha: string;
    mensaje: string;
}

interface CambiosResult {
    status: string;
    num_commits: number;
    commits: CommitInfo[];
    resumen: string;
}

export default function Cambios({ repoUrl }: { repoUrl: string }) {
    const [numCommits, setNumCommits] = useState(5);
    const [resultado, setResultado] = useState<CambiosResult | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");

    const analizar = async () => {
        setCargando(true);
        setError("");
        setResultado(null);
        try {
            const res = await fetch("http://localhost:8000/api/cambios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: repoUrl, num_commits: numCommits }),
            });
            const data = await res.json();
            if (data.status === "ok") {
                setResultado(data);
            } else {
                const msg = data.mensaje || data.error || data.detail;
                setError(msg
                    ? msg
                    : `El servidor devolvió una respuesta inesperada:\n${JSON.stringify(data, null, 2)}`
                );
            }
        } catch {
            setError("No se pudo conectar con el backend.");
        }
        setCargando(false);
    };

    // ── Estado inicial: selector ───────────────────────────────────────────
    if (!cargando && !resultado) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-2xl font-semibold text-slate-100 mb-2">Analizar cambios recientes</h2>
                    <p className="text-slate-400 text-sm">
                        El LLM leerá los últimos commits del repositorio y generará un resumen detallado de qué ha cambiado y por qué.
                    </p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col gap-6">
                    <div>
                        <label className="text-slate-300 text-sm font-medium block mb-3">
                            Número de commits a analizar: <span className="text-blue-400 font-bold">{numCommits}</span>
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={20}
                            value={numCommits}
                            onChange={e => setNumCommits(Number(e.target.value))}
                            className="w-full accent-blue-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-slate-500 text-xs mt-1">
                            <span>1</span>
                            <span>20</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm whitespace-pre-wrap">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={analizar}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        Analizar {numCommits} commits →
                    </button>
                </div>
            </div>
        );
    }

    // ── Cargando ───────────────────────────────────────────────────────────
    if (cargando) {
        return (
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-blue-400 text-5xl">...</div>
                <p className="text-blue-400 font-medium">Clonando el repo y analizando commits...</p>
                <p className="text-slate-500 text-sm">Esto puede tardar entre 1 y 3 minutos</p>
            </div>
        );
    }

    // ── Resultado ──────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
            {/* Cabecera */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">
                    Últimos {resultado!.num_commits} commits analizados
                </h2>
                <button
                    onClick={() => { setResultado(null); setError(""); }}
                    className="text-sm text-slate-400 hover:text-slate-100 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                >
                    Nuevo análisis
                </button>
            </div>

            {/* Lista de commits */}
            <div className="flex flex-col gap-2">
                {resultado!.commits.map((c, i) => (
                    <div
                        key={i}
                        className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 flex flex-col gap-1"
                    >
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-xs bg-slate-700 text-blue-400 px-2 py-0.5 rounded">
                                {c.hash}
                            </span>
                            <span className="text-slate-400 text-xs">{c.fecha}</span>
                            <span className="text-slate-500 text-xs">por <span className="text-slate-300">{c.autor}</span></span>
                        </div>
                        <p className="text-slate-200 text-sm mt-1">{c.mensaje}</p>
                    </div>
                ))}
            </div>

            {/* Resumen del LLM */}
            <div className="bg-slate-800 border border-blue-500/30 rounded-2xl p-6">
                <h3 className="text-blue-400 font-semibold mb-4 text-sm uppercase tracking-wide">
                    Análisis del LLM
                </h3>
                <div className="text-slate-200 text-sm leading-relaxed">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold text-slate-100 mt-4 mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-bold text-slate-100 mt-4 mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold text-blue-300 mt-3 mb-1">{children}</h3>,
                            p: ({ children }) => <p className="mb-3">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 pl-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 pl-2">{children}</ol>,
                            li: ({ children }) => <li className="text-slate-300">{children}</li>,
                            strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
                            code: ({ children }) => <code className="bg-slate-700 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                            hr: () => <hr className="border-slate-600 my-4" />,
                        }}
                    >
                        {resultado!.resumen}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
