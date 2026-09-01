"use client";

import { useEffect, useState } from "react";

const KEY = "grisomaq_tema";

function aplicaTema(t: "claro" | "escuro") {
  const el = document.documentElement;
  if (t === "escuro") el.classList.add("dark");
  else el.classList.remove("dark");
}

export function ThemeToggle() {
  const [tema, setTema] = useState<"claro" | "escuro">("escuro");

  useEffect(() => {
    const salvo =
      (localStorage.getItem(KEY) as "claro" | "escuro" | null) ?? null;
    // dark-first: default é escuro se não houver preferência
    const inicial: "claro" | "escuro" = salvo ?? "escuro";
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
      className="btn-secondary !px-2.5 !py-2"
      onClick={alternar}
      title={`Tema ${tema}`}
      aria-label="Alternar tema"
    >
      <span className="text-base leading-none">
        {tema === "claro" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// Script inline pra evitar flash antes do JS carregar. Dark-first.
export function ThemeInitScript() {
  const code = `try{var s=localStorage.getItem('grisomaq_tema');var d=s?s==='escuro':true;if(d)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
