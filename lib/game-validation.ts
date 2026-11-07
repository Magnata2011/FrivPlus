import "server-only";

const MAX_COVER_SIZE = 1 * 1024 * 1024;
const MAX_GAME_SIZE = 2.5 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 3.5 * 1024 * 1024;
const COVER_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type GameInput = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  featured: boolean;
  published: boolean;
  cover: File | null;
  coverUrl: string;
  gameFile: File | null;
  gameUrl: string;
};

export async function parseGameInput(form: FormData): Promise<GameInput | string> {
  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "Geral").trim() || "Geral";
  const tags = String(form.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const gameUrl = String(form.get("gameUrl") ?? "").trim();
  const coverUrl = String(form.get("coverUrl") ?? "").trim();
  const coverValue = form.get("cover");
  const gameFileValue = form.get("gameFile");
  const cover =
    coverValue instanceof File && coverValue.size > 0 ? coverValue : null;
  const gameFile =
    gameFileValue instanceof File && gameFileValue.size > 0 ? gameFileValue : null;

  if (id && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id)) {
    return "O ID deve ter até 80 caracteres: letras, números, hífen ou sublinhado.";
  }
  if (!title || title.length > 100) return "Informe um nome com até 100 caracteres.";
  if (description.length > 1500) return "A descrição deve ter até 1.500 caracteres.";
  if (!category || category.length > 50) return "Informe uma categoria com até 50 caracteres.";
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
    return "Informe até 10 tags, com no máximo 30 caracteres cada.";
  }
  if (gameUrl) {
    try {
      const parsedUrl = new URL(gameUrl);
      if (parsedUrl.protocol !== "https:") return "A URL do jogo deve usar HTTPS.";
    } catch {
      return "Informe uma URL válida para o jogo.";
    }
    if (coverUrl) {
      try {
        const parsedUrl = new URL(coverUrl);
        if (parsedUrl.protocol !== "https:") return "O link da capa deve usar HTTPS.";
      } catch {
        return "Informe um link HTTPS válido para a capa.";
      }
    }
  }
  if (gameFile) {
    const extension = gameFile.name.split(".").pop()?.toLowerCase();
    if (!["html", "htm"].includes(extension ?? "") || gameFile.type !== "text/html") {
      return "O arquivo do jogo deve ser um arquivo HTML.";
    }
    if (gameFile.size > MAX_GAME_SIZE) return "O arquivo HTML deve ter no máximo 2,5 MB.";
  }
  if (cover) {
    if (!COVER_EXTENSIONS[cover.type]) {
      return "A capa deve estar no formato JPEG, PNG ou WebP.";
    }
    if (cover.size > MAX_COVER_SIZE) return "A imagem de capa deve ter no máximo 1 MB.";
  }
  if ((cover?.size ?? 0) + (gameFile?.size ?? 0) > MAX_TOTAL_FILE_SIZE) {
    return "A soma dos arquivos deve ter no máximo 3,5 MB.";
  }
  if (cover && !(await isValidImageSignature(cover))) {
    return "O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP válida.";
  }

  return {
    id,
    title,
    description,
    category,
    tags,
    featured: form.get("featured") === "true",
    published: form.get("published") === "true",
    cover,
    coverUrl,
    gameFile,
    gameUrl,
  };
}

export function coverExtension(file: File) {
  return COVER_EXTENSIONS[file.type];
}

async function isValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (file.type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export const fileLimits = {
  cover: MAX_COVER_SIZE,
  game: MAX_GAME_SIZE,
  total: MAX_TOTAL_FILE_SIZE,
};
