import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Committing and Staging Changes","description":"Learn how to stage modified notes and write commits in Notely.","frontmatter":{"title":"Committing and Staging Changes","description":"Learn how to stage modified notes and write commits in Notely.","keywords":"git commit, git stage, diff, modified files","category":"Git"},"headers":[],"relativePath":"git/commit.md","filePath":"git/commit.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "git/commit.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="commit-stage" tabindex="-1">Commit &amp; Stage <a class="header-anchor" href="#commit-stage" aria-label="Permalink to &quot;Commit &amp; Stage&quot;">​</a></h1><p>To save a permanent checkpoint of your notes, you must stage and commit them.</p><h2 id="_1-staging-files" tabindex="-1">1. Staging Files <a class="header-anchor" href="#_1-staging-files" aria-label="Permalink to &quot;1. Staging Files&quot;">​</a></h2><p>When you modify or create notes, they appear under the <strong>Unstaged Changes</strong> section of the Version Control Panel:</p><ul><li><strong>Stage</strong>: Hover over a modified note and click <strong>+</strong> (Stage) to mark it ready for committing.</li><li><strong>Stage All</strong>: Click the <strong>Stage All</strong> button to stage all modified files at once.</li><li><strong>Discard</strong>: Click <strong>Discard</strong> to revert file changes back to their last committed state.</li></ul><hr><h2 id="_2-writing-a-commit" tabindex="-1">2. Writing a Commit <a class="header-anchor" href="#_2-writing-a-commit" aria-label="Permalink to &quot;2. Writing a Commit&quot;">​</a></h2><ol><li>Navigate to the commit section in the Version Control Panel.</li><li>Enter a clear, descriptive summary (e.g., <code>Update markdown tables and add screenshots</code>).</li><li>Optionally add a detailed description explaining the reasoning behind the change.</li><li>Click <strong>Commit</strong>.</li></ol><p>Once committed, these changes are logged in the local Git repository timeline.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("git/commit.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const commit = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  commit as default
};
