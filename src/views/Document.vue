<template>
  <div v-if="doc">
    <div class="card">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div class="font-semibold text-xl mb-2">{{ doc.title }}</div>
          <p class="text-muted-color m-0">
            {{ doc.filename }} · {{ doc.page_count || "—" }} pages · {{ doc.file_ext }}
          </p>
        </div>
        <Button as="a" :href="api.downloadUrl(doc.id)" label="Download" icon="pi pi-download" />
      </div>
    </div>

    <div class="card">
      <div class="font-semibold text-xl mb-2">Category (canonical tree)</div>
      <p class="text-muted-color mb-4">Changing the path is kept as manual. Reclassify runs Ollama again.</p>
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-2">
          <label class="font-medium" for="cat">Category path</label>
          <Select
            inputId="cat"
            v-model="tagId"
            :options="flat"
            optionLabel="path"
            optionValue="id"
            class="w-full sm:w-96"
          />
        </div>
        <Button label="Save (manual)" icon="pi pi-save" @click="saveCat" />
        <Button label="Reclassify" icon="pi pi-refresh" severity="secondary" @click="reclass" />
        <Tag :value="doc.source || '—'" :severity="sourceSeverity(doc.source)" />
      </div>
      <Message v-if="error" severity="error" class="mt-4" :closable="false">{{ error }}</Message>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 md:col-span-6">
        <div class="card">
          <div class="font-semibold text-xl mb-4">Original names (zip, not category)</div>
          <ul v-if="filenames.length" class="list-none p-0 m-0 flex flex-col gap-2">
            <li v-for="a in filenames" :key="a" class="text-muted-color">{{ a }}</li>
          </ul>
          <p v-else class="text-muted-color m-0">None</p>
          <div class="font-semibold text-xl mt-6 mb-4">Original zip paths</div>
          <ul v-if="paths.length" class="list-none p-0 m-0 flex flex-col gap-2">
            <li v-for="a in paths" :key="a" class="text-muted-color">{{ a }}</li>
          </ul>
          <p v-else class="text-muted-color m-0">None</p>
        </div>
      </div>
      <div class="col-span-12 md:col-span-6">
        <div class="card">
          <div class="font-semibold text-xl mb-4">Exported as</div>
          <DataTable :value="doc.exports || []" emptyMessage="Not exported yet." stripedRows>
            <Column header="When">
              <template #body="{ data }">
                {{ fmtDate(data.exported_at) }}
              </template>
            </Column>
            <Column field="path_in_zip" header="Path in zip" />
          </DataTable>
        </div>
      </div>
    </div>
  </div>
  <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>
</template>

<script setup>
import { api } from "@/api";
import { flattenTags } from "@/categoryTree";
import { fmtDate, sourceSeverity } from "@/format";
import { useToast } from "primevue/usetoast";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const toast = useToast();
const doc = ref(null);
const tree = ref([]);
const tagId = ref(null);
const error = ref("");

const flat = computed(() => flattenTags(tree.value));
const filenames = computed(() =>
  (doc.value?.aliases || []).filter((a) => a.kind === "filename").map((a) => a.value),
);
const paths = computed(() =>
  (doc.value?.aliases || []).filter((a) => a.kind === "zip_path").map((a) => a.value),
);

async function load() {
  error.value = "";
  try {
    const t = await api.tree();
    tree.value = t.tree || [];
    doc.value = await api.document(route.params.id);
    tagId.value = doc.value.category_id || null;
  } catch (e) {
    error.value = e.message;
    doc.value = null;
  }
}

async function saveCat() {
  error.value = "";
  try {
    doc.value = await api.setCategory(doc.value.id, tagId.value);
    toast.add({ severity: "success", summary: "Saved", detail: "Category set as manual", life: 3000 });
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Save failed", detail: e.message, life: 6000 });
  }
}

async function reclass() {
  error.value = "";
  try {
    doc.value = await api.reclassify(doc.value.id);
    tagId.value = doc.value.category_id || null;
    toast.add({ severity: "success", summary: "Reclassified", detail: doc.value.category_path || "Uncategorized", life: 3000 });
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Reclassify failed", detail: e.message, life: 6000 });
  }
}

watch(() => route.params.id, load, { immediate: true });
</script>
