<script setup>
import AppFooter from "./AppFooter.vue";
import AppTopbar from "./AppTopbar.vue";
</script>

<template>
  <div class="layout-wrapper">
    <AppTopbar />
    <div class="layout-main-container">
      <div class="layout-main">
        <router-view />
      </div>
      <AppFooter />
    </div>
  </div>
  <Toast />
  <ConfirmDialog />
</template>
