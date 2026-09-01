"use client";

import { useEffect, useRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
  maxRows?: number;
};

/**
 * Textarea que cresce com o conteúdo — sem depender de lib externa.
 */
export function AutoTextarea({
  minRows = 3,
  maxRows = 12,
  value,
  onChange,
  className,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const ajustar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const linha = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const min = linha * minRows + 16;
    const max = linha * maxRows + 16;
    el.style.height = Math.min(max, Math.max(min, el.scrollHeight)) + "px";
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  };

  useEffect(() => {
    ajustar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        // ajusta imediatamente após o setState
        setTimeout(ajustar, 0);
      }}
      rows={minRows}
      className={className}
      {...rest}
    />
  );
}
