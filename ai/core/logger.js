/**
 * Lightweight structured logger for Notely subsystems.
 *
 * Zero dependencies. Emits leveled, namespaced records to the console AND
 * tees copies into the centralized enterprise LogCore SQLite engine when initialized.
 *
 * Level is controlled by the NOTELY_LOG_LEVEL environment variable
 * (error | warn | info | debug | trace | fatal); defaults to "info".
 */

let logCoreInstance = null;
try {
  // Gracefully load LogCore singleton if available in process
  const { logCore } = require('../../electron/core/LogCore.cjs');
  logCoreInstance = logCore;
} catch {
  // Safe fallback if required in isolated context
}

const LEVELS = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 };

function resolveThreshold() {
  const raw = String(process.env.NOTELY_LOG_LEVEL || 'info').toLowerCase();
  return raw in LEVELS ? LEVELS[raw] : LEVELS.info;
}

let threshold = resolveThreshold();

const CONSOLE_METHOD = {
  fatal: 'error',
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'log',
  trace: 'log'
};

function emit(level, namespace, message, meta) {
  const record = {
    ts: new Date().toISOString(),
    level,
    ns: namespace,
    msg: message
  };

  if (meta !== undefined && meta !== null) {
    record.meta = meta instanceof Error
      ? { name: meta.name, message: meta.message, stack: meta.stack }
      : meta;
  }

  // 1. Console emission (respects threshold)
  if (LEVELS[level] <= threshold) {
    const method = CONSOLE_METHOD[level] || 'log';
    console[method](JSON.stringify(record));
  }

  // 2. Enterprise Central LogCore Tee (non-blocking, never fails)
  if (logCoreInstance && typeof logCoreInstance.write === 'function') {
    try {
      const isAiSubsystem = ['GraphDB', 'EmbeddingDB', 'EntityResolver', 'GraphBuilder', 'ModelDownloader', 'AIService', 'IndexWorker', 'GraphWorker'].includes(namespace);
      const category = isAiSubsystem ? 'ai' : (level === 'fatal' || level === 'error' ? 'app' : 'general');
      
      logCoreInstance.write({
        level: level === 'fatal' ? 'fatal' : level,
        category: category,
        subsystem: namespace || 'app',
        source: namespace,
        message: message,
        meta_json: record.meta,
        error: meta instanceof Error ? meta : null
      });
    } catch {
      // Tee failures MUST be silent to preserve app execution
    }
  }
}

/**
 * Create a namespaced logger, e.g. createLogger('DatabaseManager').
 */
function createLogger(namespace) {
  const ns = namespace || 'app';
  return {
    fatal: (message, meta) => emit('fatal', ns, message, meta),
    error: (message, meta) => emit('error', ns, message, meta),
    warn: (message, meta) => emit('warn', ns, message, meta),
    info: (message, meta) => emit('info', ns, message, meta),
    debug: (message, meta) => emit('debug', ns, message, meta),
    trace: (message, meta) => emit('trace', ns, message, meta)
  };
}

/**
 * Override the active log level at runtime (mainly for tests).
 */
function setLogLevel(level) {
  if (level in LEVELS) {
    threshold = LEVELS[level];
  }
}

module.exports = { createLogger, setLogLevel, LEVELS };
