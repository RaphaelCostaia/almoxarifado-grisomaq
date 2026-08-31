"use client";

import { useEffect, useState } from "react";

const KEY = "grisomaq_tema";

function aplicaTema(t: "claro" | "escuro") {
  const el = document.documentElement;
  if (t === "escuro") el.classList.add("dark");
  else el.classList.remove("dark");
}

export function ThemeToggle() {
  const [tema, setTema] = useState<"claro" | "escuro">("claro");

  useEffect(() => {
    const salvo = (localStorage.getItem(KEY) as "claro" | "escuro" | null) ?? null;
    const prefereEscuro =
      salvo === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const inicial: "claro" | "escuro" =
      salvo ?? (prefereEscuro ? "escuro" : "claro");
    setTema(inicial);
    aplicaTema(inicial);
  }, []);

  function alternar() {
    const novo = tema === "claro" ? "escuro" : "claro";
    setTema(novo);
    localStorage.setItem(KEY, novo);
    aplicaTema(novo);
  }

  return (
    <button
      className="btn-secondary"
      onClick={alternar}
      title={`Tema ${tema}`}
      aria-label="Alternar tema"
    >
      {tema === "claro" ? "🌙" : "☀️"}
    </button>
  );
}

// Script inline pra evitar flash antes do JS carregar
export function ThemeInitScript() {
  const code = `try{var s=localStorage.getItem('grisomaq_tema');var d=s?s==='escuro':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
