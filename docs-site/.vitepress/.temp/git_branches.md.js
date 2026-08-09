import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Branches and Remote Repositories","description":"Learn how to manage branches, stash changes, and sync with Git remotes.","frontmatter":{"title":"Branches and Remote Repositories","description":"Learn how to manage branches, stash changes, and sync with Git remotes.","keywords":"git branch, remote, push, pull, stash, origin, sync","category":"Git"},"headers":[],"relativePath":"git/branches.md","filePath":"git/branches.md","lastUpdated":1786126353000}');
const _sfc_main = { name: "git/branches.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="branches-remote" tabindex="-1">Branches &amp; Remote <a class="header-anchor" href="#branches-remote" aria-label="Permalink to &quot;Branches &amp; Remote&quot;">​</a></h1><p>For advanced collaboration, Notely supports branch switching, tag markers, and remote syncing.</p><h2 id="_1-branch-management" tabindex="-1">1. Branch Management <a class="header-anchor" href="#_1-branch-management" aria-label="Permalink to &quot;1. Branch Management&quot;">​</a></h2><p>Switch or create branches in the <strong>Branch</strong> tab of the Version Control page:</p><ul><li>Select from local branches.</li><li>Create a new branch from your current HEAD checkpoint.</li><li>Switch branches to test features or review colleagues&#39; work.</li></ul><hr><h2 id="_2-remote-synchronization-push-pull" tabindex="-1">2. Remote Synchronization (Push/Pull) <a class="header-anchor" href="#_2-remote-synchronization-push-pull" aria-label="Permalink to &quot;2. Remote Synchronization (Push/Pull)&quot;">​</a></h2><p>Configure an upstream remote (like GitHub, GitLab, or a self-hosted Git server) to sync notes:</p><ul><li><strong>Pull</strong>: Fetch and merge changes from the remote repository to update your local workspace.</li><li><strong>Push</strong>: Upload your local commits to the remote repository.</li></ul><p>Authentication uses Personal Access Tokens (PAT). When performing remote actions with a PAT, Notely temporarily injects the token into the git remote URL for the operation and immediately restores the clean original URL afterwards, keeping plain-text credentials out of persistent repository settings.</p><hr><h2 id="_3-stashing-changes" tabindex="-1">3. Stashing Changes <a class="header-anchor" href="#_3-stashing-changes" aria-label="Permalink to &quot;3. Stashing Changes&quot;">​</a></h2><p>If you need to switch branches but have unstaged edits that you aren&#39;t ready to commit:</p><ul><li>Click <strong>Stash Changes</strong> to save your work to a temporary shelf.</li><li>To recover stashed work, navigate to the Stash manager and click <strong>Apply Stash</strong>.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("git/branches.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const branches = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  branches as default
};
