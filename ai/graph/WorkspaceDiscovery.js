/**
 * WorkspaceDiscovery - Infers workspace type from directory signals and workspace info
 */

const fs = require('fs');
const path = require('path');

function detectWorkspaceType(workspaceRoot, workspaceInfo = {}) {
  // 1. Explicit setting in metadata
  if (workspaceInfo.projectType && typeof workspaceInfo.projectType === 'string' && workspaceInfo.projectType.toLowerCase() !== 'general') {
    return workspaceInfo.projectType.toLowerCase();
  }

  if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return 'general';

  // 2. Check domain tags
  const tags = (workspaceInfo.domainTags || []).map(t => String(t).toLowerCase());
  if (tags.some(t => ['research', 'paper', 'thesis', 'study', 'academic'].includes(t))) {
    return 'research';
  }
  if (tags.some(t => ['finance', 'accounting', 'investment', 'trading', 'banking'].includes(t))) {
    return 'finance';
  }
  if (tags.some(t => ['software', 'code', 'dev', 'engineering', 'programming'].includes(t))) {
    return 'software';
  }

  // 3. Filesystem heuristics
  if (fs.existsSync(path.join(workspaceRoot, '.git')) || fs.existsSync(path.join(workspaceRoot, 'package.json'))) {
    return 'software';
  }

  return 'general';
}

module.exports = { detectWorkspaceType };
