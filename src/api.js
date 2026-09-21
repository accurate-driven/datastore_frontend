const BASE = import.meta.env.VITE_API_BASE || "";

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
  documents: (q, tagId) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tagId) p.set("tag_id", tagId);
    return req(`/api/documents?${p}`);
  },
  document: (id) => req(`/api/documents/${id}`),
  setCategory: (id, tagId) =>
    req(`/api/documents/${id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    }),
  reclassify: (id) => req(`/api/documents/${id}/reclassify`, { method: "POST" }),
  ingest: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("/api/ingest", { method: "POST", body: fd });
  },
  exportZip: async (ids) => {
    const res = await fetch(`${BASE}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_ids: ids }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
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
