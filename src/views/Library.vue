<template>
  <div>
    <div class="card">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <div class="font-semibold text-xl">Library</div>
          <p class="text-muted-color m-0">Zip folders are provenance only. Categories come from the tree.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="q" placeholder="Search title, filename, or path" @keyup.enter="loadDocs" />
          </IconField>
          <Button label="Search" icon="pi pi-search" severity="secondary" @click="loadDocs" />
          <Button label="Export zip" icon="pi pi-download" :disabled="!selectedIds.length" @click="doExport" />
        </div>
      </div>
      <Message v-if="selectedIds.length" severity="warn" :closable="false" class="mb-4">
        {{ selectedIds.length }} selected.
        {{ already }} already exported. Zip uses the category tree, not original zip folders.
      </Message>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 lg:col-span-4 xl:col-span-3">
        <div class="card">
          <div class="font-semibold text-xl mb-2">Category tree</div>
          <p class="text-muted-color mb-4">Click a node to list papers in it and below.</p>
          <Tree
            :value="treeNodes"
            v-model:selectionKeys="selectionKeys"
            v-model:expandedKeys="expandedKeys"
            selectionMode="single"
            :filter="true"
            filterMode="lenient"
            filterPlaceholder="Search categories"
            :highlightOnSelect="true"
            class="w-full"
            @node-select="onNodeSelect"
          />
        </div>
      </div>
      <div class="col-span-12 lg:col-span-8 xl:col-span-9">
        <div class="card">
          <DataTable
            :value="docs"
            v-model:selection="selectedDocs"
            dataKey="id"
            :loading="loading"
            paginator
            :rows="20"
            :rowsPerPageOptions="[10, 20, 50]"
            stripedRows
            responsiveLayout="scroll"
            emptyMessage="No papers in this category."
          >
            <Column selectionMode="multiple" headerStyle="width: 3rem" />
            <Column field="title" header="Title" sortable>
              <template #body="{ data }">
                <router-link :to="`/documents/${data.id}`" class="text-primary font-medium hover:underline">
                  {{ data.title }}
                </router-link>
              </template>
            </Column>
            <Column field="filename" header="Filename" sortable />
            <Column field="category_path" header="Category path" sortable />
            <Column field="source" header="Source" style="width: 8rem">
              <template #body="{ data }">
                <Tag :value="data.source || '—'" :severity="sourceSeverity(data.source)" />
              </template>
            </Column>
            <Column field="last_exported_at" header="Last exported" sortable>
              <template #body="{ data }">
                {{ fmtDate(data.last_exported_at) }}
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { collectKeys, toPrimeTree } from "@/categoryTree";
import { downloadBlob, fmtDate, sourceSeverity } from "@/format";
import { api } from "@/api";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, ref, watch } from "vue";

const toast = useToast();
const q = ref("");
const tree = ref([]);
const docs = ref([]);
const tagId = ref(null);
const selectedDocs = ref([]);
const error = ref("");
const loading = ref(false);
const selectionKeys = ref({ all: true });
const expandedKeys = ref({ all: true });

const selectedIds = computed(() => (selectedDocs.value || []).map((d) => d.id));
const already = computed(
  () => docs.value.filter((d) => selectedIds.value.includes(d.id) && d.last_exported_at).length,
);

const treeNodes = computed(() => [
  {
    key: "all",
    label: "All papers",
    icon: "pi pi-inbox",
    children: toPrimeTree(tree.value),
  },
]);

async function loadTree() {
  const data = await api.tree();
  tree.value = data.tree || [];
  expandedKeys.value = { all: true, ...collectKeys(toPrimeTree(tree.value)) };
}

async function loadDocs() {
  error.value = "";
  loading.value = true;
  try {
    const data = await api.documents(q.value, tagId.value);
    docs.value = data.documents || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function onNodeSelect(node) {
  tagId.value = node.key === "all" ? null : node.key;
  selectedDocs.value = [];
}

async function doExport() {
  try {
    const { blob, filename } = await api.exportZip(selectedIds.value);
    downloadBlob(blob, filename);
    toast.add({ severity: "success", summary: "Export ready", detail: filename, life: 3000 });
    selectedDocs.value = [];
    await loadDocs();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Export failed", detail: e.message, life: 6000 });
  }
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
