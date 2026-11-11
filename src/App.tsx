import { useEffect, useRef, useState, type ReactNode } from 'react';
import { translationStore, type SavedTranslation } from './storage';

type Screen = 'text' | 'image' | 'document' | 'voice' | 'website' | 'history' | 'favorites' | 'detail' | 'glossary' | 'settings';
type Language = { code: string; label: string; short: string };
const languages: Language[] = [
  { code: 'auto', label: '언어 감지', short: '감지' },
  { code: 'ko', label: '한국어', short: '한국어' },
  { code: 'en', label: '영어', short: '영어' },
  { code: 'ja', label: '일본어', short: '日本語' },
  { code: 'zh-CN', label: '중국어 (간체)', short: '中文' },
  { code: 'zh-TW', label: '중국어 (번체)', short: '繁體' },
  { code: 'es', label: '스페인어', short: 'Español' },
  { code: 'fr', label: '프랑스어', short: 'Français' },
  { code: 'de', label: '독일어', short: 'Deutsch' },
  { code: 'vi', label: '베트남어', short: 'Tiếng Việt' },
  { code: 'th', label: '태국어', short: 'ไทย' },
  { code: 'id', label: '인도네시아어', short: 'Indonesia' },
  { code: 'ru', label: '러시아어', short: 'Русский' },
  { code: 'pt', label: '포르투갈어', short: 'Português' },
  { code: 'it', label: '이탈리아어', short: 'Italiano' }
];
const menu: { id: Screen; label: string; icon: string }[] = [
  { id: 'text', label: '텍스트', icon: 'T' },
  { id: 'image', label: '이미지', icon: '▧' },
  { id: 'document', label: '문서', icon: '▤' },
  { id: 'voice', label: '음성', icon: '◖' },
  { id: 'website', label: '웹사이트', icon: '◎' }
];
const sideMenu: { id: Screen; label: string; icon: string }[] = [
  { id: 'history', label: '번역 기록', icon: '◷' },
  { id: 'favorites', label: '즐겨찾기', icon: '☆' },
  { id: 'glossary', label: '용어집', icon: '▯' },
  { id: 'settings', label: '설정', icon: '⚙' }
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const paths: Record<string, ReactNode> = {
    swap: <><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    clear: <path d="M18 6 6 18M6 6l12 12" />,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    star: <path d="m12 2 3.1 6.3 7 1-5.1 5 .9 7-5.9-3.2-5.9 3.2.9-7-5.1-5 7-1L12 2Z" />,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function LanguagePicker({ value, onChange, allowAuto, align }: { value: string; onChange: (value: string) => void; allowAuto?: boolean; align?: 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return <div className="language-picker" ref={root}>
    <button className="language-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      {languages.find(item => item.code === value)?.label || value}<Icon name="chevron" size={16} />
    </button>
    {open && <div className={`language-menu ${align === 'right' ? 'align-right' : ''}`} role="listbox">
      {languages.filter(item => allowAuto || item.code !== 'auto').map(item => <button type="button" role="option" aria-selected={value === item.code} key={item.code} className={value === item.code ? 'selected' : ''} onClick={() => { onChange(item.code); setOpen(false); }}>{item.label}</button>)}
    </div>}
  </div>;
}

function speak(value: string, lang: string, onError: (message: string) => void) {
  if (!('speechSynthesis' in window)) { onError('이 브라우저는 음성 읽기를 지원하지 않습니다.'); return; }
  if (!value.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = lang === 'auto' ? 'ko-KR' : ({ ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW' } as Record<string, string>)[lang] || lang;
  utterance.onerror = () => onError('이 언어의 음성을 재생할 수 없습니다. 브라우저 음성 설정을 확인하세요.');
  window.speechSynthesis.speak(utterance);
}

async function copy(value: string, onStatus: (message: string) => void, successMessage = '번역 결과를 복사했습니다.') {
  try { await navigator.clipboard.writeText(value); onStatus(successMessage); }
  catch { onStatus('클립보드 복사에 실패했습니다.'); }
}

export function TranslationDetail({ item, from, favorite, onBack, onOpenTranslator, onToggleFavorite, onStatus }: {
  item: SavedTranslation;
  from: 'history' | 'favorites';
  favorite: boolean;
  onBack: () => void;
  onOpenTranslator: () => void;
  onToggleFavorite: () => void;
  onStatus: (message: string) => void;
}) {
  const languageName = (code: string) => languages.find(language => language.code === code)?.label || code;
  return <section className="detail-section" aria-label="번역 상세 화면">
    <div className="detail-heading">
      <button className="detail-back" type="button" onClick={onBack} aria-label={`${from === 'history' ? '번역 기록' : '즐겨찾기'}으로 돌아가기`}>← <span>{from === 'history' ? '번역 기록' : '즐겨찾기'}</span></button>
      <p className="eyebrow">MY PAPAGO</p>
      <h1>번역 상세</h1>
      <div className="detail-language-pair"><span>{languageName(item.source)}</span><span aria-hidden="true">→</span><span>{languageName(item.target)}</span></div>
    </div>
    <div className="detail-grid">
      <article className="detail-card"><div className="detail-card-heading"><span>원문</span><strong>{languageName(item.source)}</strong></div><p>{item.input}</p><div className="detail-actions"><button type="button" onClick={() => speak(item.input, item.source, onStatus)} aria-label="원문 듣기"><Icon name="volume" size={18} />듣기</button><button type="button" onClick={() => void copy(item.input, onStatus, '원문을 복사했습니다.')} aria-label="원문 복사"><Icon name="copy" size={18} />복사</button></div></article>
      <article className="detail-card translated"><div className="detail-card-heading"><span>번역문</span><strong>{languageName(item.target)}</strong></div><p>{item.output}</p><div className="detail-actions"><button type="button" onClick={() => speak(item.output, item.target, onStatus)} aria-label="번역문 듣기"><Icon name="volume" size={18} />듣기</button><button type="button" onClick={() => void copy(item.output, onStatus, '번역문을 복사했습니다.')} aria-label="번역문 복사"><Icon name="copy" size={18} />복사</button></div></article>
    </div>
    <div className="detail-bottom"><button type="button" className={`detail-favorite ${favorite ? 'active' : ''}`} aria-pressed={favorite} onClick={onToggleFavorite}><Icon name="star" size={18} />{favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}</button><button type="button" className="detail-open" onClick={onOpenTranslator}>번역기에서 열기 <Icon name="arrow" size={17} /></button></div>
  </section>;
}

export function SavedList({ entries, empty, onSelect, onDeleteAll }: { entries: SavedTranslation[]; empty: string; onSelect: (item: SavedTranslation) => void; onDeleteAll: () => void }) {
  return <section className="saved-section">
    <div className="section-heading"><div><p className="eyebrow">MY PAPAGO</p><h1>{empty.includes('기록') ? '번역 기록' : '즐겨찾기'}</h1><p>내 브라우저에 저장된 번역을 다시 확인하세요.</p></div>{entries.length > 0 && <button className="subtle-button" onClick={onDeleteAll}>전체 삭제</button>}</div>
    {entries.length ? <div className="saved-list">{entries.map(item => <button className="saved-card" key={item.id} onClick={() => onSelect(item)}><span className="saved-languages">{languages.find(l => l.code === item.source)?.label || item.source} <span>→</span> {languages.find(l => l.code === item.target)?.label || item.target}</span><strong>{item.input}</strong><span className="saved-output">{item.output}</span><small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small></button>)}</div> : <div className="empty-state"><span className="empty-symbol">{empty.includes('기록') ? '◷' : '☆'}</span><h2>{empty}</h2><p>번역 화면에서 번역을 완료하면 이곳에 표시됩니다.</p></div>}
  </section>;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('text');
  const [source, setSource] = useState('ko');
  const [target, setTarget] = useState('en');
  const [input, setInput] = useState('');
  const inputBytes = new TextEncoder().encode(input.trim()).length;
  const [output, setOutput] = useState('');
  const [last, setLast] = useState<SavedTranslation | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SavedTranslation[]>(() => translationStore.history());
  const [favorites, setFavorites] = useState<SavedTranslation[]>(() => translationStore.favorites());
  const [detail, setDetail] = useState<{ item: SavedTranslation; from: 'history' | 'favorites' } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [imageSource, setImageSource] = useState('');
  const [imageResult, setImageResult] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function switchLanguage() {
    if (source === 'auto') { setStatus('언어 감지 상태에서는 언어를 교환할 수 없습니다. 원본 언어를 선택하세요.'); return; }
    setSource(target); setTarget(source); setInput(output || input); setOutput(''); setLast(null); setStatus('');
  }

  async function translateText() {
    if (!input.trim()) return;
    setBusy(true); setStatus(''); setOutput(''); setLast(null);
    try {
      const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, target, text: input.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `번역 실패 (${response.status})`);
      if (typeof data.translatedText !== 'string') throw new Error('번역 결과 형식이 올바르지 않습니다.');
      const entry = { id: crypto.randomUUID(), source: data.detectedSource || source, target, input: input.trim(), output: data.translatedText, createdAt: Date.now() };
      setOutput(entry.output); setLast(entry); translationStore.addHistory(entry); setHistory(translationStore.history());
    } catch (error) { setStatus(error instanceof Error ? error.message : '번역에 실패했습니다.'); }
    finally { setBusy(false); }
  }

  async function translateImage() {
    if (!file) return;
    setBusy(true); setStatus(''); setImageSource(''); setImageResult('');
    try {
      const form = new FormData(); form.set('source', source); form.set('target', target); form.set('image', file);
      const response = await fetch('/api/image-translate', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `이미지 번역 실패 (${response.status})`);
      const recognized = data.result?.data?.sourceText;
      const translated = data.result?.data?.targetText;
      if (typeof recognized !== 'string' || typeof translated !== 'string') throw new Error('이미지 번역 응답에 인식 텍스트 또는 번역 텍스트가 없습니다.');
      setImageSource(recognized); setImageResult(translated);
    } catch (error) { setStatus(error instanceof Error ? error.message : '이미지 번역에 실패했습니다.'); }
    finally { setBusy(false); }
  }

  function toggleFavorite() {
    if (!last) return;
    const added = translationStore.toggleFavorite(last); setFavorites(translationStore.favorites()); setStatus(added ? '즐겨찾기에 저장했습니다.' : '즐겨찾기에서 제거했습니다.');
  }

  function openDetail(item: SavedTranslation, from: 'history' | 'favorites') {
    setDetail({ item, from });
    setStatus('');
    setScreen('detail');
  }

  function toggleDetailFavorite() {
    if (!detail) return;
    const added = translationStore.toggleFavorite(detail.item);
    setFavorites(translationStore.favorites());
    setStatus(added ? '즐겨찾기에 저장했습니다.' : '즐겨찾기에서 제거했습니다.');
  }

  function restore(item: SavedTranslation) {
    setSource(item.source); setTarget(item.target); setInput(item.input); setOutput(item.output); setLast(item); setStatus(''); setScreen('text');
  }

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/tiff'].includes(selected.type) || selected.size > 20 * 1024 * 1024) { setStatus('JPG, PNG, TIFF 이미지(20MB 이하)만 지원합니다.'); return; }
    setFile(selected); setImageSource(''); setImageResult(''); setStatus('');
  };

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><button className="brand" onClick={() => setScreen('text')} aria-label="Papago Study 홈"><span className="brand-mark"><span /></span><span className="brand-word">papago</span></button><a className="dictionary-link" href="https://dict.naver.com" target="_blank" rel="noreferrer">사전 ↗</a><div className="header-right"><span className="study-badge">비공식 재구현</span><a href="https://papago.naver.com/" target="_blank" rel="noreferrer" className="original-link">원본 사이트 <Icon name="arrow" size={15} /></a></div></div></header>
    <main className="page-wrap"><nav className="main-nav" aria-label="기능 메뉴">{menu.map(item => <button key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => { setScreen(item.id); if (item.id === 'image') setSource('auto'); if (item.id === 'text' && source === 'auto') setSource('ko'); setStatus(''); }}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
      {(screen === 'text' || screen === 'image') && <>
        <div className="language-bar"><div className="language-side"><LanguagePicker value={source} onChange={value => { setSource(value); setStatus(''); }} allowAuto /></div><button className="swap-button" type="button" onClick={switchLanguage} aria-label="언어 교환" disabled={source === 'auto'}><Icon name="swap" /></button><div className="language-side target-side"><LanguagePicker value={target} onChange={value => { setTarget(value); setStatus(''); }} align="right" /></div><span className="glossary-indicator">용어집 ◉</span></div>
      </>}
      {screen === 'text' && <div className="panel-grid"><section className="translation-panel input-panel"><div className="panel-label">원문 <span>TEXT</span></div><div className="input-area"><textarea aria-label="번역할 텍스트" placeholder="번역할 내용을 입력하세요" value={input} maxLength={3000} onChange={event => { setInput(event.target.value); setOutput(''); setLast(null); setStatus(''); }} /><div className="input-bottom"><button className="icon-button" type="button" onClick={() => { setInput(''); setOutput(''); setLast(null); setStatus(''); }} aria-label="입력 지우기" disabled={!input}><Icon name="clear" size={18} /></button><span>{inputBytes.toLocaleString()} / 500바이트</span></div></div><div className="panel-footer"><button className="icon-button" type="button" onClick={() => speak(input, source, setStatus)} aria-label="원문 듣기" disabled={!input}><Icon name="volume" /></button><button className="translate-button" type="button" disabled={!input.trim() || busy} onClick={translateText}>{busy ? '번역 중…' : '번역하기'} <Icon name="arrow" size={18} /></button></div></section><section className="translation-panel result-panel"><div className="panel-label">번역 결과 <span>RESULT</span></div><div className={`result-body ${!output ? 'placeholder' : ''}`}>{output}</div><div className="panel-footer result-actions"><div><button className="icon-button" type="button" onClick={() => speak(output, target, setStatus)} aria-label="번역 결과 듣기" disabled={!output}><Icon name="volume" /></button><button className="icon-button" type="button" onClick={() => copy(output, setStatus)} aria-label="번역 결과 복사" disabled={!output}><Icon name="copy" /></button><button className={`icon-button ${last && translationStore.isFavorite(last) ? 'is-favorite' : ''}`} type="button" onClick={toggleFavorite} aria-label="즐겨찾기" disabled={!last}><Icon name="star" /></button></div><span className="result-caption">Powered by MyMemory</span></div></section></div>}
      {screen === 'image' && <div className="panel-grid image-grid"><section className="translation-panel image-panel"><div className="panel-label">이미지 업로드 <span>IMAGE</span></div><input type="file" ref={fileInput} accept="image/png,image/jpeg,image/tiff" className="visually-hidden" onChange={event => selectFile(event.target.files?.[0])} /><div className={`drop-zone ${preview ? 'has-image' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }}>{preview ? <img src={preview} alt="선택한 번역 이미지" /> : <><div className="upload-icon"><Icon name="upload" size={30} /></div><h2>이미지를 여기에 놓아주세요</h2><p>또는 클릭하여 파일을 선택하세요</p><small>JPG, PNG, TIFF · 최대 20MB</small></>}</div><div className="panel-footer"><span className="file-name">{file?.name || '이미지를 선택해 주세요'}</span><button className="translate-button" type="button" disabled={!file || busy} onClick={translateImage}>{busy ? '인식 및 번역 중…' : '이미지 번역'} <Icon name="arrow" size={18} /></button></div></section><section className="translation-panel result-panel image-result-panel"><div className="panel-label">인식 · 번역 결과 <span>OCR + RESULT</span></div>{imageResult ? <div className="image-text-results"><div><small>인식된 원문</small><p>{imageSource}</p></div><div><small>번역 결과</small><p>{imageResult}</p></div></div> : <div className="result-body placeholder"><span className="placeholder-icon">▧</span><p>이미지 번역 결과가 여기에 표시됩니다.</p><small>Apple Vision OCR과 MyMemory를 사용합니다</small></div>}<div className="panel-footer result-actions"><button className="icon-button" type="button" onClick={() => copy(imageResult, setStatus)} disabled={!imageResult} aria-label="이미지 번역 결과 복사"><Icon name="copy" /></button><span className="result-caption">OCR + Translation</span></div></section></div>}
      {screen === 'history' && <SavedList entries={history} empty="번역 기록이 없습니다" onSelect={item => openDetail(item, 'history')} onDeleteAll={() => { translationStore.clearHistory(); setHistory([]); }} />}
      {screen === 'favorites' && <SavedList entries={favorites} empty="즐겨찾기가 없습니다" onSelect={item => openDetail(item, 'favorites')} onDeleteAll={() => { translationStore.clearFavorites(); setFavorites([]); }} />}
      {screen === 'detail' && detail && <TranslationDetail item={detail.item} from={detail.from} favorite={translationStore.isFavorite(detail.item)} onBack={() => { setStatus(''); setScreen(detail.from); }} onOpenTranslator={() => restore(detail.item)} onToggleFavorite={toggleDetailFavorite} onStatus={setStatus} />}
      {(['document', 'voice', 'website', 'glossary', 'settings'] as Screen[]).includes(screen) && <section className="unavailable-section"><h1>{[...menu, ...sideMenu].find(item => item.id === screen)?.label}</h1><p>이 기능은 현재 재구현에서 제공하지 않습니다.</p></section>}
      {status && <div className="status-message" role="status"><span>!</span>{status}<button type="button" onClick={() => setStatus('')} aria-label="알림 닫기"><Icon name="clear" size={16} /></button></div>}
    </main><aside className="side-nav" aria-label="보관 및 설정">{sideMenu.map(item => <button key={item.id} className={`side-item ${screen === item.id ? 'active' : ''}`} onClick={() => { setScreen(item.id); setStatus(''); }}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</aside><footer className="footer"><div><span className="footer-brand">papago<span>.</span></span><p>대학 역공학 과제용 비공식 재구현입니다. NAVER 및 Papago와 제휴하거나 승인받은 서비스가 아닙니다.</p></div><a href="https://papago.naver.com/" target="_blank" rel="noreferrer">Official Papago ↗</a></footer>
  </div>;
}
