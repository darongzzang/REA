import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleTranslation } from '../server/translation.mjs';

function request(url, body, contentType = 'application/json') {
  const data = typeof body === 'string' ? Buffer.from(body) : body || Buffer.alloc(0);
  const req = Readable.from([data]);
  req.url = url; req.method = 'POST'; req.headers = { 'content-type': contentType };
  const res = {
    status: 0, body: '',
    writeHead(status) { this.status = status; },
    end(value) { this.body = JSON.parse(value); }
  };
  return { req, res };
}

function success(translation) {
  return { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: translation }, quotaFinished: false }) };
}

test('한국어→영어 선택이 MyMemory 언어쌍과 요청문에 연결된다', async () => {
  const { req, res } = request('/api/translate', JSON.stringify({ source: 'ko', target: 'en', text: '안녕하세요' }));
  await handleTranslation(req, res, { fetchImpl: async (url) => {
    assert.equal(url.origin + url.pathname, 'https://api.mymemory.translated.net/get');
    assert.equal(url.searchParams.get('q'), '안녕하세요');
    assert.equal(url.searchParams.get('langpair'), 'ko|en');
    return success('Hello');
  } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { translatedText: 'Hello', detectedSource: 'ko' });
});

test('교환된 영어→한국어 선택과 일본어 선택이 각각 요청에 반영된다', async () => {
  for (const [source, target, expected] of [['en', 'ko', 'en|ko'], ['ja', 'en', 'ja|en']]) {
    const { req, res } = request('/api/translate', JSON.stringify({ source, target, text: 'Hello' }));
    await handleTranslation(req, res, { fetchImpl: async url => {
      assert.equal(url.searchParams.get('langpair'), expected);
      return success('result');
    } });
    assert.equal(res.status, 200);
  }
});

test('자동 감지는 확실한 한글·가나만 적용하고 모호한 한자는 거부한다', async () => {
  const good = request('/api/translate', JSON.stringify({ source: 'auto', target: 'en', text: 'こんにちは' }));
  await handleTranslation(good.req, good.res, { fetchImpl: async url => {
    assert.equal(url.searchParams.get('langpair'), 'ja|en');
    return success('Hello');
  } });
  assert.equal(good.res.body.detectedSource, 'ja');
  const bad = request('/api/translate', JSON.stringify({ source: 'auto', target: 'en', text: '漢字' }));
  await handleTranslation(bad.req, bad.res, { fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(bad.res.status, 422);
});

test('UTF-8 500바이트 경계를 검사해 초과 요청을 보내지 않는다', async () => {
  const valid = request('/api/translate', JSON.stringify({ source: 'ko', target: 'en', text: '가'.repeat(166) }));
  await handleTranslation(valid.req, valid.res, { fetchImpl: async url => {
    assert.equal(Buffer.byteLength(url.searchParams.get('q')), 498);
    return success('ok');
  } });
  assert.equal(valid.res.status, 200);
  const tooLong = request('/api/translate', JSON.stringify({ source: 'ko', target: 'en', text: '가'.repeat(167) }));
  await handleTranslation(tooLong.req, tooLong.res, { fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(tooLong.res.status, 413);
  assert.equal(tooLong.res.body.translatedText, undefined);
});

test('일일 사용량 초과와 실패 응답은 번역문을 만들지 않는다', async () => {
  for (const payload of [
    { responseStatus: 403, responseDetails: 'YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY', responseData: { translatedText: 'MYMEMORY WARNING' } },
    { responseStatus: 200, quotaFinished: true, responseData: { translatedText: 'fake' } },
    { responseStatus: 500, responseDetails: 'upstream error' }
  ]) {
    const { req, res } = request('/api/translate', JSON.stringify({ source: 'ko', target: 'en', text: '안녕' }));
    await handleTranslation(req, res, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => payload }) });
    assert.notEqual(res.status, 200);
    assert.equal(res.body.translatedText, undefined);
  }
});

test('미지원 언어와 같은 언어 조합은 API 호출 전에 거부한다', async () => {
  for (const [source, target] of [['zh-CN', 'en'], ['ko', 'ko']]) {
    const { req, res } = request('/api/translate', JSON.stringify({ source, target, text: '안녕' }));
    await handleTranslation(req, res, { fetchImpl: async () => { throw new Error('should not call'); } });
    assert.equal(res.status, 422);
  }
});

test('이미지 OCR 문자열만 MyMemory로 전송하고 성공한 결과만 반환한다', async () => {
  const form = new FormData();
  form.set('source', 'auto'); form.set('target', 'en'); form.set('image', new File([new Uint8Array([137,80,78,71])], 'sample.png', { type: 'image/png' }));
  const encoded = new Request('http://localhost/upload', { method: 'POST', body: form });
  const { req, res } = request('/api/image-translate', Buffer.from(await encoded.arrayBuffer()), encoded.headers.get('content-type'));
  await handleTranslation(req, res, { recognizeImageImpl: async () => '안녕하세요', fetchImpl: async url => {
    assert.equal(url.searchParams.get('q'), '안녕하세요');
    assert.equal(url.searchParams.get('langpair'), 'ko|en');
    return success('Hello');
  } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.result.data, { sourceText: '안녕하세요', targetText: 'Hello' });
});

test('OCR 실패는 MyMemory 호출을 생략하고 결과를 만들지 않는다', async () => {
  const form = new FormData();
  form.set('source', 'auto'); form.set('target', 'en'); form.set('image', new File(['image'], 'sample.png', { type: 'image/png' }));
  const encoded = new Request('http://localhost/upload', { method: 'POST', body: form });
  const { req, res } = request('/api/image-translate', Buffer.from(await encoded.arrayBuffer()), encoded.headers.get('content-type'));
  await handleTranslation(req, res, { recognizeImageImpl: async () => '', fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(res.status, 422);
  assert.equal(res.body.result, undefined);
});
