<template>
  <div>
    <div v-for="node in nodes" :key="node.id">
      <button
        type="button"
        :class="{ active: active === node.id }"
        :style="{ paddingLeft: 8 + depth * 16 + 'px' }"
        @click="$emit('pick', node.id)"
      >
        {{ node.name }} ({{ node.document_count }})
      </button>
      <TreeNodes
        v-if="node.children?.length"
        :nodes="node.children"
        :active="active"
        :depth="depth + 1"
        @pick="$emit('pick', $event)"
      />
    </div>
  </div>
</template>

<script>
export default { name: "TreeNodes" };
</script>
<script setup>
defineProps({
  nodes: { type: Array, default: () => [] },
  active: { type: String, default: null },
  depth: { type: Number, default: 0 },
});
defineEmits(["pick"]);
</script>
