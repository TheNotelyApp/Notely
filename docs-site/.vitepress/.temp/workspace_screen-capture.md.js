import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Screen Capture","description":"Capture areas of your screen and insert them directly into notes (Windows).","frontmatter":{"title":"Screen Capture","description":"Capture areas of your screen and insert them directly into notes (Windows).","keywords":"screen capture, screenshot, windows snip, review mode, auto insert","category":"Workspace"},"headers":[],"relativePath":"workspace/screen-capture.md","filePath":"workspace/screen-capture.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "workspace/screen-capture.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="screen-capture" tabindex="-1">Screen Capture <a class="header-anchor" href="#screen-capture" aria-label="Permalink to &quot;Screen Capture&quot;">​</a></h1><p>On Windows systems, Notely supports direct screen capture, allowing you to snip visual areas and paste them instantly into your active note.</p><h2 id="_1-how-to-capture" tabindex="-1">1. How to Capture <a class="header-anchor" href="#_1-how-to-capture" aria-label="Permalink to &quot;1. How to Capture&quot;">​</a></h2><ol><li>Position your cursor in the editor where you want the image link placed.</li><li>Click the toolbar <strong>📷 Capture</strong> button or press <strong><code>Ctrl + Shift + S</code></strong>.</li><li>Select the target area using the Windows snip overlay.</li></ol><hr><h2 id="_2-capture-modes" tabindex="-1">2. Capture Modes <a class="header-anchor" href="#_2-capture-modes" aria-label="Permalink to &quot;2. Capture Modes&quot;">​</a></h2><p>Configure capture behavior in <strong>Settings → Screen Capture</strong>:</p><ul><li><strong>Auto Insert</strong>: Inserts the captured image immediately as a Markdown reference. The file is saved automatically under <code>assets/</code>.</li><li><strong>Review Before Insert</strong>: Opens a review editor where you can crop, annotate, or rename the captured image before saving.</li></ul><hr><h2 id="_3-toolbar-indicators" tabindex="-1">3. Toolbar Indicators <a class="header-anchor" href="#_3-toolbar-indicators" aria-label="Permalink to &quot;3. Toolbar Indicators&quot;">​</a></h2><p>The toolbar icon shows the current mode:</p><ul><li><strong><code>📷 A</code></strong>: Auto Insert mode active.</li><li><strong><code>📷 R</code></strong>: Review Before Insert mode active.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("workspace/screen-capture.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const screenCapture = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  screenCapture as default
};
