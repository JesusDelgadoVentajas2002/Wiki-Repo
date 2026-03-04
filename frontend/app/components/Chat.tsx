"use client";
import { useState, useRef, useEffect } from "react";

interface Mensaje {
    rol: "usuario" | "asistente";
    texto: string;
}

export default function Chat({ nombreRepo }: { nombreRepo: string }) {
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [pregunta, setPregunta] = useState("");
    const [cargando, setCargando] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensajes]);

    const enviar = async () => {
        if (!pregunta.trim() || cargando) return;

        const textoPregunta = pregunta;
        setPregunta("");
        setMensajes(prev => [...prev, { rol: "usuario", texto: textoPregunta }]);
        setCargando(true);

        // Añadir mensaje vacío del asistente que iremos llenando
        setMensajes(prev => [...prev, { rol: "asistente", texto: "" }]);

        try {
            const res = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre_repo: nombreRepo, pregunta: textoPregunta }),
            });

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lineas = chunk.split("\n").filter(l => l.startsWith("data: "));

                for (const linea of lineas) {
                    try {
                        const dato = JSON.parse(linea.replace("data: ", ""));
                        if (dato.fin) break;
                        if (dato.token) {
                            setMensajes(prev => {
                                const copia = [...prev];
                                copia[copia.length - 1] = {
                                    ...copia[copia.length - 1],
                                    texto: copia[copia.length - 1].texto + dato.token
                                };
                                return copia;
                            });
                        }
                    } catch { }
                }
            }
        } catch {
            setMensajes(prev => {
                const copia = [...prev];
                copia[copia.length - 1] = { rol: "asistente", texto: "Error al conectar con el backend." };
                return copia;
            });
        }

        setCargando(false);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-[600px]">
            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {mensajes.length === 0 && (
                    <p className="text-slate-500 text-center mt-20">
                        Pregunta cualquier cosa sobre <span className="text-blue-400">{nombreRepo}</span>
                    </p>
                )}
                {mensajes.map((m, i) => (
                    <div key={i} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${m.rol === "usuario"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-700 text-slate-100"
                            }`}>
                            {m.texto || (cargando && i === mensajes.length - 1
                                ? <span className="animate-pulse text-slate-400">Generando...</span>
                                : "")}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700 flex gap-3">
                <input
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="¿Qué hace la función de autenticación?"
                    value={pregunta}
                    onChange={e => setPregunta(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && enviar()}
                    disabled={cargando}
                />
                <button
                    onClick={enviar}
                    disabled={cargando || !pregunta.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                    {cargando ? "..." : "Enviar"}
                </button>
            </div>
        </div>
    );
}