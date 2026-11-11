import { recognizeImage } from './tesseract-ocr.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const SUPPORTED = new Set(['ko', 'en', 'ja']);
const MAX_SEGMENT_BYTES = 500;
const execFileAsync = promisify(execFile);

async function fetchMyMemory(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    // Some local Node environments cannot resolve hosts while the system curl proxy can.
    if (!['ENOTFOUND', 'EAI_AGAIN'].includes(error?.cause?.code)) throw error;
    const { stdout } = await execFileAsync('curl', ['--silent', '--show-error', '--max-time', '15', '--write-out', '\n%{http_code}', url.toString()], {
      timeout: 18000,
      maxBuffer: 1024 * 1024
    });
    const separator = stdout.lastIndexOf('\n');
    const status = Number(stdout.slice(separator + 1));
    const body = stdout.slice(0, separator);
    if (!Number.isInteger(status) || separator < 0) throw new Error('Invalid curl response');
    return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) };
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit) {
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > limit) {
      const error = new Error('요청 크기 제한을 초과했습니다.');
      error.status = 413;
      throw error;
    }
    parts.push(part);
  }
  return Buffer.concat(parts);
}

function detectLanguage(text) {
  const korean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(text);
  const japanese = /[\u3040-\u30ff]/u.test(text);
  if (korean && japanese) return null;
  if (korean) return 'ko';
  if (japanese) return 'ja';
  if (/^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u.test(text)) return 'en';
  return null;
}

function languagePair(source, target, text) {
  if (!SUPPORTED.has(target)) return { error: '지원하지 않는 번역 언어입니다. 한국어, 영어, 일본어를 선택하세요.' };
  if (source !== 'auto' && !SUPPORTED.has(source)) return { error: '지원하지 않는 원본 언어입니다. 한국어, 영어, 일본어를 선택하세요.' };
  const detectedSource = source === 'auto' ? detectLanguage(text) : source;
  if (!detectedSource) return { error: '원본 언어를 감지할 수 없습니다. 한국어, 영어, 일본어 중 하나를 직접 선택하세요.' };
  if (detectedSource === target) return { error: '원본 언어와 번역 언어가 같습니다.' };
  return { detectedSource, target };
}

export async function translateWithMyMemory({ source, target, text }, { fetchImpl = fetchMyMemory, env = process.env } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { error: '번역할 텍스트를 입력하세요.' } };
  }
  const segment = text.trim();
  const pair = languagePair(source, target, segment);
  if (pair.error) return { status: 422, body: { error: pair.error } };
  if (Buffer.byteLength(segment, 'utf8') > MAX_SEGMENT_BYTES) {
    return { status: 413, body: { error: 'MyMemory 요청당 제한은 UTF-8 500바이트입니다. 텍스트를 줄여 주세요.' } };
  }

  const url = new URL(MYMEMORY_URL);
  url.searchParams.set('q', segment);
  url.searchParams.set('langpair', `${pair.detectedSource}|${target}`);
  if (env.MYMEMORY_EMAIL) url.searchParams.set('de', env.MYMEMORY_EMAIL);

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => null);
    const details = String(payload?.responseDetails || '');
    const translatedText = payload?.responseData?.translatedText;
    const quotaExceeded = payload?.quotaFinished === true || /quota|daily limit|available free translations|usage limit/i.test(details) ||
      (typeof translatedText === 'string' && /MYMEMORY WARNING.*(LIMIT|FREE TRANSLATIONS)/i.test(translatedText));
    if (quotaExceeded) return { status: 429, body: { error: 'MyMemory의 일일 무료 사용량을 초과했습니다. 내일 다시 시도하세요.' } };
    if (!response.ok || payload?.responseStatus !== 200) {
      return { status: 502, body: { error: `MyMemory 번역 요청에 실패했습니다${details ? `: ${details}` : '.'}` } };
    }
    if (typeof translatedText !== 'string' || !translatedText.trim()) {
      return { status: 502, body: { error: 'MyMemory 응답에 번역 결과가 없습니다.' } };
    }
    return { status: 200, body: { translatedText, detectedSource: pair.detectedSource } };
  } catch {
    return { status: 502, body: { error: 'MyMemory API 연결 또는 응답 처리에 실패했습니다.' } };
  }
}

export async function handleTranslation(req, res, { env = process.env, fetchImpl = fetchMyMemory, recognizeImageImpl = recognizeImage } = {}) {
  if (!req.url?.startsWith('/api/')) return false;
  const path = req.url.split('?')[0];
  if (!['/api/translate', '/api/image-translate'].includes(path)) {
    json(res, 404, { error: '알 수 없는 API 경로입니다.' });
    return true;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'POST 요청만 지원합니다.' });
    return true;
  }

  try {
    const image = path === '/api/image-translate';
    const raw = await readBody(req, image ? 21 * 1024 * 1024 : 32 * 1024);
    let source;
    let target;
    let text;
    if (image) {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.startsWith('multipart/form-data;')) {
        json(res, 400, { error: '이미지는 multipart/form-data로 보내야 합니다.' });
        return true;
      }
      const request = new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': contentType }, body: raw });
      const incoming = await request.formData();
      source = incoming.get('source');
      target = incoming.get('target');
      const file = incoming.get('image');
      if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/tiff'].includes(file.type) || file.size > 20 * 1024 * 1024) {
        json(res, 400, { error: 'JPG, PNG, TIFF 이미지(20MB 이하)만 지원합니다.' });
        return true;
      }
      if (source !== 'auto' && !SUPPORTED.has(source) || !SUPPORTED.has(target)) {
        json(res, 422, { error: '이미지 번역은 한국어, 영어, 일본어만 지원합니다.' });
        return true;
      }
      text = await recognizeImageImpl(Buffer.from(await file.arrayBuffer()), source);
      if (typeof text !== 'string' || !text.trim()) {
        json(res, 422, { error: '이미지에서 텍스트를 인식하지 못했습니다.' });
        return true;
      }
    } else {
      let input;
      try { input = JSON.parse(raw.toString('utf8')); } catch { input = null; }
      ({ source, target, text } = input || {});
    }

    const result = await translateWithMyMemory({ source, target, text }, { env, fetchImpl });
    if (result.status !== 200) {
      json(res, result.status, result.body);
    } else if (image) {
      json(res, 200, { result: { data: { sourceText: text.trim(), targetText: result.body.translatedText } }, detectedSource: result.body.detectedSource });
    } else {
      json(res, 200, result.body);
    }
  } catch (error) {
    json(res, error.status || 502, { error: error.status ? error.message : '이미지 OCR 또는 요청 처리에 실패했습니다.' });
  }
  return true;
}
