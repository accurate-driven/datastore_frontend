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
        <Column header="Translation">
          <template #body="{ node }">
            {{ languageId ? node.data.translations?.[languageId] || "—" : "—" }}
          </template>
        </Column>
      </TreeTable>
    </div>

    <div class="card">
      <div class="font-semibold text-xl mb-2">Second language</div>
      <p class="text-muted-color mb-4">
        Optional. A chosen language makes export folders Main(translation). The category name in the library stays the same.
      </p>
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <InputText v-model="languageName" placeholder="Language name" @keyup.enter="addLanguage" />
          <Button label="Add language" icon="pi pi-plus" :disabled="!languageName.trim()" @click="addLanguage" />
        </div>
        <div v-if="languages.length" class="flex flex-col gap-2">
          <div v-for="lang in languages" :key="lang.id" class="flex items-center justify-between gap-2">
            <span>{{ lang.name }}</span>
            <Button icon="pi pi-trash" severity="danger" text @click="removeLanguage(lang)" />
          </div>
        </div>
        <Select
          v-model="languageId"
          :options="languages"
          optionLabel="name"
          optionValue="id"
          placeholder="Pick a language to edit"
          showClear
        />
        <InputText
          v-model="translationName"
          placeholder="Translated folder name"
          :disabled="!languageId || !editId"
        />
        <Button
          label="Save translation"
          icon="pi pi-language"
          :disabled="!languageId || !editId"
          @click="saveTranslation"
        />
      </div>
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
const languages = ref([]);
const languageId = ref(null);
const languageName = ref("");
const translationName = ref("");

const tableNodes = computed(() => toTreeTable(tree.value));
const flat = computed(() => flattenTags(tree.value));

watch(selectionKeys, (keys) => {
  const id = selectedKey(keys);
  if (id) editId.value = id;
});

watch([languageId, editId], syncTranslation);

function syncTranslation() {
  const tag = flat.value.find((t) => t.id === editId.value);
  translationName.value = (languageId.value && tag?.translations?.[languageId.value]) || "";
}

async function loadLanguages() {
  const data = await api.exportLanguages();
  languages.value = data.languages || [];
  if (languageId.value && !languages.value.some((lang) => lang.id === languageId.value)) {
    languageId.value = null;
  }
}

async function load() {
  const data = await api.tree();
  tree.value = data.tree || [];
  expandedKeys.value = collectKeys(tableNodes.value);
  if (flat.value[0]) {
    editId.value = editId.value || flat.value[0].id;
    src.value = src.value || flat.value[0].id;
    dst.value = dst.value || flat.value[0].id;
  }
  syncTranslation();
}

async function addLanguage() {
  const name = languageName.value.trim();
  if (!name) return;
  error.value = "";
  try {
    const created = await api.addExportLanguage(name);
    languageName.value = "";
    languageId.value = created.id;
    toast.add({ severity: "success", summary: "Language added", life: 3000 });
    await loadLanguages();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Could not add language", detail: e.message, life: 6000 });
  }
}

function removeLanguage(lang) {
  confirm.require({
    header: "Delete language",
    message: `Delete ${lang.name}? Its folder translations are removed. Category names stay.`,
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: async () => {
      error.value = "";
      try {
        await api.deleteExportLanguage(lang.id);
        if (languageId.value === lang.id) languageId.value = null;
        toast.add({ severity: "success", summary: "Language deleted", life: 3000 });
        await loadLanguages();
        await load();
      } catch (e) {
        error.value = e.message;
        toast.add({ severity: "error", summary: "Delete failed", detail: e.message, life: 6000 });
      }
    },
  });
}

async function saveTranslation() {
  error.value = "";
  try {
    await api.setTranslation(editId.value, languageId.value, translationName.value);
    toast.add({ severity: "success", summary: "Translation saved", life: 3000 });
    await load();
  } catch (e) {
    error.value = e.message;
    toast.add({ severity: "error", summary: "Save failed", detail: e.message, life: 6000 });
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
    await Promise.all([load(), loadLanguages()]);
  } catch (e) {
    error.value = e.message;
  }
});
</script>
