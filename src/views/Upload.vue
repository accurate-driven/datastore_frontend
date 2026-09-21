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
      <div v-if="busy" class="flex items-center gap-3 mt-4">
        <ProgressSpinner style="width: 2rem; height: 2rem" strokeWidth="4" />
        <span>Ingesting… this can take a while if Ollama is classifying.</span>
      </div>
      <Message v-if="error" severity="error" class="mt-4" :closable="false">{{ error }}</Message>
    </div>

    <template v-if="job">
      <div class="grid grid-cols-12 gap-4 mb-4">
        <div class="col-span-6 md:col-span-3">
          <div class="card mb-0">
            <span class="text-muted-color">Ingested</span>
            <div class="text-2xl font-bold">{{ job.ingested_count }}</div>
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
        <div class="font-semibold text-xl mb-4">{{ job.zip_filename }}</div>
        <DataTable :value="job.items" dataKey="id" stripedRows paginator :rows="20" responsiveLayout="scroll">
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
import { ref } from "vue";

const toast = useToast();
const job = ref(null);
const busy = ref(false);
const error = ref("");

async function onUploader(event) {
  const file = event.files?.[0];
  if (!file) return;
  error.value = "";
  busy.value = true;
  try {
    job.value = await api.ingest(file);
    toast.add({
      severity: "success",
      summary: "Ingest complete",
      detail: job.value.zip_filename,
      life: 4000,
    });
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Ingest failed", detail: e.message, life: 8000 });
  } finally {
    busy.value = false;
    event.options?.clear?.();
  }
}
</script>
