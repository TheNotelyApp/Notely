/**
 * CodeEvidenceBuilder
 * Generates deterministic evidence records for code-derived graph relationships.
 * Every relationship from a repository must have traceable provenance.
 */

const path = require('path');

class CodeEvidenceBuilder {
  /**
   * Build a list of evidence objects for a set of code relationships.
   *
   * @param {object} params
   * @param {string} params.repoId      - repository ID
   * @param {string} params.repoName    - repository display name
   * @param {string} params.filePath    - absolute path to the source file
   * @param {string} params.relPath     - workspace-relative path (repoName/src/file.ts)
   * @param {Array}  params.relationships - raw relationships from extractor
   * @returns {Array<{relationship: object, evidence: object}>}
   */
  buildForRelationships({ repoId, repoName, filePath, relPath, relationships }) {
    const result = [];

    for (const rel of relationships) {
      const evidence = this._evidenceForRelationship({
        repoId,
        repoName,
        filePath,
        relPath,
        rel
      });
      result.push({ relationship: rel, evidence });
    }

    return result;
  }

  /**
   * Build evidence for a single relationship.
   */
  _evidenceForRelationship({ repoId, repoName, filePath, relPath, rel }) {
    // Construct a human-readable raw sentence describing where this relationship comes from
    const rawSentence = this._describeRelationship(rel, relPath, repoName);

    return {
      sourceId: filePath,         // absolute file path — consistent with note evidence
      extractor: 'code',          // deterministic, not AI
      subjectText: rel.source_name,
      predicateText: rel.type,
      objectText: rel.target_name,
      rawSentence,
      confidence: rel.confidence || 1.0,
      // Additional code-specific provenance metadata stored in rawSentence
      _meta: {
        repoId,
        repoName,
        relPath,
        relationshipType: rel.type,
        sourceType: rel.source_type,
        targetType: rel.target_type
      }
    };
  }

  _describeRelationship(rel, relPath, repoName) {
    const src = rel.source_name;
    const tgt = rel.target_name;

    switch (rel.type) {
      case 'CONTAINS':
        return `${src} contains ${tgt} in ${repoName}/${relPath}`;
      case 'IMPORTS':
        return `${src} imports ${tgt} in ${relPath}`;
      case 'EXTENDS':
        return `${src} extends ${tgt} in ${relPath}`;
      case 'IMPLEMENTS':
        return `${src} implements ${tgt} in ${relPath}`;
      case 'CALLS':
        return `${src} calls ${tgt} in ${relPath}`;
      case 'DEFINES_ROUTE':
        return `${src} defines route ${tgt} in ${relPath}`;
      default:
        return `${src} ${rel.type} ${tgt} in ${repoName}/${relPath}`;
    }
  }
}

module.exports = { CodeEvidenceBuilder };
