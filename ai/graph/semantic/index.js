/**
 * ai/graph/semantic - Model-Agnostic Semantic Extraction Layer
 */

const SemanticExtractionEngine = require('./SemanticExtractionEngine');
const ModelAdapter = require('./ModelAdapter');
const GLiNER2RelexAdapter = require('./adapters/GLiNER2RelexAdapter');
const ExtractionValidator = require('./validators/ExtractionValidator');
const { Entity, Relationship, Evidence, ExtractionResult } = require('./schemas/ExtractionResult');

module.exports = {
  SemanticExtractionEngine,
  ModelAdapter,
  GLiNER2RelexAdapter,
  ExtractionValidator,
  Entity,
  Relationship,
  Evidence,
  ExtractionResult
};
