<template>
  <div>
    <div class="card">
      <div class="font-semibold text-xl mb-2">Upload</div>
      <p class="text-muted-color mb-4">
        Drop a zip here. Folders inside are stored as original paths, not categories.
      </p>
      <FileUpload
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
      <div v-if="busy" class="flex items-center justify-start gap-3 mt-4">
        <ProgressSpinner class="shrink-0" style="width: 2rem; height: 2rem; margin: 0" strokeWidth="4" />
        <div class="min-w-0">
          <div v-if="job" class="font-medium truncate">{{ job.zip_filename }}</div>
          <span class="text-muted-color">Importing… this can take a while if Ollama is classifying.</span>
        </div>
      </div>
      <Message v-if="error" severity="error" class="mt-4" :closable="false">{{ error }}</Message>
    </div>

    <template v-if="job">
      <div class="grid grid-cols-12 gap-4 mb-4">
        <div class="col-span-6 md:col-span-3">
          <div class="card mb-0">
            <span class="text-muted-color">Imported</span>
            <div class="text-2xl font-bold">{{ job.imported_count }}</div>
          </div>
        </div>
        <div class="col-span-6 md:col-span-3">
          <div class="card mb-0">
            <span class="text-muted-color">Skipped exact</span>
            <div class="text-2xl font-bold">{{ job.skipped_exact_count }}</div>
          </div>
        </div>
        <div class="col-span-6 md:col-span-3">
          <div class="card mb-0">
            <span class="text-muted-color">Same content</span>
            <div class="text-2xl font-bold">{{ job.skipped_content_count }}</div>
          </div>
        </div>
        <div class="col-span-6 md:col-span-3">
          <div class="card mb-0">
            <span class="text-muted-color">Uncategorized</span>
            <div class="text-2xl font-bold">{{ job.uncategorized_count }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-4">
          <div class="font-semibold text-xl">{{ job.zip_filename }}</div>
          <Tag :value="job.status" :severity="job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'success' : 'warn'" />
        </div>
        <DataTable :value="job.items || []" dataKey="id" stripedRows paginator :rows="20" responsiveLayout="scroll">
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
      </div>
    </template>
  </div>
</template>

<script setup>
import { api } from "@/api";
import { outcomeSeverity } from "@/format";
import { useToast } from "primevue/usetoast";
import { onMounted, onUnmounted, ref } from "vue";

const toast = useToast();
const job = ref(null);
const busy = ref(false);
const error = ref("");
let watchGen = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stillActive(status) {
  return status === "queued" || status === "running";
}

async function watchJob(id, { notify } = {}) {
  const gen = ++watchGen;
  busy.value = true;
  error.value = "";
  try {
    let current = await api.importJob(id);
    if (gen !== watchGen) return;
    job.value = current;
    while (stillActive(current.status) && gen === watchGen) {
      await sleep(1500);
      if (gen !== watchGen) return;
      current = await api.importJob(id);
      job.value = current;
    }
    if (gen !== watchGen) return;
    if (current.status === "failed") {
      throw new Error(current.error_message || "Import failed");
    }
    if (notify) {
      toast.add({
        severity: "success",
        summary: "Import complete",
        detail: current.zip_filename,
        life: 4000,
      });
    }
  } catch (e) {
    if (gen !== watchGen) return;
    error.value = e.message;
    toast.add({ severity: "error", summary: "Import failed", detail: e.message, life: 8000 });
  } finally {
    if (gen === watchGen) busy.value = false;
  }
}

async function onUploader(event) {
  const file = event.files?.[0];
  if (!file) return;
  try {
    const current = await api.importZip(file);
    job.value = current;
    await watchJob(current.id, { notify: true });
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Import failed", detail: e.message, life: 8000 });
  } finally {
    event.options?.clear?.();
  }
}

onMounted(async () => {
  try {
    const { jobs } = await api.importJobs();
    const active = jobs.find((item) => stillActive(item.status));
    const latest = active || jobs[0];
    if (!latest) return;
    if (stillActive(latest.status)) {
      await watchJob(latest.id, { notify: true });
      return;
    }
    job.value = await api.importJob(latest.id);
  } catch (e) {
    error.value = e.message;
  }
});

onUnmounted(() => {
  watchGen += 1;
});
</script>

<style scoped>
/* Zip blobs are not images. PrimeVue still renders them as <img alt="filename">,
   so the browser shows a broken thumbnail and wraps the filename inside it. */
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
</style>
