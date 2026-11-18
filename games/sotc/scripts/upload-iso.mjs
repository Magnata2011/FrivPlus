import { put } from "@vercel/blob";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";

const isoPath = process.env.ISO_PATH || "disc.iso";
const pathname = process.env.BLOB_PATHNAME || "shadow-of-the-colossus/disc.iso";
const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN;
const storeId = process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN_STORE_ID;

if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN (or VERCEL_OIDC_TOKEN). Create a Blob store in the Vercel dashboard and set the token.");
  process.exit(1);
}

const absolute = resolve(isoPath);
const size = statSync(absolute).size;
console.log(`Uploading ${absolute} (${(size / 1024 ** 3).toFixed(2)} GB) to Vercel Blob as ${pathname}...`);

const stream = createReadStream(absolute);
const blob = await put(pathname, stream, {
  access: "public",
  multipart: true,
  token,
  ...(storeId ? { storeId } : {}),
  onUploadProgress: ({ loaded, total }) => {
    const pct = total ? ((loaded / total) * 100).toFixed(1) : "?";
    process.stdout.write(`\r${(loaded / 1024 ** 3).toFixed(2)} / ${(total / 1024 ** 3).toFixed(2)} GB (${pct}%)`);
  },
});

process.stdout.write("\n");
console.log("Uploaded:", blob.url);
console.log("Use this URL with ?disc= in games/sotc/index.html");
console.log(`Example: games/sotc/index.html?disc=${blob.url}`);
