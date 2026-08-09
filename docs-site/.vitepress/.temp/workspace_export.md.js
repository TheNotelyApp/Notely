import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Exporting Workspaces","description":"Export your workspace as a zip archive containing raw markdown, PDFs, or a built website package.","frontmatter":{"title":"Exporting Workspaces","description":"Export your workspace as a zip archive containing raw markdown, PDFs, or a built website package.","keywords":"export, zip, backup, pdf bundle, web format","category":"Workspace"},"headers":[],"relativePath":"workspace/export.md","filePath":"workspace/export.md","lastUpdated":1786163747000}');
const _sfc_main = { name: "workspace/export.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="export" tabindex="-1">Export <a class="header-anchor" href="#export" aria-label="Permalink to &quot;Export&quot;">​</a></h1><p>Notely allows you to bundle and export your entire workspace (or specific selections) as a ZIP archive.</p><h2 id="_1-export-formats" tabindex="-1">1. Export Formats <a class="header-anchor" href="#_1-export-formats" aria-label="Permalink to &quot;1. Export Formats&quot;">​</a></h2><p>Open the export window from <strong>File → Export Workspace as Zip</strong>:</p><ul><li><strong>Notes As-Is</strong>: Bundles your raw Markdown files and the <code>assets/</code> directory. Perfect for backups or migrating to another Markdown editor (like Obsidian).</li><li><strong>PDF-Only</strong>: Compiles all notes into formatted PDF documents, placing them inside a structured ZIP. Useful for offline reading or client deliverables.</li><li><strong>Web Format</strong>: Generates a static HTML website from your notes, packaged inside a ZIP. You can host this static folder on services like GitHub Pages or Netlify.</li></ul><hr><h2 id="_2-advanced-options" tabindex="-1">2. Advanced Options <a class="header-anchor" href="#_2-advanced-options" aria-label="Permalink to &quot;2. Advanced Options&quot;">​</a></h2><ul><li><strong>App Data Toggle</strong>: Choose whether to include the <code>.notes-app</code> support folder (containing version control commits and metadata). Recommended to leave disabled unless creating full recovery backups.</li><li><strong>Default Location</strong>: All exported workspace archives default directly to your system <strong>Downloads</strong> directory (<code>~/Downloads</code>).</li><li><strong>History Tracking</strong>: View and manage all past workspace exports anytime via <strong>Workspace → Downloads &amp; Export History</strong> (<code>Ctrl/Cmd + J</code>).</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("workspace/export.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const _export = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  _export as default
};
