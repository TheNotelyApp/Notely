import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"License & Third-Party Notices","description":"Creative Commons License terms and third-party open source notices.","frontmatter":{"title":"License & Third-Party Notices","description":"Creative Commons License terms and third-party open source notices.","keywords":"license, cc-by-nc, legal, third party","category":"Developer"},"headers":[],"relativePath":"license.md","filePath":"license.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "license.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="license" tabindex="-1">License <a class="header-anchor" href="#license" aria-label="Permalink to &quot;License&quot;">​</a></h1><p>Notely is released under the <strong>Creative Commons Attribution-NonCommercial 4.0 International (CC-BY-NC-4.0)</strong> license.</p><h2 id="attribution-noncommercial-4-0-international" tabindex="-1">Attribution-NonCommercial 4.0 International <a class="header-anchor" href="#attribution-noncommercial-4-0-international" aria-label="Permalink to &quot;Attribution-NonCommercial 4.0 International&quot;">​</a></h2><p>Under these terms, you are free to:</p><ul><li><strong>Share</strong>: Copy and redistribute the material in any medium or format.</li><li><strong>Adapt</strong>: Remix, transform, and build upon the material.</li></ul><p>Under the following conditions:</p><ul><li><strong>Attribution</strong>: You must give appropriate credit and indicate if changes were made.</li><li><strong>NonCommercial</strong>: You may not use the material for commercial purposes.</li></ul><p>→ For full terms, see the <a href="https://github.com/WGLabz/notely/blob/main/LICENSE" target="_blank" rel="noreferrer">LICENSE file</a> in the repository.</p><hr><h2 id="third-party-open-source-software" tabindex="-1">Third-Party Open Source Software <a class="header-anchor" href="#third-party-open-source-software" aria-label="Permalink to &quot;Third-Party Open Source Software&quot;">​</a></h2><p>Notely is built using open-source libraries. Key packages include:</p><ul><li><strong>Electron</strong>: System integration framework.</li><li><strong>React</strong>: Frontend UI runtime.</li><li><strong>CodeMirror</strong>: Code and Markdown editing canvas.</li><li><strong>Simple-Git</strong>: Local Git wrapper.</li><li><strong>VitePress</strong>: Documentation toolchain.</li></ul><p>Refer to <code>THIRD_PARTY_NOTICES.txt</code> in the app package for full license transcripts of all dependencies.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("license.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const license = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  license as default
};
