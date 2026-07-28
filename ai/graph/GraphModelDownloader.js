const fs = require('fs');
const path = require('path');
const https = require('https');
const { createLogger } = require('../core/logger');

const log = createLogger('GraphModelDownloader');

class GraphModelDownloader {
  constructor(appDataDir) {
    this.modelDir = path.join(appDataDir, 'notely', 'ai-model', 'gliner2-relex');
    this.downloading = false;
    this.progress = 0;
  }

  getModelDir() {
    return this.modelDir;
  }

  isModelDownloaded() {
    const requiredFiles = [
      'encoder_fp16.onnx',
      'span_rep.onnx',
      'classifier.onnx',
      'tokenizer.json'
    ];

    return requiredFiles.every(fileName => {
      const p = path.join(this.modelDir, fileName);
      return fs.existsSync(p) && fs.statSync(p).size > 10;
    });
  }

  getStatus() {
    return {
      downloaded: this.isModelDownloaded(),
      isDownloading: this.downloading,
      progress: this.progress,
      path: this.modelDir
    };
  }

  async downloadModel(onProgress) {
    if (this.isModelDownloaded()) {
      if (onProgress) onProgress({ progress: 100, status: 'complete' });
      return { success: true, message: 'GLiNER2-Relex FP16 ONNX model present' };
    }

    if (this.downloading) {
      return { success: false, message: 'Download already in progress' };
    }

    this.downloading = true;
    this.progress = 0;

    try {
      if (!fs.existsSync(this.modelDir)) {
        fs.mkdirSync(this.modelDir, { recursive: true });
      }

      // Recommended FP16 artifacts for dx111ge/gliner2-multi-v1-onnx
      const filesToDownload = [
        // 1. Encoder FP16
        { name: 'encoder_fp16.onnx', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/encoder_fp16.onnx' },
        { name: 'encoder_fp16.onnx.data', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/encoder_fp16.onnx.data' },
        // 2. Span Representation
        { name: 'span_rep.onnx', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/span_rep.onnx' },
        { name: 'span_rep.onnx.data', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/span_rep.onnx.data' },
        // 3. Count Embedding
        { name: 'count_embed.onnx', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/count_embed.onnx' },
        { name: 'count_embed.onnx.data', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/count_embed.onnx.data' },
        // 4. Count Prediction
        { name: 'count_pred.onnx', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/count_pred.onnx' },
        { name: 'count_pred.onnx.data', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/count_pred.onnx.data' },
        // 5. Relation / Entity Classifier
        { name: 'classifier.onnx', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/classifier.onnx' },
        { name: 'classifier.onnx.data', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/classifier.onnx.data' },
        // 6. Tokenizer Files
        { name: 'tokenizer.json', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/tokenizer.json' },
        { name: 'tokenizer_config.json', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/tokenizer_config.json' },
        { name: 'special_tokens_map.json', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/special_tokens_map.json' },
        { name: 'spm.model', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/spm.model' },
        // 7. Model Configuration
        { name: 'gliner2_config.json', url: 'https://huggingface.co/dx111ge/gliner2-multi-v1-onnx/resolve/main/gliner2_config.json' }
      ];

      let downloadedCount = 0;
      const totalFiles = filesToDownload.length;

      for (const fileObj of filesToDownload) {
        const destPath = path.join(this.modelDir, fileObj.name);
        try {
          await this._downloadFile(fileObj.url, destPath, (percent) => {
            const overall = Math.floor(((downloadedCount + (percent / 100)) / totalFiles) * 100);
            this.progress = overall;
            if (onProgress) onProgress({ progress: overall, status: 'downloading', currentFile: fileObj.name });
          });
        } catch (dlErr) {
          log.warn(`Optional model download skipped for ${fileObj.name}: ${dlErr.message}`);
        }
        downloadedCount++;
      }

      this.progress = 100;
      this.downloading = false;

      if (onProgress) onProgress({ progress: 100, status: 'complete' });
      return { success: this.isModelDownloaded() };
    } catch (err) {
      this.downloading = false;
      log.error('Failed to download GLiNER2-Relex FP16 ONNX model:', err);
      throw err;
    }
  }

  deleteModel() {
    try {
      if (fs.existsSync(this.modelDir)) {
        fs.rmSync(this.modelDir, { recursive: true, force: true });
      }
      this.progress = 0;
      this.downloading = false;
      return { success: true };
    } catch (err) {
      log.error('Failed to delete GLiNER2-Relex model directory:', err);
      throw err;
    }
  }

  _downloadFile(url, destPath, onFileProgress) {
    return new Promise((resolve, reject) => {
      const request = (targetUrl) => {
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NotelyApp/0.1.29'
          }
        };

        https.get(targetUrl, options, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
            let redirectUrl = response.headers.location;
            if (redirectUrl && !redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
              const origin = new URL(targetUrl).origin;
              redirectUrl = new URL(redirectUrl, origin).toString();
            }
            request(redirectUrl);
            return;
          }

          if (response.statusCode !== 200) {
            if (fs.existsSync(destPath)) {
              fs.unlinkSync(destPath);
            }
            return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
          }

          const fileStream = fs.createWriteStream(destPath);
          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          let receivedBytes = 0;

          response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            fileStream.write(chunk);
            if (totalBytes > 0 && onFileProgress) {
              const pct = Math.floor((receivedBytes / totalBytes) * 100);
              onFileProgress(pct);
            }
          });

          response.on('end', () => {
            fileStream.end();
          });

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
        }).on('error', (err) => {
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
          reject(err);
        });
      };

      request(url);
    });
  }
}

module.exports = GraphModelDownloader;
