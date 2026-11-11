import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

test('초기 화면과 독립 상세 화면, 목록 선택 및 상세 조작이 동작한다', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  await mkdir('.tmp', { recursive: true });
  try {
    await build({ entryPoints: ['src/App.tsx'], outfile: '.tmp/app-test.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
    const { default: App, TranslationDetail, SavedList } = await import('../.tmp/app-test.mjs');
    const html = renderToString(createElement(App));
    for (const label of ['텍스트', '이미지', '번역 기록', '즐겨찾기', '사전', '번역하기']) assert.ok(html.includes(label), `${label} 없음`);

    const item = { id: 'saved-one', source: 'ko', target: 'en', input: '안녕하세요', output: 'Hello', createdAt: 1 };
    const events = [];
    for (const empty of ['번역 기록이 없습니다', '즐겨찾기가 없습니다']) {
      let selected = null;
      const list = SavedList({ entries: [item], empty, onSelect: entry => { selected = entry; }, onDeleteAll: () => {} });
      const card = list.props.children[1].props.children[0];
      card.props.onClick();
      assert.equal(selected, item, `${empty} 목록에서 항목 선택 실패`);
    }
    const props = {
      item, from: 'history', favorite: false,
      onBack: () => events.push('back'),
      onOpenTranslator: () => events.push('open'),
      onToggleFavorite: () => events.push('favorite'),
      onStatus: message => events.push(message)
    };
    const detailHtml = renderToString(createElement(TranslationDetail, props));
    for (const label of ['번역 상세', '안녕하세요', 'Hello', '한국어', '영어', '원문 듣기', '번역문 듣기', '원문 복사', '번역문 복사', '즐겨찾기 추가', '번역기에서 열기', '번역 기록으로 돌아가기']) {
      assert.ok(detailHtml.includes(label), `상세 화면에 ${label} 없음`);
    }
    assert.ok(renderToString(createElement(TranslationDetail, { ...props, from: 'favorites', favorite: true })).includes('즐겨찾기 해제'));

    const buttons = [];
    function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      if (node.type === 'button') buttons.push(node);
      collect(node.props?.children);
    }
    collect(TranslationDetail(props));
    const press = label => buttons.find(button => button.props['aria-label'] === label || button.props.children === label)?.props.onClick();
    globalThis.window = { speechSynthesis: { cancel: () => events.push('cancel'), speak: utterance => events.push(`${utterance.lang}:${utterance.text}`) } };
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async text => events.push(`copy:${text}`) } }, configurable: true });
    press('원문 듣기'); press('번역문 듣기'); press('원문 복사'); press('번역문 복사');
    buttons.find(button => button.props['aria-pressed'] === false).props.onClick();
    buttons.find(button => button.props['aria-label']?.includes('으로 돌아가기')).props.onClick();
    buttons.find(button => String(button.props.children).includes('번역기에서 열기')).props.onClick();
    await Promise.resolve();
    for (const event of ['ko-KR:안녕하세요', 'en-US:Hello', 'copy:안녕하세요', 'copy:Hello', 'favorite', 'back', 'open']) assert.ok(events.includes(event), `${event} 동작 없음`);
  } finally { await rm('.tmp', { recursive: true, force: true }); }
});
