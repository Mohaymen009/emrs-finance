import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Private file storage root. This directory MUST live outside of Next.js's
 * `public/` folder so files are never reachable via a public URL — the only
 * way to read a file back is through an authenticated API route
 * (see src/app/api/files/[kind]/[id]/route.ts) which checks the session
 * and division access before streaming bytes.
 */
const STORAGE_ROOT =
  process.env.FILE_STORAGE_ROOT ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "secure-storage");

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export class FileValidationError extends Error {}

export function assertValidUpload(file: { type: string; size: number }) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new FileValidationError(
      `Unsupported file type "${file.type}". Allowed: PDF, PNG, JPEG, WEBP.`
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError("File exceeds the 15MB size limit.");
  }
  if (file.size === 0) {
    throw new FileValidationError("File is empty.");
  }
}

/**
 * Persist an uploaded file to private storage, organized as:
 *   secure-storage/<category>/<yyyy>/<mm>/<uuid>-<sanitized-original-name>
 * Returns the storageKey to save on the owning record (Invoice/Receipt row).
 */
export async function saveFileToPrivateStorage(
  category: "invoices" | "receipts",
  originalName: string,
  buffer: Buffer
): Promise<string> {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const storageKey = path.join(category, yyyy, mm, `${randomUUID()}-${safeName}`);

  const fullPath = path.join(STORAGE_ROOT, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer, { mode: 0o600 });

  return storageKey;
}

export async function readFileFromPrivateStorage(storageKey: string): Promise<Buffer> {
  const fullPath = resolveSafePath(storageKey);
  return readFile(fullPath);
}

export async function deleteFileFromPrivateStorage(storageKey: string): Promise<void> {
  const fullPath = resolveSafePath(storageKey);
  await unlink(fullPath).catch(() => undefined);
}

/**
 * Resolve a storageKey to an absolute path while guarding against path
 * traversal (e.g. "../../etc/passwd") — the resolved path must remain
 * inside STORAGE_ROOT.
 */
function resolveSafePath(storageKey: string): string {
  const fullPath = path.resolve(STORAGE_ROOT, storageKey);
  const root = path.resolve(STORAGE_ROOT);
  if (!fullPath.startsWith(root + path.sep)) {
    throw new FileValidationError("Invalid file reference.");
  }
  return fullPath;
}
