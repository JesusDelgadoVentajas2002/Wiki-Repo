"use client";
import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

export default function Diagrama({ nombreRepo }: { nombreRepo: string }) {
    const [tipo, setTipo] = useState<"flujo" | "clases">("flujo");
    const [codigo, setCodigo] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const [intentos, setIntentos] = useState(0);
    const diagramaRef = useRef<HTMLDivElement>(null);

    const generarDiagrama = async () => {
        setCargando(true);
        setError("");
        setCodigo("");
        try {
            const res = await fetch("http://localhost:8000/api/diagrama", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre_repo: nombreRepo, tipo }),
            });
            const data = await res.json();
            if (data.status === "ok" || data.status === "warning") {
                setCodigo(data.mermaid);
                setIntentos(data.intentos);
                if (data.error) setError(data.error);
            } else {
                setError(data.mensaje || "Error desconocido");
            }
        } catch {
            setError("No se pudo conectar con el backend.");
        }
        setCargando(false);
    };

    useEffect(() => {
        if (!codigo || !diagramaRef.current) return;
        diagramaRef.current.innerHTML = "";
        mermaid.render("diagrama-svg", codigo).then(({ svg }) => {
            diagramaRef.current!.innerHTML = svg;
        }).catch(e => {
            setError(`Error renderizando diagrama: ${e.message}`);
        });
    }, [codigo]);

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex gap-3 mb-6">
                <button
                    onClick={() => setTipo("flujo")}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${tipo === "flujo" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                >
                    Flujo de datos
                </button>
                <button
                    onClick={() => setTipo("clases")}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${tipo === "clases" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                >
                    Diagrama de clases
                </button>
                <button
                    onClick={generarDiagrama}
                    disabled={cargando}
                    className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                    {cargando ? "Generando..." : "Generar diagrama"}
                </button>
            </div>

            {cargando && (
                <p className="text-blue-400 animate-pulse text-center py-10">
                    El LLM está analizando el repositorio y generando el diagrama...
                </p>
            )}

            {error && (
                <p className="text-yellow-400 text-sm mb-4">{error}</p>
            )}

            {codigo && !cargando && (
                <>
                    {intentos > 1 && (
                        <p className="text-slate-400 text-xs mb-2">Generado en {intentos} intentos (autocorrección aplicada)</p>
                    )}
                    <div ref={diagramaRef} className="bg-slate-900 rounded-lg p-4 overflow-auto" />
                    <details className="mt-4">
                        <summary className="text-slate-400 text-sm cursor-pointer hover:text-slate-300">Ver código Mermaid</summary>
                        <pre className="mt-2 bg-slate-900 rounded p-3 text-xs text-slate-300 overflow-auto">{codigo}</pre>
                    </details>
                </>
            )}

            {!codigo && !cargando && (
                <p className="text-slate-500 text-center py-10">
                    Pulsa "Generar diagrama" para analizar la arquitectura de <span className="text-blue-400">{nombreRepo}</span>
                </p>
            )}
        </div>
    );
}