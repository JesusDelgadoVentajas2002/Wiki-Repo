"use client";
import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

type TipoDiagrama = "flujo" | "clases";

const DESCRIPCION: Record<TipoDiagrama, { titulo: string; desc: string }> = {
    flujo: {
        titulo: "Flujo de datos",
        desc: "Muestra cómo fluye la información entre funciones y módulos del repositorio. Ideal para entender la arquitectura general y las dependencias entre componentes.",
    },
    clases: {
        titulo: "Diagrama de clases",
        desc: "Muestra las clases, sus atributos, métodos y las relaciones entre ellas. Útil para repositorios orientados a objetos.",
    },
};

export default function Diagrama({ nombreRepo }: { nombreRepo: string }) {
    const [tipo, setTipo] = useState<TipoDiagrama | null>(null);
    const [codigo, setCodigo] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const [intentos, setIntentos] = useState(0);
    const diagramaRef = useRef<HTMLDivElement>(null);

    const generarDiagrama = async (t: TipoDiagrama) => {
        setCargando(true);
        setError("");
        setCodigo("");
        setTipo(t);
        try {
            const res = await fetch("http://localhost:8000/api/diagrama", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre_repo: nombreRepo, tipo: t }),
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

    // ── Estado inicial: selección de tipo ─────────────────────────────────
    if (!cargando && !codigo && tipo === null) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-2xl font-semibold text-slate-100 mb-2">¿Qué diagrama quieres generar?</h2>
                    <p className="text-slate-400 text-sm">El LLM analizará el código indexado de <span className="text-blue-400">{nombreRepo}</span> y generará el diagrama automáticamente.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {(Object.entries(DESCRIPCION) as [TipoDiagrama, typeof DESCRIPCION.flujo][]).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => generarDiagrama(key)}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-left transition-all group"
                        >
                            <div className="flex items-center gap-4 mb-2">
                                <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">{info.titulo}</h3>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed">{info.desc}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Generando ──────────────────────────────────────────────────────────
    if (cargando) {
        return (
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-blue-400 text-5xl">...</div>
                <p className="text-blue-400 font-medium">El LLM está analizando el repositorio...</p>
                <p className="text-slate-500 text-sm">Esto puede tardar entre 1 y 3 minutos</p>
            </div>
        );
    }

    // ── Resultado ──────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">
                        {tipo ? DESCRIPCION[tipo].titulo : ""}
                    </h2>
                    {intentos > 1 && (
                        <p className="text-slate-500 text-xs mt-1">Generado en {intentos} intentos (autocorrección aplicada)</p>
                    )}
                </div>
                <button
                    onClick={() => { setCodigo(""); setTipo(null); setError(""); }}
                    className="text-sm text-slate-400 hover:text-slate-100 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
                >
                    Generar otro diagrama
                </button>
            </div>

            {error && (
                <p className="text-yellow-400 text-sm mb-4 bg-yellow-400/10 rounded-lg px-4 py-3">{error}</p>
            )}

            <div
                ref={diagramaRef}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-8 overflow-auto flex justify-center items-start min-h-[400px]"
            />

            <details className="mt-4">
                <summary className="text-slate-500 text-sm cursor-pointer hover:text-slate-300 transition-colors">Ver código Mermaid</summary>
                <pre className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 overflow-auto">{codigo}</pre>
            </details>
        </div>
    );
}