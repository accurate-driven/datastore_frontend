<template>
  <div class="card">
    <div class="font-semibold text-xl mb-2">Export history</div>
    <p class="text-muted-color mb-4">Each zip uses the canonical tree, not original zip folders.</p>
    <Message v-if="error" severity="error" class="mb-4" :closable="false">{{ error }}</Message>
    <DataTable
      :value="rows"
      dataKey="id"
      :loading="loading"
      stripedRows
      paginator
      :rows="20"
      emptyMessage="No exports yet."
    >
      <Column header="When" sortable field="created_at">
        <template #body="{ data }">
          {{ fmtDate(data.created_at) }}
        </template>
      </Column>
      <Column field="zip_filename" header="Zip" sortable />
      <Column field="item_count" header="Files" sortable style="width: 8rem" />
      <Column header="Paths in zip">
        <template #body="{ data }">
          {{ (data.paths || []).join(", ") }}
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { api } from "@/api";
import { fmtDate } from "@/format";
import { onMounted, ref } from "vue";

const rows = ref([]);
const error = ref("");
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    const data = await api.exports();
    rows.value = data.exports || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>
