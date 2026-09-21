<template>
  <div v-if="doc">
    <div class="row" style="justify-content: space-between">
      <div>
        <h2>{{ doc.title }}</h2>
        <p class="muted">{{ doc.filename }} · {{ doc.page_count || "—" }} pages · {{ doc.file_ext }}</p>
      </div>
      <div class="row">
        <a :href="api.downloadUrl(doc.id)"><button>Download</button></a>
      </div>
    </div>
    <h3>Category (canonical tree)</h3>
    <div class="row">
      <select v-model="tagId">
        <option v-for="t in flat" :key="t.id" :value="t.id">{{ t.path }}</option>
      </select>
      <button @click="saveCat">Save (manual)</button>
      <button @click="reclass">Reclassify</button>
      <span class="pill">{{ doc.source }}</span>
    </div>
    <p class="muted">Changing the path is kept as manual. Reclassify runs Ollama again.</p>
    <div class="split">
      <div>
        <h3>Original names (zip, not category)</h3>
        <p v-for="a in filenames" :key="a">{{ a }}</p>
        <h3>Original zip paths</h3>
        <p v-for="a in paths" :key="a">{{ a }}</p>
      </div>
      <div>
        <h3>Exported as</h3>
        <p v-for="e in doc.exports || []" :key="e.job_id + e.exported_at">
          {{ e.exported_at?.slice(0, 16) }} · {{ e.path_in_zip }}
        </p>
      </div>
    </div>
  </div>
  <p v-else-if="error" class="warn">{{ error }}</p>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../api";

const route = useRoute();
const doc = ref(null);
const tree = ref([]);
const tagId = ref("");
const error = ref("");

function flatten(nodes, prefix = "", acc = []) {
  for (const n of nodes) {
    const path = prefix ? `${prefix} / ${n.name}` : n.name;
    acc.push({ id: n.id, path });
    flatten(n.children || [], path, acc);
  }
  return acc;
}
const flat = computed(() => flatten(tree.value));
const filenames = computed(() => (doc.value?.aliases || []).filter((a) => a.kind === "filename").map((a) => a.value));
const paths = computed(() => (doc.value?.aliases || []).filter((a) => a.kind === "zip_path").map((a) => a.value));

async function load() {
  error.value = "";
  try {
    const t = await api.tree();
    tree.value = t.tree || [];
    doc.value = await api.document(route.params.id);
    tagId.value = doc.value.category_id || "";
  } catch (e) {
    error.value = e.message;
  }
}
async function saveCat() {
  doc.value = await api.setCategory(doc.value.id, tagId.value);
}
async function reclass() {
  doc.value = await api.reclassify(doc.value.id);
  tagId.value = doc.value.category_id || "";
}
onMounted(load);
</script>
