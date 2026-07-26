/**
 * Queue Module Facade
 * Single entry point for background indexing and graph worker processing queues.
 */

const IndexQueue = require('./IndexQueue');
const IndexWorker = require('./IndexWorker');
const GraphQueue = require('./GraphQueue');
const GraphWorker = require('./GraphWorker');

module.exports = {
  IndexQueue,
  IndexWorker,
  GraphQueue,
  GraphWorker
};
