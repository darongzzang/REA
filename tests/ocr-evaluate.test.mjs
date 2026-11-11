import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, editDistance, scoreText, parseImageName, preserveGroundTruth } from '../scripts/ocr-evaluate.mjs';

test('OCR 정확도 계산은 동일한 공백·Unicode 정규화와 편집거리를 적용한다', () => {
  assert.equal(normalizeText('  안녕\n\t하세요  '), '안녕 하세요');
  assert.equal(normalizeText('e\u0301'), 'é');
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.deepEqual(scoreText('안녕\n하세요', '안녕 하세오'), {
    characterEdits: 1, characterCount: 6, wordEdits: 1, wordCount: 2,
    cer: 1 / 6, wer: 1 / 2
  });
  assert.equal(scoreText(' \n ', 'OCR 결과'), null);
});

test('이미지명 판별과 사람이 입력한 정답 보존', () => {
  assert.deepEqual(parseImageName('ko12.PNG'), { language: 'ko', ocrLanguage: 'kor', caseId: 12, source: 'ko' });
  assert.deepEqual(parseImageName('jp3.webp'), { language: 'jp', ocrLanguage: 'jpn', caseId: 3, source: 'ja' });
  assert.equal(parseImageName('english1.png'), null);
  assert.equal(parseImageName('ko.png'), null);
  const previous = new Map([['ko1.png', { groundTruth: '사용자가 입력한 원문' }]]);
  assert.equal(preserveGroundTruth(previous, 'ko1.png'), '사용자가 입력한 원문');
  assert.equal(preserveGroundTruth(previous, 'ko2.png'), '');
});
