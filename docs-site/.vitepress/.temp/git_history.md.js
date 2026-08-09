import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Note History and Restores","description":"Browse historical versions of notes, compare visual diffs, and restore earlier revisions.","frontmatter":{"title":"Note History and Restores","description":"Browse historical versions of notes, compare visual diffs, and restore earlier revisions.","keywords":"history, rollback, diff viewer, git history, versions, compare","category":"Git"},"headers":[],"relativePath":"git/history.md","filePath":"git/history.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "git/history.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="history-restore" tabindex="-1">History &amp; Restore <a class="header-anchor" href="#history-restore" aria-label="Permalink to &quot;History &amp; Restore&quot;">​</a></h1><p>Notely lets you browse the full commit history of any note and compare versions side-by-side.</p><h2 id="_1-opening-revision-history" tabindex="-1">1. Opening Revision History <a class="header-anchor" href="#_1-opening-revision-history" aria-label="Permalink to &quot;1. Opening Revision History&quot;">​</a></h2><ul><li>Press <strong><code>Ctrl + Shift + H</code></strong> or click the <strong>History</strong> button in the note top bar.</li><li>The history sidebar will slide out, displaying a timeline of all commits touching the current note.</li></ul><hr><h2 id="_2-comparing-diffs" tabindex="-1">2. Comparing Diffs <a class="header-anchor" href="#_2-comparing-diffs" aria-label="Permalink to &quot;2. Comparing Diffs&quot;">​</a></h2><p>Click on any commit in the history timeline to open the <strong>Diff Viewer</strong>:</p><ul><li><strong>Code View</strong>: Standard text-based differences, highlighting added and removed lines.</li><li><strong>Markdown Preview Mode</strong>: Shows a visual, word-level comparison of the rendered document, marking insertions in green and deletions in red.</li></ul><hr><h2 id="_3-restoring-notes" tabindex="-1">3. Restoring Notes <a class="header-anchor" href="#_3-restoring-notes" aria-label="Permalink to &quot;3. Restoring Notes&quot;">​</a></h2><p>To restore the note to a previous revision:</p><ol><li>Select the target commit in the history timeline.</li><li>Verify the content in the diff viewer.</li><li>Click the <strong>Restore</strong> button.</li><li>Notely will replace the active note contents with the selected version, placing a new restoration commit in your history.</li></ol></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("git/history.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const history = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  history as default
};
