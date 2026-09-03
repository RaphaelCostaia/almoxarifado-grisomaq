import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { exigirSessaoApi } from "@/lib/api-auth";
import { auditar } from "@/lib/auditar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/data/uploads"
    : path.join(process.cwd(), "uploads"));

const PUBLIC_BASE =
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ?? "/api/uploads";

const MAX_MB = 8;

function extensaoDe(nome: string, mime: string) {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(nome);
  if (m) return m[1].toLowerCase();
  if (mime.startsWith("image/")) return mime.split("/")[1];
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

export async function POST(req: NextRequest) {
  const auth = await exigirSessaoApi();
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "sem_arquivo" }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: "arquivo_muito_grande", limiteMb: MAX_MB },
      { status: 413 }
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extensaoDe(file.name, file.type);
  const nome = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, nome), buf);

  await auditar({
    req,
    sessao: auth.sessao,
    acao: "arquivo_upload",
    entidade: "arquivo",
    resumo: `Upload: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
    diff: {
      nomeOriginal: file.name,
      nomeSalvo: nome,
      mime: file.type,
      tamanhoBytes: file.size,
    },
  });

  return NextResponse.json({ url: `${PUBLIC_BASE}/${nome}` });
}
