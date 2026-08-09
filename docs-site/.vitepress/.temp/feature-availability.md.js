import { resolveComponent, useSSRContext } from "vue";
import { ssrRenderAttrs, ssrRenderComponent } from "vue/server-renderer";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Feature Availability Matrix","description":"View offline compatibility and network requirements for Notely features.","frontmatter":{"title":"Feature Availability Matrix","description":"View offline compatibility and network requirements for Notely features.","keywords":"internet required, offline support, offline setup, capabilities","category":"Reference"},"headers":[],"relativePath":"feature-availability.md","filePath":"feature-availability.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "feature-availability.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  const _component_FeatureMatrix = resolveComponent("FeatureMatrix");
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="feature-availability" tabindex="-1">Feature Availability <a class="header-anchor" href="#feature-availability" aria-label="Permalink to &quot;Feature Availability&quot;">​</a></h1><p>The matrix below details which features run entirely offline, which require local network settings, and which require internet access.</p>`);
  _push(ssrRenderComponent(_component_FeatureMatrix, { features: [
    { feature: "Notes Create/Edit", available: true, setup: "No", internet: false },
    { feature: "Folder Organization", available: true, setup: "No", internet: false },
    { feature: "Edit/Split/Preview Modes", available: true, setup: "No", internet: false },
    { feature: "Markdown Validation", available: true, setup: "No", internet: false },
    { feature: "Typo Checking", available: true, setup: "No", internet: false },
    { feature: "Global Search", available: true, setup: "No", internet: false },
    { feature: "Help Center", available: true, setup: "No", internet: false },
    { feature: "Tasks Dashboard", available: true, setup: "No", internet: false },
    { feature: "Version History (Git)", available: true, setup: "No", internet: false },
    { feature: "Media Library", available: true, setup: "No", internet: false },
    { feature: "Embedded Terminal", available: true, setup: "No", internet: false },
    { feature: "Screen Capture (Windows)", available: true, setup: "No", internet: false },
    { feature: "Mermaid Diagrams", available: true, setup: "No", internet: false },
    { feature: "Excalidraw Diagrams", available: true, setup: "No", internet: false },
    { feature: "Workspace Graph", available: true, setup: "No", internet: false },
    { feature: "Sync with other devices", available: false, setup: "Pair Trusted Devices", internet: "Local network" },
    { feature: "AI Chat & Rewriting", available: false, setup: "Setup AI Provider", internet: true },
    { feature: "Meaning-based Search", available: false, setup: "Setup AI Provider", internet: true },
    { feature: "Graph Clustering", available: false, setup: "Setup AI Provider", internet: true }
  ] }, null, _parent));
  _push(`</div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("feature-availability.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const featureAvailability = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  featureAvailability as default
};
