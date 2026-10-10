export function excelSafe(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

export function downloadName(filename: string): string {
  const cleaned = filename.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || "纸匣导出";
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
