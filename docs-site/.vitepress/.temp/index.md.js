import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Notely — Desktop Markdown Notes","description":"Notely is a desktop Markdown notes app with Git version control, AI writing assistance, and peer-to-peer sync. Works offline. Runs on Windows.","frontmatter":{"layout":"home","title":"Notely — Desktop Markdown Notes","description":"Notely is a desktop Markdown notes app with Git version control, AI writing assistance, and peer-to-peer sync. Works offline. Runs on Windows.","hero":{"name":"Notely","text":"Write. Organize. Remember.","tagline":"A desktop Markdown notes app with Git version control, AI assistance, and offline-first sync.","image":{"src":"/assets/icon.png","alt":"Notely"},"actions":[{"theme":"brand","text":"💻 Download for Windows","link":"https://github.com/WGLabz/notely/releases/latest"},{"theme":"alt","text":"🚀 Getting Started","link":"/getting-started/"},{"theme":"alt","text":"📚 All Documentation","link":"/getting-started/"}]},"features":[{"icon":"📝","title":"Markdown Editor","details":"Edit, Split, and Preview modes. Toolbar shortcuts, inline table editor, code block formatting, Mermaid and Excalidraw diagrams."},{"icon":"🌿","title":"Git Version Control","details":"Native Git integration. Commit, browse history, compare diffs, restore notes, manage branches — all from inside the app."},{"icon":"🤖","title":"AI Writing Assistant","details":"AI chat, AI palette actions, semantic search, and relationship graph powered by your choice of AI provider."},{"icon":"🔍","title":"Powerful Search","details":"Global search across all notes with regex support, code-block filtering, and meaning-based results when AI is configured."},{"icon":"🔒","title":"Works Offline","details":"All core features work without internet. Your notes stay on your device in plain Markdown files."},{"icon":"🔄","title":"P2P Sync","details":"Sync notes across devices over your local network using encrypted peer-to-peer pairing — no cloud required."},{"icon":"📦","title":"Export / Import Note Packages","details":"Bundle notes with all linked assets into an encrypted, integrity-checked `.note` file. Share with others and import directly into any Notely workspace."}]},"headers":[],"relativePath":"index.md","filePath":"index.md","lastUpdated":1784310121000}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
