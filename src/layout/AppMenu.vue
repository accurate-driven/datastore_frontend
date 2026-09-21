<script setup>
import { ref } from "vue";
import AppMenuItem from "./AppMenuItem.vue";

const model = ref([
  {
    label: "Library",
    items: [
      { label: "Papers", icon: "pi pi-fw pi-book", to: "/" },
      { label: "Upload", icon: "pi pi-fw pi-upload", to: "/upload" },
      { label: "Exports", icon: "pi pi-fw pi-download", to: "/exports" },
    ],
  },
  {
    label: "Organize",
    items: [{ label: "Categories", icon: "pi pi-fw pi-sitemap", to: "/categories" }],
  },
]);
</script>

<template>
  <ul class="layout-menu">
    <template v-for="(item, i) in model" :key="item.label">
      <app-menu-item v-if="!item.separator" :item="item" :index="i" />
      <li v-if="item.separator" class="menu-separator" />
    </template>
  </ul>
</template>
