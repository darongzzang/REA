import test from 'node:test';
import assert from 'node:assert/strict';
import { translationStore } from '../src/storage.ts';

test('번역 기록과 즐겨찾기는 localStorage에 저장되고 다시 읽힌다', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const entry = { id: 'one', source: 'ko', target: 'en', input: '안녕', output: 'Hello', createdAt: 1 };
  translationStore.addHistory(entry);
  assert.deepEqual(translationStore.history(), [entry]);
  assert.equal(translationStore.toggleFavorite(entry), true);
  assert.equal(translationStore.isFavorite(entry), true);
  assert.deepEqual(translationStore.favorites(), [entry]);
  assert.equal(translationStore.toggleFavorite(entry), false);
  assert.deepEqual(translationStore.favorites(), []);
  translationStore.toggleFavorite(entry);
  translationStore.clearFavorites();
  assert.deepEqual(translationStore.favorites(), []);
  translationStore.clearHistory();
  assert.deepEqual(translationStore.history(), []);
});

test('손상된 저장 데이터는 빈 목록으로 처리한다', () => {
  globalThis.localStorage = { getItem: () => '{broken', setItem: () => {} };
  assert.deepEqual(translationStore.history(), []);
  assert.deepEqual(translationStore.favorites(), []);
});
