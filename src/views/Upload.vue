<template>
  <div>
    <div class="drop" @dragover.prevent @drop.prevent="onDrop">
      <p>Drop a zip here. Folders inside are stored as original paths, not categories.</p>
      <input type="file" accept=".zip" @change="onPick" />
    </div>
    <p v-if="busy">Ingesting… this can take a while if Ollama is classifying.</p>
    <p v-if="error" class="warn">{{ error }}</p>
    <div v-if="job">
      <h2>{{ job.zip_filename }}</h2>
      <p class="muted">
        Ingested {{ job.ingested_count }} · skipped exact {{ job.skipped_exact_count }} ·
        skipped same content {{ job.skipped_content_count }} · uncategorized
        {{ job.uncategorized_count }}
      </p>
      <table>
        <thead>
          <tr>
            <th>Original zip path (not category)</th>
            <th>Filename</th>
            <th>Result</th>
            <th>Assigned category</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in job.items" :key="item.id || item.zip_path">
            <td>{{ item.zip_path }}</td>
            <td>{{ item.original_filename }}</td>
            <td><span class="pill">{{ item.outcome }}</span></td>
            <td>
              <RouterLink v-if="item.document_id" :to="`/documents/${item.document_id}`">
                {{ item.category_path || "—" }}
              </RouterLink>
              <span v-else>{{ item.category_path || item.detail }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { api } from "../api";

const job = ref(null);
const busy = ref(false);
const error = ref("");

async function send(file) {
  error.value = "";
  busy.value = true;
  try {
    job.value = await api.ingest(file);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function onPick(e) {
  const f = e.target.files?.[0];
  if (f) send(f);
}
function onDrop(e) {
  const f = e.dataTransfer.files?.[0];
  if (f) send(f);
}
</script>
