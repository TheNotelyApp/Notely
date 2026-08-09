import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"UX Writing Guide","description":"","frontmatter":{},"headers":[],"relativePath":"ux-writing-guide.md","filePath":"ux-writing-guide.md","lastUpdated":1783014271000}');
const _sfc_main = { name: "ux-writing-guide.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="ux-writing-guide" tabindex="-1">UX Writing Guide <a class="header-anchor" href="#ux-writing-guide" aria-label="Permalink to &quot;UX Writing Guide&quot;">​</a></h1><p>Purpose: keep labels and messages consistent, clear, and action-oriented.</p><h2 id="core-rules" tabindex="-1">Core Rules <a class="header-anchor" href="#core-rules" aria-label="Permalink to &quot;Core Rules&quot;">​</a></h2><ul><li>Use sentence case for buttons, labels, and helper text.</li><li>Start actions with a verb: Open, Create, Save, Delete, Show, Hide.</li><li>Keep labels short: prefer 2 to 4 words when possible.</li><li>Use consistent nouns across UI: note, folder, workspace, command palette.</li><li>Avoid mixed casing of the same phrase (for example, &quot;AI data&quot; vs &quot;AI Data&quot;).</li></ul><h2 id="buttons-and-actions" tabindex="-1">Buttons and Actions <a class="header-anchor" href="#buttons-and-actions" aria-label="Permalink to &quot;Buttons and Actions&quot;">​</a></h2><ul><li>Primary button text: explicit outcome, e.g. &quot;Save&quot;, &quot;Export&quot;, &quot;Create note&quot;.</li><li>Secondary button text: supportive action, e.g. &quot;Close&quot;, &quot;Cancel&quot;, &quot;Show details&quot;.</li><li>Destructive actions: include object and consequence, e.g. &quot;Clear AI data&quot;.</li></ul><h2 id="empty-error-and-status-text" tabindex="-1">Empty, Error, and Status Text <a class="header-anchor" href="#empty-error-and-status-text" aria-label="Permalink to &quot;Empty, Error, and Status Text&quot;">​</a></h2><ul><li>Empty states should include a next step.</li><li>Error states should describe what failed and what to do next.</li><li>Success states should confirm completion in one short sentence.</li></ul><h2 id="examples" tabindex="-1">Examples <a class="header-anchor" href="#examples" aria-label="Permalink to &quot;Examples&quot;">​</a></h2><ul><li>Good: &quot;Search commands and actions&quot;</li><li>Good: &quot;No matching commands&quot;</li><li>Good: &quot;Connect providers, tune behavior, and manage local AI data.&quot;</li><li>Avoid: title-case fragments like &quot;Type a command or action&quot; when sentence case is used elsewhere.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("ux-writing-guide.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const uxWritingGuide = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  uxWritingGuide as default
};
