/**
 * Parse filename from Content-Disposition (RFC 6266), including filename*=UTF-8''.
 */
export function parseFilenameFromContentDisposition(
  header: string | null,
  fallback: string
): string {
  if (!header) return fallback;

  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"+|"+$/g, ""));
    } catch {
      /* fall through */
    }
  }

  const quoted = /filename\s*=\s*"((?:\\"|[^"])*)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1].replace(/\\"/g, '"');
  }

  const unquoted = /filename\s*=\s*([^;\s]+)/i.exec(header);
  if (unquoted?.[1]) {
    return unquoted[1].trim().replace(/^"+|"+$/g, "");
  }

  return fallback;
}

export function buildAttachmentContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
