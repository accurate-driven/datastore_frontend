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
          <Button label="Export zip" icon="pi pi-download" @click="openExport" />
        </div>
      </div>
      <Message v-if="selectedIds.length" severity="warn" :closable="false" class="mb-4">
        {{ selectedIds.length }} selected.
        {{ already }} already exported. Zip uses the category tree, not original zip folders.
      </Message>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    </div>

    <Dialog v-model:visible="exportOpen" header="Export zip" modal :style="{ width: '32rem' }">
      <p class="text-muted-color mt-0">
        The zip uses the current category tree and current file names. Filters combine.
      </p>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <Checkbox v-model="useSelection" binary inputId="export-selected" :disabled="!selectedIds.length" />
          <label for="export-selected">Selected papers ({{ selectedIds.length }})</label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="onlyUnexported" binary inputId="export-unexported" />
          <label for="export-unexported">Only not exported</label>
        </div>
        <div class="flex flex-col gap-2">
          <label for="export-after">Imported after</label>
          <DatePicker
            v-model="importedAfter"
            inputId="export-after"
            showIcon
            showTime
            hourFormat="24"
            showButtonBar
            dateFormat="yy-mm-dd"
            placeholder="Any import time"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="export-sources">Zip sources</label>
          <MultiSelect
            v-model="zipFilenames"
            inputId="export-sources"
            :options="sources"
            placeholder="Any source"
            display="chip"
            filter
            :maxSelectedLabels="3"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="export-language">Second language</label>
          <InputText
            v-model="language"
            id="export-language"
            placeholder="Main names only"
          />
          <p class="text-muted-color m-0">
            Folder names are translated when the zip is built and are not saved. Leave this empty for the main names only.
          </p>
        </div>
        <p class="m-0">{{ previewLabel }}</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="exportOpen = false" />
        <Button label="Export" icon="pi pi-download" :disabled="!canExport" :loading="exporting" @click="doExport" />
      </template>
    </Dialog>

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
            <Column field="category_path" header="Category" sortable>
              <template #body="{ data }">
                {{ lastCategory(data.category_path) }}
              </template>
            </Column>
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
import { toPrimeTree } from "@/categoryTree";
import { downloadBlob, fmtDate, lastCategory, sourceSeverity } from "@/format";
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
const exportOpen = ref(false);
const useSelection = ref(false);
const onlyUnexported = ref(false);
const importedAfter = ref(null);
const zipFilenames = ref([]);
const sources = ref([]);
const language = ref("");
const previewCount = ref(null);
const exporting = ref(false);
let previewToken = 0;

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
  expandedKeys.value = { all: true };
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

const hasExportFilter = computed(
  () =>
    (useSelection.value && selectedIds.value.length > 0) ||
    onlyUnexported.value ||
    !!importedAfter.value ||
    (zipFilenames.value || []).length > 0,
);
const canExport = computed(() => hasExportFilter.value && previewCount.value > 0 && !exporting.value);
const previewLabel = computed(() => {
  if (!hasExportFilter.value) return "Choose a selection or a filter.";
  if (previewCount.value == null) return "Counting…";
  return `${previewCount.value} file${previewCount.value === 1 ? "" : "s"}`;
});

function exportBody() {
  return {
    document_ids: useSelection.value ? selectedIds.value : [],
    only_unexported: onlyUnexported.value,
    imported_after: importedAfter.value ? importedAfter.value.toISOString() : null,
    zip_filenames: zipFilenames.value || [],
    language: language.value.trim() || null,
  };
}

async function openExport() {
  useSelection.value = selectedIds.value.length > 0;
  exportOpen.value = true;
  try {
    const src = await api.importSources();
    sources.value = src.sources || [];
  } catch (e) {
    error.value = e.message;
  }
}

async function refreshPreview() {
  const token = ++previewToken;
  if (!exportOpen.value || !hasExportFilter.value) {
    previewCount.value = null;
    return;
  }
  try {
    const data = await api.exportPreview(exportBody());
    if (token === previewToken) previewCount.value = data.count;
  } catch (e) {
    if (token !== previewToken) return;
    previewCount.value = null;
    error.value = e.message;
  }
}

async function doExport() {
  exporting.value = true;
  error.value = "";
  try {
    const { blob, filename } = await api.exportZip(exportBody());
    downloadBlob(blob, filename);
    toast.add({ severity: "success", summary: "Export ready", detail: filename, life: 3000 });
    exportOpen.value = false;
    selectedDocs.value = [];
    await loadDocs();
  } catch (e) {
    let message = e.message;
    try {
      const parsed = JSON.parse(message);
      if (parsed.detail) message = String(parsed.detail);
    } catch {
      /* response was not JSON */
    }
    error.value = message;
    toast.add({ severity: "error", summary: "Export failed", detail: message, life: 6000 });
  } finally {
    exporting.value = false;
  }
}

watch(
  () => [
    exportOpen.value,
    useSelection.value,
    onlyUnexported.value,
    importedAfter.value?.toISOString() || "",
    (zipFilenames.value || []).join("\n"),
    selectedIds.value.join(","),
  ],
  refreshPreview,
);

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
