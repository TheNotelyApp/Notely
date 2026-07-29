/**
 * ModelAdapter - Abstract base class for semantic extraction model providers
 */

class ModelAdapter {
  constructor(config = {}) {
    if (new.target === ModelAdapter) {
      throw new TypeError('Cannot instantiate abstract class ModelAdapter directly.');
    }
    this.config = config;
    this.isLoaded = false;
  }

  async load() {
    throw new Error('Method load() must be implemented by concrete ModelAdapter subclass.');
  }

  /**
   * Execute semantic extraction over document evidence
   * @param {Object} document { id, content, sourceType, metadata }
   * @param {Object} options
   * @returns {Promise<ExtractionResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async extract(document, options = {}) {
    throw new Error('Method extract() must be implemented by concrete ModelAdapter subclass.');
  }

  getCapabilities() {
    return {
      entityExtraction: true,
      relationExtraction: true,
      zeroShot: true,
      offline: true,
      executionProvider: 'CPU'
    };
  }
}

module.exports = ModelAdapter;
