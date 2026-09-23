export function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function outcomeSeverity(outcome) {
  if (outcome === "imported" || outcome === "ingested") return "success";
  if (outcome === "error") return "danger";
  if (String(outcome || "").startsWith("skipped")) return "secondary";
  return "warn";
}

export function sourceSeverity(source) {
  if (source === "manual") return "warn";
  if (source === "auto") return "info";
  return "secondary";
}
