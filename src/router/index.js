import AppLayout from "@/layout/AppLayout.vue";
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: AppLayout,
      children: [
        {
          path: "",
          name: "library",
          component: () => import("@/views/Library.vue"),
        },
        {
          path: "upload",
          name: "upload",
          component: () => import("@/views/Upload.vue"),
        },
        {
          path: "documents/:id",
          name: "document",
          component: () => import("@/views/Document.vue"),
        },
        {
          path: "exports",
          name: "exports",
          component: () => import("@/views/Exports.vue"),
        },
        {
          path: "categories",
          name: "categories",
          component: () => import("@/views/Categories.vue"),
        },
        {
          path: "utils",
          name: "utils",
          component: () => import("@/views/Utils.vue"),
        },
      ],
    },
  ],
});

export default router;
