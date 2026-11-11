import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cpus, platform, release, arch } from 'node:os';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { recognizeImageWithDetails } from '../server/tesseract-ocr.mjs';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const imageDir = ['test/images', 'tests/images'].map(path => join(root, path)).find(existsSync);
const groundTruthPath = join(root, 'test/ocr-ground-truth.json');
const reportDir = join(root, 'reports');
const prepareOnly = process.argv.includes('--prepare');
const imageExtension = /\.(png|jpe?g|webp)$/i;
const validName = /^(ko|jp)(\d+)\.(png|jpe?g|webp)$/i;

export function parseImageName(fileName) {
  const match = validName.exec(fileName);
  if (!match) return null;
  const language = match[1].toLowerCase();
  return { language, ocrLanguage: language === 'ko' ? 'kor' : 'jpn', caseId: Number(match[2]), source: language === 'ko' ? 'ko' : 'ja' };
}

export function preserveGroundTruth(previous, fileName) {
  const value = previous.get(fileName)?.groundTruth;
  return typeof value === 'string' ? value : '';
}

export function normalizeText(value) {
  return String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function editDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    for (let col = 1; col <= b.length; col++) {
      current[col] = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + Number(a[row - 1] !== b[col - 1]));
    }
    previous = current;
  }
  return previous[b.length];
}

export function scoreText(groundTruth, ocrText) {
  const truth = normalizeText(groundTruth);
  if (!truth) return null;
  const output = normalizeText(ocrText);
  const truthWords = truth.split(' ');
  const outputWords = output ? output.split(' ') : [];
  const characterEdits = editDistance(truth, output);
  const wordEdits = editDistance(truthWords, outputWords);
  const characterCount = Array.from(truth).length;
  return {
    characterEdits, characterCount, wordEdits, wordCount: truthWords.length,
    cer: characterEdits / characterCount,
    wer: wordEdits / truthWords.length
  };
}

function totals(items) {
  const scored = items.filter(item => item.metrics);
  const characterEdits = scored.reduce((sum, item) => sum + item.metrics.characterEdits, 0);
  const characterCount = scored.reduce((sum, item) => sum + item.metrics.characterCount, 0);
  const wordEdits = scored.reduce((sum, item) => sum + item.metrics.wordEdits, 0);
  const wordCount = scored.reduce((sum, item) => sum + item.metrics.wordCount, 0);
  return {
    evaluated: scored.length, characterEdits, characterCount, wordEdits, wordCount,
    cer: characterCount ? characterEdits / characterCount : null,
    wer: wordCount ? wordEdits / wordCount : null
  };
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}

function rate(value) {
  return value === null ? '정확도 미평가' : `${(value * 100).toFixed(2)}%`;
}

