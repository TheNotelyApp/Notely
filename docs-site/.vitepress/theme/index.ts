import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./tokens.css";
import "./theme.css";
import NotelyCallout from "./components/NotelyCallout.vue";
import ShortcutTable from "./components/ShortcutTable.vue";
import FeatureMatrix from "./components/FeatureMatrix.vue";
import HomeLayout from "./HomeLayout.vue";

export default {
  extends: DefaultTheme,
  Layout: HomeLayout,
  enhanceApp({ app }) {
    app.component("NotelyCallout", NotelyCallout);
    app.component("ShortcutTable", ShortcutTable);
    app.component("FeatureMatrix", FeatureMatrix);
  },
} satisfies Theme;
