<template>
  <div>
    <h2>Export history</h2>
    <p class="muted">Each zip uses the canonical tree, not original zip folders.</p>
    <p v-if="error" class="warn">{{ error }}</p>
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Zip</th>
          <th>Files</th>
          <th>Paths in zip</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in rows" :key="e.id">
          <td>{{ e.created_at?.slice(0, 16).replace("T", " ") }}</td>
          <td>{{ e.zip_filename }}</td>
          <td>{{ e.item_count }}</td>
          <td>{{ (e.paths || []).join(", ") }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { api } from "../api";

const rows = ref([]);
const error = ref("");
onMounted(async () => {
  try {
    const data = await api.exports();
    rows.value = data.exports || [];
  } catch (e) {
    error.value = e.message;
  }
});
</script>
