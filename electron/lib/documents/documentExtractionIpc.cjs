const { assertTrustedIpcSender } = require('../ipc/ipcSecurity.cjs');

function registerDocumentExtractionIpc({
  ipcMain,
  BrowserWindow,
  documentExtractionService,
}) {
  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  // Get all extraction records
  registerTrustedHandler('doc-extract:getAll', async () => {
    if (!documentExtractionService) return [];
    return documentExtractionService.getAllRecords();
  });

  // Get status/record for a single relative path
  registerTrustedHandler('doc-extract:getRecord', async (_, { relativePath }) => {
    if (!documentExtractionService) return null;
    return documentExtractionService.getRecord(relativePath);
  });

  // Get extracted markdown content
  registerTrustedHandler('doc-extract:getContent', async (_, { relativePath }) => {
    if (!documentExtractionService) return '';
    return await documentExtractionService.getExtractedContent(relativePath);
  });

  // Force re-extract
  registerTrustedHandler('doc-extract:forceReextract', async (_, { relativePath }) => {
    if (!documentExtractionService) return null;
    return await documentExtractionService.forceReextract(relativePath);
  });

  // Trigger full scan
  registerTrustedHandler('doc-extract:scanWorkspace', async () => {
    if (!documentExtractionService) return [];
    return await documentExtractionService.scanWorkspace();
  });
}

module.exports = {
  registerDocumentExtractionIpc,
};
