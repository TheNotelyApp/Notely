import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Setting Up Git in Notely","description":"Initialize a new Git repository or clone an existing one for your workspace in Notely.","frontmatter":{"title":"Setting Up Git in Notely","description":"Initialize a new Git repository or clone an existing one for your workspace in Notely.","keywords":"git init, git clone, git config, credentials, gitignore","category":"Git"},"headers":[],"relativePath":"git/setup.md","filePath":"git/setup.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "git/setup.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="git-setup-repository" tabindex="-1">Git Setup &amp; Repository <a class="header-anchor" href="#git-setup-repository" aria-label="Permalink to &quot;Git Setup &amp; Repository&quot;">​</a></h1><p>Before tracking changes, your workspace folder must be configured as a Git repository.</p><h2 id="_1-initializing-a-repository" tabindex="-1">1. Initializing a Repository <a class="header-anchor" href="#_1-initializing-a-repository" aria-label="Permalink to &quot;1. Initializing a Repository&quot;">​</a></h2><p>If your opened workspace folder is not currently a Git repository:</p><ol><li>Open the Version Control view or click the Git status bar badge.</li><li>Select <strong>Initialize Git Repository</strong>.</li><li>Notely will run <code>git init</code> and create a local repository structure.</li></ol><hr><h2 id="_2-cloning-a-repository" tabindex="-1">2. Cloning a Repository <a class="header-anchor" href="#_2-cloning-a-repository" aria-label="Permalink to &quot;2. Cloning a Repository&quot;">​</a></h2><p>To import an existing notes repository:</p><ol><li>Open the workspace dialogue on launch.</li><li>Select <strong>Clone Git Repository</strong>.</li><li>Input the repository HTTPS URL and destination folder.</li><li>Input credentials if the repository is private.</li></ol><hr><h2 id="_3-ignoring-app-metadata-notes-app" tabindex="-1">3. Ignoring App Metadata (<code>.notes-app</code>) <a class="header-anchor" href="#_3-ignoring-app-metadata-notes-app" aria-label="Permalink to &quot;3. Ignoring App Metadata (\`.notes-app\`)&quot;">​</a></h2><p>Notely stores internal editor states, annotations, and caches in the <code>.notes-app</code> subdirectory. It is recommended to keep this out of version control:</p><ul><li>In <strong>Settings → Git Safety</strong>, enable <strong>Ignore .notes-app</strong>.</li><li>Notely will automatically append <code>.notes-app/</code> to your workspace <code>.gitignore</code> file.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("git/setup.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const setup = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  setup as default
};
