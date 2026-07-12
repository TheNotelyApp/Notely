<template>
  <DefaultTheme.Layout />
</template>

<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import { useRoute } from "vitepress";

const route = useRoute();
</script>
