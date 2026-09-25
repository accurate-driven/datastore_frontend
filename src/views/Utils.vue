<template>
  <div>
    <div class="card">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="font-semibold text-xl">Utils</div>
          <p class="text-muted-color m-0">Recheck the language stored on papers that are already in the library.</p>
        </div>
        <Button label="Recheck language" icon="pi pi-refresh" @click="openRecheck" />
      </div>
      <Message v-if="error" severity="error" class="mt-4" :closable="false">{{ error }}</Message>
    </div>

    <Dialog
      v-model:visible="recheckOpen"
      header="Recheck language"
      modal
      :style="{ width: '32rem' }"
      :closable="!starting"
      :closeOnEscape="!starting"
    >
      <p class="text-muted-color mt-0">
        Filters combine. Leave them empty to recheck every paper. The job uses the text already stored.
      </p>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="recheck-languages">Languages</label>
          <MultiSelect
            v-model="languages"
            inputId="recheck-languages"
            :options="languageOptions"
            optionLabel="name"
            optionValue="code"
            placeholder="Any language"
            display="chip"
            filter
            :maxSelectedLabels="3"
          />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="includeUnknown" binary inputId="recheck-unknown" />
          <label for="recheck-unknown">No language</label>
        </div>
        <div class="flex flex-col gap-2">
          <label for="recheck-types">File types</label>
          <MultiSelect
            v-model="fileExts"
            inputId="recheck-types"
            :options="fileTypeOptions"
            placeholder="Any file type"
            display="chip"
            filter
            :maxSelectedLabels="3"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="recheck-category">Category</label>
          <Select
            v-model="tagId"
            inputId="recheck-category"
            :options="flat"
            optionLabel="path"
            optionValue="id"
            placeholder="Any category"
            showClear
            filter
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="recheck-after">Imported after</label>
          <DatePicker
            v-model="importedAfter"
            inputId="recheck-after"
            showIcon
            showTime
            hourFormat="24"
            showButtonBar
            dateFormat="yy-mm-dd"
            placeholder="Any import time"
          />
        </div>
        <p class="m-0">{{ previewLabel }}</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text :disabled="starting" @click="recheckOpen = false" />
        <Button label="Recheck" icon="pi pi-refresh" :disabled="!canRecheck" :loading="starting" @click="startRecheck" />
      </template>
    </Dialog>

    <div class="card">
      <div class="font-semibold text-xl mb-2">Language recheck log</div>
      <p class="text-muted-color mb-4">Click a row to see each paper.</p>
      <DataTable
        :value="jobs"
        dataKey="id"
        stripedRows
        rowHover
        paginator
        :rows="20"
        responsiveLayout="scroll"
        emptyMessage="No language rechecks yet."
        class="recheck-log"
        @row-click="onRowClick"
      >
        <Column field="started_at" header="When" sortable style="width: 11rem">
          <template #body="{ data }">{{ fmtDate(data.started_at) }}</template>
        </Column>
        <Column field="zip_filename" header="Filter" sortable />
        <Column field="status" header="Status" sortable style="width: 8rem">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column field="imported_count" header="Updated" sortable style="width: 7rem" />
        <Column field="skipped_exact_count" header="Unchanged" sortable style="width: 8rem" />
        <Column field="skipped_content_count" header="Too short" sortable style="width: 8rem" />
        <Column field="error_count" header="Errors" sortable style="width: 7rem" />
      </DataTable>
    </div>

    <Dialog
      v-model:visible="detailOpen"
      modal
      class="recheck-detail-dialog"
      :header="detail?.zip_filename || 'Recheck'"
      :style="{ width: 'min(72rem, 96vw)' }"
    >
      <div v-if="detail" class="flex flex-wrap items-center gap-3 mb-4">
        <Tag :value="detail.status" :severity="statusSeverity(detail.status)" />
        <span class="text-muted-color">
          Updated {{ detail.imported_count }} · Unchanged {{ detail.skipped_exact_count }} · Too short
          {{ detail.skipped_content_count }} · Errors {{ detail.error_count }}
        </span>
      </div>
      <Message v-if="detail?.error_message" severity="error" class="mb-4" :closable="false">
        {{ detail.error_message }}
      </Message>
      <DataTable
        :value="detail?.items || []"
        dataKey="id"
        :loading="detailLoading"
        stripedRows
        paginator
        :rows="20"
        scrollable
        emptyMessage="No papers yet."
      >
        <Column field="zip_path" header="Title">
          <template #body="{ data }">
            <router-link
              v-if="data.document_id"
              :to="`/documents/${data.document_id}`"
              class="text-primary font-medium hover:underline"
            >
              {{ data.zip_path }}
            </router-link>
            <span v-else>{{ data.zip_path }}</span>
          </template>
        </Column>
        <Column field="original_filename" header="Filename" />
        <Column field="outcome" header="Result" style="width: 9rem">
          <template #body="{ data }">
            <Tag :value="outcomeLabel(data.outcome)" :severity="outcomeSeverity(data.outcome)" />
          </template>
        </Column>
        <Column field="detail" header="Language" />
      </DataTable>
    </Dialog>
  </div>
</template>

<script setup>
import { api } from "@/api";
import { flattenTags } from "@/categoryTree";
import { fmtDate, outcomeSeverity } from "@/format";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const toast = useToast();
const error = ref("");
const jobs = ref([]);
const recheckOpen = ref(false);
const starting = ref(false);
const languages = ref([]);
const includeUnknown = ref(false);
const fileExts = ref([]);
const tagId = ref(null);
const importedAfter = ref(null);
const languageOptions = ref([]);
const fileTypeOptions = ref([]);
const flat = ref([]);
const previewCount = ref(null);
const detailOpen = ref(false);
const detail = ref(null);
const detailLoading = ref(false);
const seenStatus = new Map();
let previewToken = 0;
let stopped = false;
let polling = false;

