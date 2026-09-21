<template>
  <div>
    <div class="card">
      <div class="font-semibold text-xl mb-2">Category tree</div>
      <p class="text-muted-color mb-4">Built from PDF content. Zip folders do not appear here.</p>
      <Message v-if="error" severity="error" class="mb-4" :closable="false">{{ error }}</Message>
      <TreeTable
        :value="tableNodes"
        v-model:selectionKeys="selectionKeys"
        v-model:expandedKeys="expandedKeys"
        selectionMode="single"
        class="w-full"
      >
        <Column field="name" header="Category" :expander="true" />
        <Column field="document_count" header="Documents" style="width: 10rem" />
      </TreeTable>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <div class="card">
          <div class="font-semibold text-xl mb-4">Rename node</div>
          <div class="flex flex-col gap-3">
            <Select v-model="editId" :options="flat" optionLabel="path" optionValue="id" placeholder="Select a node" />
            <InputText v-model="newName" placeholder="New name" />
            <Button label="Rename" icon="pi pi-pencil" :disabled="!editId || !newName" @click="rename" />
          </div>
        </div>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <div class="card">
          <div class="font-semibold text-xl mb-4">Merge source into target</div>
          <div class="flex flex-col gap-3">
            <Select v-model="src" :options="flat" optionLabel="path" optionValue="id" placeholder="Source" />
            <Select v-model="dst" :options="flat" optionLabel="path" optionValue="id" placeholder="Target" />
            <div class="flex flex-wrap gap-2">
              <Button label="Merge" icon="pi pi-sitemap" severity="warn" :disabled="!src || !dst || src === dst" @click="merge" />
              <Button label="Reclassify Uncategorized" icon="pi pi-refresh" severity="secondary" @click="reclass" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { api } from "@/api";
import { collectKeys, flattenTags, selectedKey, toTreeTable } from "@/categoryTree";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, ref, watch } from "vue";

const toast = useToast();
const confirm = useConfirm();
const tree = ref([]);
const error = ref("");
const editId = ref(null);
const newName = ref("");
const src = ref(null);
const dst = ref(null);
const selectionKeys = ref({});
const expandedKeys = ref({});

const tableNodes = computed(() => toTreeTable(tree.value));
const flat = computed(() => flattenTags(tree.value));

watch(selectionKeys, (keys) => {
  const id = selectedKey(keys);
  if (id) editId.value = id;
});

async function load() {
  const data = await api.tree();
  tree.value = data.tree || [];
  expandedKeys.value = collectKeys(tableNodes.value);
  if (flat.value[0]) {
    editId.value = editId.value || flat.value[0].id;
    src.value = src.value || flat.value[0].id;
    dst.value = dst.value || flat.value[0].id;
  }
}

async function rename() {
  error.value = "";
  try {
    await api.patchTag(editId.value, { name: newName.value });
    newName.value = "";
    toast.add({ severity: "success", summary: "Renamed", life: 3000 });
    await load();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Rename failed", detail: e.message, life: 6000 });
  }
}

function merge() {
  confirm.require({
    header: "Merge categories",
    message: "Merge source into target? The source node is deleted and its papers move to the target.",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-warning",
    accept: async () => {
      error.value = "";
      try {
        await api.mergeTags(src.value, dst.value);
        toast.add({ severity: "success", summary: "Merged", life: 3000 });
        await load();
      } catch (e) {
        error.value = e.message;
        toast.add({ severity: "error", summary: "Merge failed", detail: e.message, life: 6000 });
      }
    },
  });
}

async function reclass() {
  error.value = "";
  try {
    const data = await api.reclassifyUncat();
    toast.add({
      severity: "success",
      summary: "Reclassify finished",
      detail: `${data.reclassified ?? 0} papers`,
      life: 4000,
    });
    await load();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Reclassify failed", detail: e.message, life: 6000 });
  }
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
