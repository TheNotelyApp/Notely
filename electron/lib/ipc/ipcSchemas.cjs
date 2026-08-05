const { z } = require("zod");

const DocumentReadSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
});

const DocumentSaveSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
  content: z.string(),
});

const CodeExecuteSchema = z.object({
  language: z.string().min(1, "Language is required"),
  code: z.string(),
});

const PackageExportSchema = z.object({
  destinationPath: z.string().min(1, "Destination path is required"),
  notePaths: z.array(z.string()).optional(),
});

function validatePayload(schema, payload, channelName) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Invalid IPC payload for ${channelName}: ${errorMsg}`);
  }
  return result.data;
}

module.exports = {
  DocumentReadSchema,
  DocumentSaveSchema,
  CodeExecuteSchema,
  PackageExportSchema,
  validatePayload,
};
