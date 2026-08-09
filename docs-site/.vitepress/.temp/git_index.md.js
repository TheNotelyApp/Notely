import { resolveComponent, useSSRContext } from "vue";
import { ssrRenderAttrs, ssrRenderSuspense, ssrRenderComponent } from "vue/server-renderer";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Git Version Control Overview","description":"Learn how Git is integrated into Notely to track history, commit changes, and restore notes.","frontmatter":{"title":"Git Version Control Overview","description":"Learn how Git is integrated into Notely to track history, commit changes, and restore notes.","keywords":"git, version control, revision history, commit, rollback","category":"Git"},"headers":[],"relativePath":"git/index.md","filePath":"git/index.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "git/index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  const _component_Mermaid = resolveComponent("Mermaid");
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="git-version-control" tabindex="-1">Git Version Control <a class="header-anchor" href="#git-version-control" aria-label="Permalink to &quot;Git Version Control&quot;">​</a></h1><p>Notely features a native, Git-backed version control system to track document changes. Every modification can be versioned, compared, and restored without relying on external Git tools.</p>`);
  ssrRenderSuspense(_push, {
    default: () => {
      _push(ssrRenderComponent(_component_Mermaid, {
        id: "mermaid-6",
        class: "mermaid",
        graph: "graph%20LR%0A%20%20%20%20A%5BEdit%20Note%5D%20--%3E%20B%5BStage%20Changes%5D%0A%20%20%20%20B%20--%3E%20C%5BWrite%20Commit%5D%0A%20%20%20%20C%20--%3E%20D%5BSave%20Version%5D%0A%20%20%20%20D%20--%3E%20E%5BTimeline%20History%5D%0A"
      }, null, _parent));
    },
    fallback: () => {
      _push(` Loading... `);
    },
    _: 1
  });
  _push(`<h2 id="why-git" tabindex="-1">Why Git? <a class="header-anchor" href="#why-git" aria-label="Permalink to &quot;Why Git?&quot;">​</a></h2><p>Using Git directly under the hood ensures:</p><ul><li><strong>Portability</strong>: Your note history is stored in standard Git format, meaning you can open the folder in any Git client (like GitHub Desktop or VS Code) to view the history.</li><li><strong>Precision</strong>: Fine-grained line-by-line diffs of changes.</li><li><strong>Safety</strong>: Rollback individual files or entire folders to a previous point in time.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("git/index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
