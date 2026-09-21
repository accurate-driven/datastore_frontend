<template>
  <div>
    <h2>Category tree</h2>
    <p class="muted">Built from PDF content. Zip folders do not appear here.</p>
    <p v-if="error" class="warn">{{ error }}</p>
    <table>
      <thead>
        <tr>
          <th>Tree</th>
          <th>Documents</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>{{ row.indent }}{{ row.name }}</td>
          <td>{{ row.document_count }}</td>
        </tr>
      </tbody>
    </table>
    <div class="row" style="margin-top: 16px">
      <label class="muted">Rename node<br />
        <select v-model="editId">
          <option v-for="r in rows" :key="r.id" :value="r.id">{{ r.path }}</option>
        </select>
      </label>
      <input v-model="newName" placeholder="new name" />
      <button @click="rename">Rename</button>
      <button @click="reclass">Reclassify Uncategorized</button>
    </div>
    <div class="row">
      <label class="muted">Merge source into target<br />
        <select v-model="src"><option v-for="r in rows" :key="'s'+r.id" :value="r.id">{{ r.path }}</option></select>
      </label>
      <select v-model="dst"><option v-for="r in rows" :key="'d'+r.id" :value="r.id">{{ r.path }}</option></select>
      <button @click="merge">Merge</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { api } from "../api";

const tree = ref([]);
const error = ref("");
const editId = ref("");
const newName = ref("");
const src = ref("");
const dst = ref("");

function walk(nodes, depth, prefix, acc) {
  for (const n of nodes) {
    const path = prefix ? `${prefix} / ${n.name}` : n.name;
    acc.push({
      id: n.id,
      name: n.name,
      path,
      indent: "  ".repeat(depth),
      document_count: n.document_count,
    });
    walk(n.children || [], depth + 1, path, acc);
  }
  return acc;
}
const rows = computed(() => walk(tree.value, 0, "", []));

async function load() {
  const data = await api.tree();
  tree.value = data.tree || [];
  if (rows.value[0]) {
    editId.value = rows.value[0].id;
    src.value = rows.value[0].id;
    dst.value = rows.value[0].id;
  }
}
async function rename() {
  await api.patchTag(editId.value, { name: newName.value });
  await load();
}
async function merge() {
  await api.mergeTags(src.value, dst.value);
  await load();
}
async function reclass() {
  await api.reclassifyUncat();
  await load();
}
onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
