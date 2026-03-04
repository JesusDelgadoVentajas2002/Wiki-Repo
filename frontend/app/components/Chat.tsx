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
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensajes]);

    const enviar = async () => {
        if (!pregunta.trim() || cargando) return;

        const textoPregunta = pregunta;
        setPregunta("");
        setMensajes(prev => [...prev, { rol: "usuario", texto: textoPregunta }]);
        setCargando(true);
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

    const hayMensajes = mensajes.length > 0;

    return (
        <div className="h-full flex flex-col">
            {/* Sin mensajes: input centrado */}
            {!hayMensajes ? (
                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
                    <div className="text-center">
                        <p className="text-slate-300 text-xl font-medium mb-2">¿Qué quieres saber sobre <span className="text-blue-400">{nombreRepo}</span>?</p>
                        <p className="text-slate-500 text-sm">Puedes preguntar qué hace el código, cómo funciona una función, qué endpoints tiene, etc.</p>
                    </div>
                    <div className="w-full max-w-2xl flex gap-3">
                        <input
                            ref={inputRef}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-5 py-4 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-base"
                            placeholder="¿Qué hace este repositorio?"
                            value={pregunta}
                            onChange={e => setPregunta(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && enviar()}
                            autoFocus
                        />
                        <button
                            onClick={enviar}
                            disabled={!pregunta.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-4 rounded-xl transition-colors"
                        >
                            Enviar
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {["¿Qué hace este repositorio?", "¿Qué endpoints tiene la API?", "¿Cómo está organizado el código?"].map(sugerencia => (
                            <button
                                key={sugerencia}
                                onClick={() => { setPregunta(sugerencia); inputRef.current?.focus(); }}
                                className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-full transition-colors"
                            >
                                {sugerencia}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* Con mensajes: lista + input fijo abajo */
                <>
                    <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">
                        {mensajes.map((m, i) => (
                            <div key={i} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.rol === "usuario"
                                        ? "bg-blue-600 text-white rounded-br-sm"
                                        : "bg-slate-700 text-slate-100 rounded-bl-sm"
                                    }`}>
                                    {m.texto || (cargando && i === mensajes.length - 1
                                        ? <span className="animate-pulse text-slate-400">Generando respuesta...</span>
                                        : "")}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <div className="px-8 py-5 border-t border-slate-700 bg-slate-800/50 flex gap-3">
                        <input
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-5 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Siguiente pregunta..."
                            value={pregunta}
                            onChange={e => setPregunta(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && enviar()}
                            disabled={cargando}
                        />
                        <button
                            onClick={enviar}
                            disabled={cargando || !pregunta.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                        >
                            {cargando ? "..." : "Enviar"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}