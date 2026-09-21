<template>
  <div>
    <div class="row">
      <label class="muted">Search<br />
        <input v-model="q" @keyup.enter="loadDocs" placeholder="title, filename, or path" />
      </label>
      <button class="primary" :disabled="!selected.length" @click="doExport">Export zip</button>
    </div>
    <p v-if="selected.length" class="warn">
      {{ selected.length }} selected.
      {{ already }} already exported. Zip uses the category tree, not original zip folders.
    </p>
    <p v-if="error" class="warn">{{ error }}</p>
    <div class="layout">
      <aside class="tree">
        <h3>Category tree</h3>
        <p class="muted">Click a node to list papers in it and below.</p>
        <button :class="{ active: !tagId }" @click="pick(null)">All papers</button>
        <TreeNodes :nodes="tree" :active="tagId" :depth="0" @pick="pick" />
      </aside>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Filename</th>
            <th>Category path</th>
            <th>Source</th>
            <th>Last exported</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in docs" :key="d.id">
            <td><input type="checkbox" :checked="selected.includes(d.id)" @change="toggle(d.id)" /></td>
            <td><RouterLink :to="`/documents/${d.id}`">{{ d.title }}</RouterLink></td>
            <td>{{ d.filename }}</td>
            <td>{{ d.category_path }}</td>
            <td>{{ d.source }}</td>
            <td>{{ d.last_exported_at ? d.last_exported_at.slice(0, 10) : "—" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../api";
import TreeNodes from "../components/TreeNodes.vue";

const q = ref("");
const tree = ref([]);
const docs = ref([]);
const tagId = ref(null);
const selected = ref([]);
const error = ref("");

const already = computed(
  () => docs.value.filter((d) => selected.value.includes(d.id) && d.last_exported_at).length,
);

function flatten(nodes, acc = []) {
  for (const n of nodes) {
    acc.push(n);
    flatten(n.children || [], acc);
  }
  return acc;
}

async function loadTree() {
  const data = await api.tree();
  tree.value = data.tree || [];
}

async function loadDocs() {
  error.value = "";
  try {
    const data = await api.documents(q.value, tagId.value);
    docs.value = data.documents || [];
  } catch (e) {
    error.value = e.message;
  }
}

function pick(id) {
  tagId.value = id;
}

function toggle(id) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id];
}

async function doExport() {
  const blob = await api.exportZip(selected.value);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.zip";
  a.click();
  URL.revokeObjectURL(url);
  await loadDocs();
}

watch(tagId, loadDocs);
onMounted(async () => {
  try {
    await loadTree();
    await loadDocs();
  } catch (e) {
    error.value = e.message || "Cannot reach API. Is docker compose up on the VM?";
  }
});
</script>