function renderMarkdown(report) {
  const { summary, results, environment } = report;
  const lines = [
    '# OCR 정확도 평가 결과', '',
    `실행 시각: ${report.generatedAt}`, '',
    `이미지 폴더: \`${report.imageDirectory}\``, '',
    '## 실행 요약', '',
    `- 전체 이미지: ${summary.totalImages}개 (한국어 ${summary.byLanguage.ko}, 일본어 ${summary.byLanguage.jp}, 지원하지 않는 파일명 ${summary.invalidNames})`,
    `- OCR 성공: ${summary.ocrSuccess}개, 실패: ${summary.ocrFailure}개 (엔진 오류 ${summary.engineErrors}개)`,
    `- 정답 입력 및 정확도 평가: ${summary.accuracyEvaluated}개; 정답 없음: ${summary.accuracyUnevaluated}개`,
    `- 정답이 있지만 OCR 엔진 오류로 정확도 계산 불가: ${summary.accuracySkippedDueToOcrError}개`,
    `- 평균 처리 시간: ${summary.averageDurationMs.toFixed(1)} ms; 최대 처리 시간: ${summary.maxDurationMs.toFixed(1)} ms`, '',
    '## 이미지별 결과', '',
    '| 파일 | 언어 | 케이스 ID | OCR 모델 | 상태 | OCR 신뢰도(%) | 시간(ms) | 추출 텍스트 | CER | WER | 오류 |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | --- | ---: | ---: | --- |'
  ];
  for (const item of results) {
    lines.push(`| ${markdownCell(item.fileName)} | ${item.language ?? '미지원'} | ${item.caseId ?? '—'} | ${item.ocrLanguage ?? '—'} | ${item.status} | ${item.confidence === null ? '—' : item.confidence.toFixed(2)} | ${item.durationMs.toFixed(1)} | ${markdownCell(item.ocrText || '—')} | ${rate(item.metrics?.cer ?? null)} | ${rate(item.metrics?.wer ?? null)} | ${markdownCell(item.error || '—')} |`);
  }
  lines.push('', '## 언어별 및 전체 정확도', '', '| 구분 | 평가 이미지 | 문자 편집거리 / 정답 문자 수 | CER | 단어 편집거리 / 정답 단어 수 | WER |', '| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const [label, total] of [['한국어', summary.accuracy.ko], ['일본어', summary.accuracy.jp], ['전체', summary.accuracy.overall]]) {
    lines.push(`| ${label} | ${total.evaluated} | ${total.characterEdits} / ${total.characterCount} | ${rate(total.cer)} | ${total.wordEdits} / ${total.wordCount} | ${rate(total.wer)} |`);
  }
  lines.push('', '## 인식 오류 사례 및 추정 원인', '');
  const errors = results.filter(item => item.status !== 'success' || (item.metrics && (item.metrics.characterEdits || item.metrics.wordEdits)));
  if (!errors.length) lines.push('정답이 입력되지 않은 이미지는 인식 오류 여부를 판단할 수 없다. OCR 엔진 오류는 없었다.');
  for (const item of errors) {
    const cause = item.status === 'invalid_filename' ? '파일명이 ko/jp + 숫자 형식을 따르지 않음' : item.status === 'ocr_error' ? 'OCR 엔진 오류. 상세 메시지를 확인해야 함' : item.status === 'no_text' ? '텍스트가 인식되지 않음. 이미지 대비·해상도·글자 크기 등은 원본 확인 후 판단 필요' : '정답과 OCR 결과가 다름. 정확한 원인은 원본 이미지의 글꼴·해상도·배치 등을 확인해야 판단 가능';
    lines.push(`- \`${item.fileName}\`: ${cause}${item.error ? ` (${item.error})` : ''}`);
  }
  if (summary.accuracyUnevaluated) lines.push(`- 정답이 없는 ${summary.accuracyUnevaluated}개 이미지는 문자 인식 오류 여부와 원인을 판정하지 않았다.`);
  lines.push('', '## 평가 규칙과 환경', '',
    '정답은 `test/ocr-ground-truth.json`의 `groundTruth`에 사람이 입력한다. OCR 출력은 정답으로 사용하지 않는다. 정답이 빈 문자열 또는 공백뿐이면 CER·WER를 계산하지 않는다.',
    '정답과 OCR 결과 모두 Unicode NFC를 적용하고 연속된 공백·탭·줄바꿈을 한 칸의 공백으로 바꾼 뒤 앞뒤 공백을 제거한다. CER은 공백을 포함한 Unicode 코드포인트 단위, WER는 공백으로 분리한 단어 단위 Levenshtein 편집거리다. 언어별·전체 값은 개별 비율 평균이 아닌 편집거리 합계 / 정답 길이 합계다. CER·WER는 100%를 넘을 수 있다. OCR 신뢰도는 엔진 추정치이며 정답 대비 정확도가 아니다.', '',
    `- Node.js: ${environment.node}`, `- OS: ${environment.platform} ${environment.release} (${environment.arch})`,
    `- CPU: ${environment.cpu}`, `- Tesseract.js: ${environment.tesseractJs}`, `- OCR 모델: ${environment.models.join(', ')}`, '- OCR 호출: 앱의 `server/tesseract-ocr.mjs` 설정 재사용; 이미지별 실제 worker 실행', ''
  );
  return lines.join('\n');
}

