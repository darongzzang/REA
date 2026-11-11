import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeImage } from '../server/tesseract-ocr.mjs';

test('OCR은 선택 언어의 Tesseract 모델을 사용하고 작업 후 worker를 종료한다', async () => {
  for (const [source, expected] of [['ko', 'kor'], ['en', 'eng'], ['ja', 'jpn'], ['auto', ['kor', 'eng', 'jpn']]]) {
    const calls = [];
    const bytes = Buffer.from([1, 2, 3]);
    const result = await recognizeImage(bytes, source, {
      createWorkerImpl: async languages => {
        calls.push(['create', languages]);
        return {
          recognize: async input => { assert.equal(input, bytes); return { data: { text: '  Hello  ' } }; },
          terminate: async () => calls.push(['terminate'])
        };
      }
    });
    assert.equal(result, 'Hello');
    assert.deepEqual(calls, [['create', expected], ['terminate']]);
  }
});

test('OCR 인식 오류에도 worker를 종료한다', async () => {
  let terminated = false;
  await assert.rejects(recognizeImage(Buffer.from([1]), 'en', {
    createWorkerImpl: async () => ({
      recognize: async () => { throw new Error('recognition failed'); },
      terminate: async () => { terminated = true; }
    })
  }), /recognition failed/);
  assert.equal(terminated, true);
});
