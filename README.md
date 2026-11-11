# Papago Study

Papago 공개 화면을 참고한 비공식 React + TypeScript + Vite 재구현입니다. NAVER 및 Papago와 제휴한 서비스가 아닙니다. 원본 UI 분석은 [REA_ANALYSIS.md](REA_ANALYSIS.md)에 기록했습니다.

## 실행

Node.js 20.19+ 또는 22.12+가 필요합니다. 이미지 OCR은 운영체제에 묶이지 않는 Tesseract.js를 사용합니다.

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 텍스트 번역에 API 키는 필요하지 않습니다. 익명 MyMemory 사용량은 하루 5,000자이며, 연락 가능한 이메일을 `.env`에 `MYMEMORY_EMAIL`로 설정하면 MyMemory 문서상 하루 50,000자로 늘어납니다. 이메일은 선택 사항입니다.

```dotenv
MYMEMORY_EMAIL=
```

## 번역 방식

- 텍스트: Vite 서버의 `/api/translate`가 [MyMemory REST `get` API](https://mymemory.translated.net/doc/spec.php)에 요청합니다. 한국어·영어·일본어를 지원합니다. 언어 선택과 교환은 API의 `langpair`에 반영됩니다.
- MyMemory는 요청당 UTF-8 **500바이트**를 허용합니다. 앱은 초과 입력을 거부합니다. 긴 글을 임의로 나누어 번역하지 않습니다.
- 자동 감지는 한글·일본어 가나·라틴 문자로 명확히 판단할 수 있는 입력만 처리합니다. 한자만 있거나 혼합되어 모호한 텍스트는 원본 언어를 직접 선택해야 합니다.
- 이미지: `/api/image-translate`가 [Tesseract.js](https://github.com/naptha/tesseract.js)로 JPG·PNG·TIFF의 텍스트를 인식한 다음 MyMemory에 전달합니다. 한국어·영어·일본어 모델을 사용하며, 원본 언어가 자동 감지이면 세 모델을 함께 불러옵니다. 첫 실행 때 언어 데이터 다운로드를 위해 인터넷이 필요합니다. OCR 결과가 없거나 500바이트를 넘으면 번역을 요청하지 않습니다.
- `tesseract.js` 의존성은 `npm install`로 설치합니다. 이번 작업 환경에서는 npm 레지스트리 DNS 조회가 실패해 설치·실제 이미지 인식을 확인하지 못했습니다. 기존 잠금 파일은 새 의존성과 맞지 않아 제거했으며, `npm install`이 새 잠금 파일을 생성합니다.
- 실패·일일 사용량 초과·미지원 언어 조합에는 오류를 표시하며 가짜 번역문을 만들지 않습니다. 기록과 즐겨찾기는 기존 브라우저 `localStorage`에 저장합니다.

MyMemory로 변경한 이유는 NAVER Cloud의 번역·이미지 API 인증 정보 없이 무료 공개 REST API로 텍스트 번역을 실행하기 위해서입니다. 원본 Papago 웹사이트가 MyMemory를 사용한다는 뜻은 아닙니다. MyMemory 익명 무료 한도와 이메일 사용 한도는 [공식 사용량 문서](https://mymemory.translated.net/doc/usagelimits.php)를 기준으로 했습니다.

**`npm run preview`와 정적 `dist/`에는 Vite 개발 서버의 API 미들웨어가 포함되지 않습니다.** 배포할 때는 같은 서버 엔드포인트를 별도로 배치해야 합니다.

## 검증

```bash
npm test
npm run build
```

실제 API 호출 결과와 이미지 OCR 검증 한계는 [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)에 기록했습니다.
