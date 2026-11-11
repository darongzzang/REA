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
- 이미지: `/api/image-translate`가 [Tesseract.js](https://github.com/naptha/tesseract.js)로 JPG·PNG·TIFF의 텍스트를 인식한 다음 MyMemory에 전달합니다. 한국어·영어·일본어 모델을 사용하며, 원본 언어가 자동 감지이면 세 모델을 함께 불러옵니다. 언어 모델은 `server/tessdata/`에 포함되어 있어 첫 OCR 실행에 별도 다운로드가 필요하지 않습니다. OCR 결과가 없거나 500바이트를 넘으면 번역을 요청하지 않습니다.
- `tesseract.js`는 `npm install`로 설치합니다. 현재 작업물에서는 실제 Tesseract worker가 샘플 PNG의 `Hello`를 인식한 것을 확인했습니다. 모델 출처와 라이선스는 `server/tessdata/README.md`에 기록했습니다.
- 실패·일일 사용량 초과·미지원 언어 조합에는 오류를 표시하며 가짜 번역문을 만들지 않습니다. 기록과 즐겨찾기는 기존 브라우저 `localStorage`에 저장합니다.

MyMemory로 변경한 이유는 NAVER Cloud의 번역·이미지 API 인증 정보 없이 무료 공개 REST API로 텍스트 번역을 실행하기 위해서입니다. 원본 Papago 웹사이트가 MyMemory를 사용한다는 뜻은 아닙니다. MyMemory 익명 무료 한도와 이메일 사용 한도는 [공식 사용량 문서](https://mymemory.translated.net/doc/usagelimits.php)를 기준으로 했습니다.

**`npm run preview`와 정적 `dist/`에는 Vite 개발 서버의 API 미들웨어가 포함되지 않습니다.** 배포할 때는 같은 서버 엔드포인트를 별도로 배치해야 합니다.

## 검증

```bash
npm test
npm run build
npm run test:ocr:prepare
npm run test:ocr
```

OCR 평가 명령은 현재 이미지가 들어 있는 `tests/images/`를 사용합니다. `test/images/`가 있으면 그 폴더를 우선 사용하며, PNG·JPG·JPEG·WEBP를 자동 탐색합니다. `ko`+숫자 파일명에는 한국어 모델, `jp`+숫자 파일명에는 일본어 모델을 적용합니다. 원본 이미지는 수정하지 않습니다.

`npm run test:ocr:prepare`는 실제 OCR 결과를 [test/ocr-ground-truth.json](test/ocr-ground-truth.json)에 기록합니다. 각 항목의 `groundTruth`에 **이미지를 직접 확인한 원문**을 입력하세요. `ocrText`를 정답으로 복사하지 마세요. `npm run test:ocr`을 실행하면 입력된 정답을 보존하면서 OCR을 다시 수행하고 [JSON 결과](reports/ocr-results.json)와 [읽기용 보고서](reports/ocr-results.md)를 갱신합니다. 정답이 없는 항목은 CER·WER를 계산하지 않습니다.

실제 API 호출 결과와 OCR 검증 범위는 [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)에 기록했습니다.