async function main() {
  if (!imageDir) throw new Error('테스트 이미지 폴더가 없습니다: test/images 또는 tests/images');
  const files = (await readdir(imageDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && imageExtension.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!files.length) throw new Error(`${relative(root, imageDir)}에 지원 이미지가 없습니다.`);

  let saved = [];
  if (existsSync(groundTruthPath)) {
    const parsed = JSON.parse(await readFile(groundTruthPath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('정답 파일은 JSON 배열이어야 합니다. 기존 파일을 덮어쓰지 않았습니다.');
    saved = parsed;
  }
  const previous = new Map(saved.filter(item => item && typeof item.fileName === 'string').map(item => [item.fileName, item]));
  const results = [];
  for (const fileName of files) {
    const parsedName = parseImageName(fileName);
    const { language = null, ocrLanguage = null, caseId = null, source = null } = parsedName || {};
    const item = { fileName, language, ocrLanguage, caseId, ocrText: '', confidence: null, durationMs: 0, status: 'invalid_filename', error: null, metrics: null };
    if (!parsedName) {
      item.error = '지원하지 않는 파일명입니다. ko 또는 jp 뒤에 숫자가 와야 합니다.';
    } else {
      const started = performance.now();
      try {
        const bytes = await readFile(join(imageDir, fileName));
        const recognized = await recognizeImageWithDetails(bytes, source);
        item.ocrText = recognized.text;
        item.confidence = recognized.confidence;
        item.status = recognized.text ? 'success' : 'no_text';
        if (!recognized.text) item.error = 'OCR이 텍스트를 추출하지 못했습니다.';
      } catch (error) {
        item.status = 'ocr_error';
        item.error = error instanceof Error ? error.message : String(error);
      } finally {
        item.durationMs = performance.now() - started;
      }
    }
    item.groundTruth = preserveGroundTruth(previous, fileName);
    if (source && normalizeText(item.groundTruth) && item.status !== 'ocr_error') item.metrics = scoreText(item.groundTruth, item.ocrText);
    results.push(item);
    console.log(`${fileName}: ${item.status}, ${item.durationMs.toFixed(1)} ms`);
  }

  await mkdir(join(root, 'test'), { recursive: true });
  await writeFile(groundTruthPath, JSON.stringify(results.map(({ fileName, language, ocrLanguage, caseId, groundTruth, ocrText, confidence, status, error }) => ({ fileName, language, ocrLanguage, caseId, groundTruth, ocrText, confidence, status, error })), null, 2) + '\n');
  if (prepareOnly) {
    console.log(`정답 초안 저장: ${relative(root, groundTruthPath)}. groundTruth를 입력한 뒤 npm run test:ocr을 실행하세요.`);
    return;
  }

  const durations = results.filter(item => item.status !== 'invalid_filename').map(item => item.durationMs);
  const accuracy = { ko: totals(results.filter(item => item.language === 'ko')), jp: totals(results.filter(item => item.language === 'jp')), overall: totals(results) };
  const summary = {
    totalImages: results.length,
    byLanguage: { ko: results.filter(item => item.language === 'ko').length, jp: results.filter(item => item.language === 'jp').length },
    invalidNames: results.filter(item => item.status === 'invalid_filename').length,
    ocrSuccess: results.filter(item => item.status === 'success').length,
    ocrFailure: results.filter(item => item.status !== 'success').length,
    engineErrors: results.filter(item => item.status === 'ocr_error').length,
    accuracyEvaluated: accuracy.overall.evaluated,
    accuracyUnevaluated: results.filter(item => !normalizeText(item.groundTruth)).length,
    accuracySkippedDueToOcrError: results.filter(item => normalizeText(item.groundTruth) && item.status === 'ocr_error').length,
    averageDurationMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    maxDurationMs: durations.length ? Math.max(...durations) : 0,
    accuracy
  };
  const packageJson = require('tesseract.js/package.json');
  const report = {
    generatedAt: new Date().toISOString(), imageDirectory: relative(root, imageDir), summary, results,
    environment: { node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model || 'unknown', tesseractJs: packageJson.version, models: ['kor', 'jpn'] },
    normalization: 'Unicode NFC; all whitespace runs to one ASCII space; trim; CER counts Unicode codepoints including spaces; WER splits on spaces',
    metricsFormula: 'sum(Levenshtein edit distances) / sum(ground-truth lengths)'
  };
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, 'ocr-results.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(reportDir, 'ocr-results.md'), renderMarkdown(report));
  console.log(`결과 저장: ${relative(root, reportDir)}/ocr-results.json, ocr-results.md`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
