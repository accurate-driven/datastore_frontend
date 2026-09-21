export function toPrimeTree(nodes) {
  return (nodes || []).map((n) => ({
    key: n.id,
    label: `${n.name} (${n.document_count ?? 0})`,
    icon: n.name === "Uncategorized" ? "pi pi-inbox" : "pi pi-folder",
    data: n,
    children: n.children?.length ? toPrimeTree(n.children) : undefined,
  }));
}

export function toTreeTable(nodes) {
  return (nodes || []).map((n) => ({
    key: n.id,
    data: {
      id: n.id,
      name: n.name,
      document_count: n.document_count,
    },
    children: n.children?.length ? toTreeTable(n.children) : undefined,
  }));
}

export function flattenTags(nodes, prefix = "", acc = []) {
  for (const n of nodes || []) {
    const path = prefix ? `${prefix} / ${n.name}` : n.name;
    acc.push({
      id: n.id,
      name: n.name,
      path,
      document_count: n.document_count,
    });
    flattenTags(n.children, path, acc);
  }
  return acc;
}

export function collectKeys(nodes, acc = {}) {
  for (const n of nodes || []) {
    acc[n.key] = true;
    collectKeys(n.children, acc);
  }
  return acc;
}

export function selectedKey(keys) {
  return Object.keys(keys || {}).find((k) => keys[k]) || null;
}