const previewLabel = computed(() => {
  if (previewCount.value == null) return "Counting…";
  return `${previewCount.value} paper${previewCount.value === 1 ? "" : "s"}`;
});
const canRecheck = computed(() => previewCount.value > 0 && !starting.value);

function recheckBody() {
  return {
    languages: languages.value || [],
    include_unknown: includeUnknown.value,
    file_exts: fileExts.value || [],
    tag_id: tagId.value || null,
    imported_after: importedAfter.value ? importedAfter.value.toISOString() : null,
  };
}

function statusSeverity(status) {
  if (status === "failed") return "danger";
  if (status === "completed") return "success";
  if (status === "running") return "info";
  return "warn";
}

function outcomeLabel(outcome) {
  if (outcome === "updated") return "Updated";
  if (outcome === "unchanged") return "Unchanged";
  if (outcome === "too_short") return "Too short";
  if (outcome === "error") return "Error";
  return outcome || "—";
}

function stillActive(status) {
  return status === "queued" || status === "running";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function note(rows, { notify }) {
  for (const row of rows) {
    const prev = seenStatus.get(row.id);
    if (notify && prev && stillActive(prev) && row.status === "completed") {
      const checked = row.imported_count + row.skipped_exact_count + row.skipped_content_count + row.error_count;
      toast.add({
        severity: "success",
        summary: "Language recheck complete",
        detail: `${checked} papers · ${row.zip_filename}`,
        life: 4000,
      });
    }
    if (notify && prev && stillActive(prev) && row.status === "failed") {
      toast.add({
        severity: "error",
        summary: "Language recheck failed",
        detail: row.error_message || row.zip_filename,
        life: 8000,
      });
    }
    seenStatus.set(row.id, row.status);
  }
}

async function refresh({ notify }) {
  const { jobs: rows } = await api.recheckLanguageJobs();
  note(rows, { notify });
  jobs.value = rows;
  if (detailOpen.value && detail.value) {
    const row = rows.find((item) => item.id === detail.value.id);
    if (row && (stillActive(row.status) || detail.value.status !== row.status)) {
      detail.value = await api.importJob(row.id);
    }
  }
  return rows.some((row) => stillActive(row.status));
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    while (!stopped && (await refresh({ notify: true }))) {
      await sleep(1500);
    }
  } catch (e) {
    if (!stopped) error.value = e.message;
  } finally {
    polling = false;
  }
}

async function openRecheck() {
  recheckOpen.value = true;
  error.value = "";
  try {
    const [langs, types, tree] = await Promise.all([api.languages(), api.fileTypes(), api.tree()]);
    languageOptions.value = langs.languages || [];
    fileTypeOptions.value = types.file_types || [];
    flat.value = flattenTags(tree.tree || []);
  } catch (e) {
    error.value = e.message;
  }
}

async function refreshPreview() {
  const token = ++previewToken;
  if (!recheckOpen.value) {
    previewCount.value = null;
    return;
  }
  try {
    const data = await api.recheckLanguagePreview(recheckBody());
    if (token === previewToken) previewCount.value = data.count;
  } catch (e) {
    if (token !== previewToken) return;
    previewCount.value = null;
    error.value = e.message;
  }
}

async function startRecheck() {
  starting.value = true;
  error.value = "";
  try {
    await api.recheckLanguage(recheckBody());
    recheckOpen.value = false;
    toast.add({ severity: "success", summary: "Language recheck queued", life: 3000 });
    await refresh({ notify: false });
    if (jobs.value.some((job) => stillActive(job.status))) await poll();
  } catch (e) {
    let message = e.message;
    try {
      const parsed = JSON.parse(message);
      if (parsed.detail) message = String(parsed.detail);
    } catch {
      /* response was not JSON */
    }
    error.value = message;
    toast.add({ severity: "error", summary: "Recheck failed", detail: message, life: 6000 });
  } finally {
    starting.value = false;
  }
}

async function onRowClick(event) {
  const row = event.data;
  if (!row) return;
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = { ...row, items: [] };
  try {
    detail.value = await api.importJob(row.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    detailLoading.value = false;
  }
}

watch(
  () => [
    recheckOpen.value,
    (languages.value || []).join("\n"),
    includeUnknown.value,
    (fileExts.value || []).join("\n"),
    tagId.value || "",
    importedAfter.value?.toISOString() || "",
  ],
  refreshPreview,
);

onMounted(async () => {
  try {
    const active = await refresh({ notify: false });
    if (active) await poll();
  } catch (e) {
    error.value = e.message;
  }
});

onUnmounted(() => {
  stopped = true;
});
</script>

<style scoped>
:deep(.recheck-log .p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>

<style>
.recheck-detail-dialog {
  max-width: 96vw;
  overflow: hidden;
}

.recheck-detail-dialog .p-dialog-content {
  min-width: 0;
  overflow-x: hidden;
}

.recheck-detail-dialog .p-datatable {
  min-width: 0;
}

.recheck-detail-dialog .p-datatable-table {
  width: max-content;
  min-width: 100%;
}

.recheck-detail-dialog .p-datatable-thead > tr > th,
.recheck-detail-dialog .p-datatable-tbody > tr > td {
  white-space: nowrap;
}
</style>
