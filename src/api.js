const BASE = import.meta.env.VITE_API_BASE || "";

function concatBytes(left, right) {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

async function readExportStream(res, onProgress) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let pending = new Uint8Array(0);
  let mode = "lines";
  let filename = "export.zip";
  let remaining = 0;
  const zipChunks = [];

  while (true) {
    if (mode === "lines") {
      let splitAt = pending.indexOf(10);
      while (splitAt >= 0) {
        const line = decoder.decode(pending.slice(0, splitAt));
        pending = pending.slice(splitAt + 1);
        if (line.trim()) {
          const msg = JSON.parse(line);
          if (msg.type === "error") throw new Error(msg.detail || "Export failed");
          if (msg.type === "progress") onProgress?.(msg);
          if (msg.type === "file") {
            filename = msg.filename || filename;
            remaining = msg.size;
            mode = "zip";
            break;
          }
        }
        splitAt = pending.indexOf(10);
      }
    }
    if (mode === "zip" && pending.length) {
      const take = Math.min(pending.length, remaining);
      zipChunks.push(pending.slice(0, take));
      pending = pending.slice(take);
      remaining -= take;
      if (remaining === 0) {
        return { blob: new Blob(zipChunks, { type: "application/zip" }), filename };
      }
    }
    const { done, value } = await reader.read();
    if (value) pending = concatBytes(pending, value);
    if (done) {
      if (mode === "zip" && remaining === 0) {
        return { blob: new Blob(zipChunks, { type: "application/zip" }), filename };
      }
      throw new Error("Export ended before the zip finished");
    }
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/zip") || ct.includes("octet-stream") || opts.blob) {
    return res.blob();
  }
  return res.json();
}

export const api = {
  health: () => req("/api/health"),
  tree: () => req("/api/categories/tree"),
  documents: (q, tagId, fileExts, languages) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tagId) p.set("tag_id", tagId);
    for (const ext of fileExts || []) p.append("file_exts", ext);
    for (const code of languages || []) p.append("languages", code);
    const qs = p.toString();
    return req(qs ? `/api/documents?${qs}` : "/api/documents");
  },
  document: (id) => req(`/api/documents/${id}`),
  deleteDocument: (id) => req(`/api/documents/${id}`, { method: "DELETE" }),
  setCategory: (id, tagId) =>
    req(`/api/documents/${id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    }),
  reclassify: (id) => req(`/api/documents/${id}/reclassify`, { method: "POST" }),
  importZip: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("/api/import", { method: "POST", body: fd });
  },
  importJobs: () => req("/api/import"),
  importJob: (id) => req(`/api/import/${id}`),
  importSources: () => req("/api/import-sources"),
  fileTypes: () => req("/api/file-types"),
  languages: () => req("/api/languages"),
  recheckLanguagePreview: (body) =>
    req("/api/languages/recheck/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  recheckLanguage: (body) =>
    req("/api/languages/recheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  recheckLanguageJobs: () => req("/api/languages/recheck"),
  exportLanguages: () => req("/api/export-languages"),
  addExportLanguage: (name) =>
    req("/api/export-languages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteExportLanguage: (id) => req(`/api/export-languages/${id}`, { method: "DELETE" }),
  setTranslation: (tagId, languageId, name) =>
    req(`/api/categories/${tagId}/translation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language_id: languageId, name }),
    }),
  exportPreview: (body) =>
    req("/api/export/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  exportZip: async (body, { onProgress, signal } = {}) => {
    const res = await fetch(`${BASE}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(await res.text());
    return readExportStream(res, onProgress);
  },
  exports: () => req("/api/exports"),
  patchTag: (id, body) =>
    req(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  mergeTags: (sourceId, targetId) =>
    req("/api/categories/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
    }),
  reclassifyUncat: () => req("/api/categories/reclassify-uncategorized", { method: "POST" }),
  downloadUrl: (id) => `${BASE}/api/documents/${id}/download`,
};
