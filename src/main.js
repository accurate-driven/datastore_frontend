import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Library from "./views/Library.vue";
import Upload from "./views/Upload.vue";
import Document from "./views/Document.vue";
import Exports from "./views/Exports.vue";
import Categories from "./views/Categories.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Library },
    { path: "/upload", component: Upload },
    { path: "/documents/:id", component: Document },
    { path: "/exports", component: Exports },
    { path: "/categories", component: Categories },
  ],
});

createApp(App).use(createPinia()).use(router).mount("#app");
