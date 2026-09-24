<template>
  <div>
    <div class="card">
      <div class="font-semibold text-xl mb-2">Upload</div>
      <p class="text-muted-color mb-4">
        Drop a zip here. Folders inside are stored as original paths, not categories.
      </p>
      <FileUpload
        ref="uploader"
        name="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        :maxFileSize="2147483648"
        :customUpload="true"
        :auto="true"
        :multiple="false"
        @uploader="onUploader"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center py-8">
            <i class="pi pi-cloud-upload text-4xl text-muted-color mb-3" />
            <span class="text-muted-color">Drag a zip here, or choose a file.</span>
          </div>
        </template>
      </FileUpload>
      <div v-if="activeJob" class="flex items-center justify-start gap-3 mt-4">
        <ProgressSpinner class="shrink-0" style="width: 2rem; height: 2rem; margin: 0" strokeWidth="4" />
        <div class="min-w-0">
          <div class="font-medium truncate">{{ activeJob.zip_filename }}</div>
          <span class="text-muted-color">{{ activeJob.status === "queued" ? "Waiting for the current import to finish." : "Importing… each new file is embedded once." }}</span>
        </div>
      </div>
      <Message v-if="error" severity="error" class="mt-4" :closable="false">{{ error }}</Message>
    </div>

    <div class="card">
      <div class="font-semibold text-xl mb-2">Upload log</div>
      <p class="text-muted-color mb-4">Click a row to see the files in that zip.</p>
      <DataTable
        :value="jobs"
        dataKey="id"
        stripedRows
        rowHover
        paginator
        :rows="20"
        responsiveLayout="scroll"
        v-model:sortField="sortField"
        v-model:sortOrder="sortOrder"
        emptyMessage="No uploads yet."
        class="upload-log"
        @row-click="onRowClick"
      >
        <Column field="started_at" header="When" sortable style="width: 11rem">
          <template #body="{ data }">{{ fmtDate(data.started_at) }}</template>
        </Column>
        <Column field="zip_filename" header="Zip" sortable />
        <Column field="status" header="Status" sortable style="width: 8rem">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column field="imported_count" header="Imported" sortable style="width: 7rem" />
        <Column field="skipped_exact_count" header="Skipped exact" sortable style="width: 8rem" />
        <Column field="skipped_content_count" header="Same content" sortable style="width: 8rem" />
        <Column field="uncategorized_count" header="Uncategorized" sortable style="width: 8rem" />
      </DataTable>
    </div>

    <Dialog
      v-model:visible="detailOpen"
      modal
      :header="detail?.zip_filename || 'Upload'"
      :style="{ width: 'min(72rem, 96vw)' }"
    >
      <div v-if="detail" class="flex flex-wrap items-center gap-3 mb-4">
        <Tag :value="detail.status" :severity="statusSeverity(detail.status)" />
        <span class="text-muted-color">
          Imported {{ detail.imported_count }} · Skipped exact {{ detail.skipped_exact_count }} · Same content
          {{ detail.skipped_content_count }} · Uncategorized {{ detail.uncategorized_count }}
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
        responsiveLayout="scroll"
        emptyMessage="No files yet."
      >
        <Column field="zip_path" header="Original zip path (not category)" />
        <Column field="original_filename" header="Filename" />
        <Column field="outcome" header="Result" style="width: 10rem">
          <template #body="{ data }">
            <Tag :value="data.outcome" :severity="outcomeSeverity(data.outcome)" />
          </template>
        </Column>
        <Column header="Assigned category">
          <template #body="{ data }">
            <router-link
              v-if="data.document_id"
              :to="`/documents/${data.document_id}`"
              class="text-primary font-medium hover:underline"
            >
              {{ data.category_path || "—" }}
            </router-link>
            <span v-else>{{ data.category_path || data.detail || "—" }}</span>
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </div>
</template>

<script setup>
import { api } from "@/api";
import { fmtDate, outcomeSeverity } from "@/format";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, onUnmounted, ref } from "vue";

const toast = useToast();
const uploader = ref(null);
const jobs = ref([]);
const sortField = ref("started_at");
const sortOrder = ref(-1);
const error = ref("");
const detailOpen = ref(false);
const detail = ref(null);
const detailLoading = ref(false);
const seenStatus = new Map();
let stopped = false;
let polling = false;

const activeJob = computed(
  () => jobs.value.find((job) => job.status === "running") || jobs.value.find((job) => job.status === "queued") || null,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stillActive(status) {
  return status === "queued" || status === "running";
}

function statusSeverity(status) {
  if (status === "failed") return "danger";
  if (status === "completed") return "success";
  if (status === "running") return "info";
  return "warn";
}

function note(rows, { notify }) {
  for (const row of rows) {
    const prev = seenStatus.get(row.id);
    if (notify && prev && stillActive(prev) && row.status === "completed") {
      toast.add({ severity: "success", summary: "Import complete", detail: row.zip_filename, life: 4000 });
    }
    if (notify && prev && stillActive(prev) && row.status === "failed") {
      toast.add({
        severity: "error",
        summary: "Import failed",
        detail: row.error_message || row.zip_filename,
        life: 8000,
      });
    }
    seenStatus.set(row.id, row.status);
  }
}

async function refresh({ notify }) {
  const { jobs: rows } = await api.importJobs();
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

async function onUploader(event) {
  const file = event.files?.[0];
  if (!file) return;
  error.value = "";
  try {
    await api.importZip(file);
    uploader.value?.clear();
    const active = await refresh({ notify: false });
    if (active) await poll();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Import failed", detail: e.message, life: 8000 });
  }
}

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
:deep(.p-fileupload-file-thumbnail) {
  display: none;
}

:deep(.p-fileupload-file)::before {
  content: "\e958";
  font-family: "primeicons";
  font-size: 1.75rem;
  line-height: 1;
  width: 2rem;
  flex-shrink: 0;
  color: var(--p-text-muted-color);
}

:deep(.upload-log .p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
