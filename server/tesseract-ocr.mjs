import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const OCR_LANGUAGES = { ko: 'kor', en: 'eng', ja: 'jpn', auto: ['kor', 'eng', 'jpn'] };

export async function recognizeImage(bytes, source = 'auto', { createWorkerImpl } = {}) {
  const languages = OCR_LANGUAGES[source];
  if (!languages) {
    const error = new Error('이미지 OCR은 한국어, 영어, 일본어만 지원합니다.');
    error.status = 422;
    throw error;
  }
  let createWorker = createWorkerImpl;
  if (!createWorker) {
    try {
      ({ createWorker } = require('tesseract.js'));
    } catch {
      const error = new Error('Tesseract.js OCR 패키지가 없습니다. npm install을 실행하세요.');
      error.status = 503;
      throw error;
    }
  }
  const worker = await createWorker(languages, 1, {
    langPath: process.env.TESSDATA_DIR || resolve(process.cwd(), 'server/tessdata'),
    gzip: false,
    cacheMethod: 'none'
  });
  try {
    const result = await worker.recognize(bytes);
    return result?.data?.text?.trim() || '';
  } finally {
    await worker.terminate();
  }
}
