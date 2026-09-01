"use client";

import { useRef } from "react";

type Props = {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  label?: string;
};

export function FileInput({
  file,
  onFile,
  accept,
  label = "Escolher arquivo",
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary !py-1.5 !text-xs"
        onClick={() => ref.current?.click()}
      >
        📎 {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 text-xs">
          <span
            className="max-w-[220px] truncate font-mono"
            style={{ color: "var(--text)" }}
          >
            {file.name}
          </span>
          <button
            type="button"
            className="btn-ghost !px-1.5 !py-1"
            onClick={() => onFile(null)}
            title="Remover"
          >
            ✕
          </button>
        </div>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum arquivo escolhido
        </span>
      )}
    </div>
  );
}
