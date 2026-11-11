# 구현 및 재검증 보고서

갱신일: 2026-11-11. 이 문서는 현재 저장소의 코드와 전체 재실행 결과를 기준으로 한다. 테스트에서 모의 응답을 쓴 경우와 외부 서비스를 실제 호출한 경우를 구분했다.

## 현재 작업물

React 19 + TypeScript + Vite 7 UI를 유지한다. 텍스트 번역은 서버의 `/api/translate`에서 [MyMemory REST API](https://mymemory.translated.net/doc/spec.php)를 호출한다. 이미지 번역은 `/api/image-translate`가 Tesseract.js로 OCR한 텍스트를 같은 번역 함수에 넘긴다. 운영체제 전용 Apple Vision 코드는 사용하지 않는다. OCR의 `eng`, `kor`, `jpn` 모델은 `server/tessdata/`에 포함되어 첫 실행 시 별도 모델 다운로드가 필요하지 않다.

NAVER Cloud API에서 MyMemory로 변경한 이유는 Papago 인증 정보 없이 공개 무료 REST API로 번역을 실행하기 위해서다. 이것은 **재구현 앱의 API 선택**이며 원본 Papago의 내부 API 분석 결과가 아니다. [MyMemory 공식 사용량 문서](https://mymemory.translated.net/doc/usagelimits.php) 기준 익명 무료 한도는 하루 5,000자, 유효한 `de` 이메일을 제공하면 하루 50,000자다. 앱은 선택적 `MYMEMORY_EMAIL` 환경 변수를 `de`에 전달한다. 요청 한 건의 텍스트는 UTF-8 500바이트 이하로 제한한다.

## 기능별 재검증

| 기능 | 현재 구현과 확인 결과 | 검증 범위 |
| --- | --- | --- |
| 텍스트 번역 | 한국어·영어·일본어 언어쌍을 MyMemory `q`, `langpair`에 연결. 성공 응답만 번역문과 기록에 저장 | 서버 자동 테스트 통과. MyMemory 직접 실호출 성공. 앱 서버 경유 실호출은 현재 환경에서 502 |
| 언어 선택·교환 | 선택값이 다음 요청에 반영되고 교환 시 원본·목표가 바뀜. 자동 감지 중 교환 버튼 비활성화 | 언어쌍 서버 테스트 통과, UI 동작은 코드 확인. 브라우저 클릭 실측 없음 |
| 자동 언어 감지 | 한글·가나·라틴 문자로 명확한 입력만 감지, 모호한 한자는 오류 | 서버 자동 테스트 통과 |
| 미지원·동일 언어 | API 호출 전에 422 오류. 언어 메뉴에는 다른 언어도 표시되지만 이 서버에서는 한국어·영어·일본어만 번역 가능 | 서버 자동 테스트 통과 |
| 500바이트 제한 | 텍스트와 OCR 결과를 UTF-8 바이트로 측정해 초과 시 413, 외부 API 미호출 | 경계값 및 OCR 초과 자동 테스트 통과 |
| API 실패·일일 한도 | HTTP/응답 실패, 빈 결과, 연결 예외는 오류. 사용량 초과는 429. 가짜 번역문을 만들지 않음 | 모의 응답·예외 자동 테스트 통과. 실제 한도 초과 재현은 하지 않음 |
| 이미지 파일 선택 | JPG·PNG·TIFF와 20MB 이하만 허용, 미지원 형식은 OCR 전에 거부. 이미지 미리보기 제공 | 형식 거부 자동 테스트 통과. 20MB 경계와 브라우저 드롭·미리보기 실측 없음 |
| 실제 OCR | Tesseract.js worker가 샘플 PNG에서 영어 `Hello`를 인식. 한국어·일본어 10개 이미지도 각 언어 모델로 OCR 완료 | 실제 worker 실행. 현재 10개 이미지에 입력된 정답으로 CER·WER 계산 완료 |
| 이미지 OCR → 번역 | 실제 OCR이 읽은 `Hello`가 이미지 API 경로를 거쳐 MyMemory 요청으로 전달되고 번역 응답이 반환됨 | 실제 OCR + 모의 MyMemory 자동 테스트 통과. 외부 MyMemory까지 포함한 일괄 실호출은 미확인 |
| 기록·즐겨찾기 | 성공한 텍스트 번역 기록, 즐겨찾기 추가·해제, 전체 삭제, `localStorage` 재읽기 및 손상 데이터 처리 | 저장소 자동 테스트 통과. 실제 브라우저 세션 간 보존 실측 없음. 이미지 번역은 기록에 저장하지 않음 |
| 번역 상세 | 기록·즐겨찾기 항목 선택, 원문·번역문과 언어 표시, 뒤로 가기, 번역기로 열기, 즐겨찾기 변경 | SSR 출력 및 컴포넌트 콜백 자동 테스트 통과. 실제 브라우저 화면 전환 실측 없음 |
| TTS·복사 | 텍스트 화면과 상세 화면에서 Web Speech API 및 Clipboard API 사용, 상세의 원문·번역문 각각 동작 | 상세 화면의 브라우저 API 모의 테스트 통과. 실제 소리·클립보드 실측 없음 |
| 사전 링크 | `dict.naver.com`으로 여는 외부 링크 | 마크업 확인. 외부 페이지 이동 실측 없음 |
| 문서·음성·웹사이트·용어집·설정 | 메뉴와 미구현 안내만 제공 | 코드 확인. 실제 기능 미구현 |

실제 내용과 전환 로직이 있는 독립 화면은 **5개**다: 텍스트 번역, 이미지 번역, 번역 기록, 즐겨찾기, 번역 상세. 다섯 화면의 존재는 코드 확인이며, 자동 UI 테스트는 초기 화면과 목록·상세 컴포넌트를 검사했다. 모든 화면을 브라우저로 직접 이동하며 확인한 결과는 아니다. 미구현 안내 화면은 이 숫자에서 제외했다.

## 실행 결과와 오류

| 실행 | 결과 |
| --- | --- |
| `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` | 이전 검증에서 성공. 이번 재검증에서는 설치를 다시 실행하지 않음 |
| `npm test` | 이번 재검증 **19개 통과, 0개 실패**. 번역·오류·OCR·저장소·상세 컴포넌트·정확도 계산 테스트. 전체 실행 약 366 ms |
| `npm run build` | 이번 재검증 성공. TypeScript 검사와 Vite 프로덕션 빌드 완료. Vite 빌드 약 554 ms |
| 실제 Tesseract.js OCR | `tests/fixtures/hello.png`에서 `en` → `Hello`, `ja` → `Hello`, `auto` → `Hello`; `ko` 모델은 로드·처리되었으나 영어 이미지에 `너티10` 반환 |
| 실제 MyMemory 직접 호출 | 이번 재검증에서 `curl`로 `Hello`, `en|ko` 호출: HTTP 200, `responseStatus: 200`, `quotaFinished: false`, `translatedText: "반갑습니다,"` |
| 이전 직접 실호출 | `안녕하세요` `ko|en` → `Hi,`; `Hello` `en|ja` → `こんにちは`; `ありがとう` `ja|ko` → `감사합니다`. 모두 `responseStatus: 200`, `quotaFinished: false` |
| 앱 서버 번역 함수의 실제 외부 호출 | 이번 재검증에서 `translateWithMyMemory({ source:'en', target:'ko', text:'Hello' })` → **502**, `MyMemory API 연결 또는 응답 처리에 실패했습니다.`. 약 101 ms 후 오류 응답, 번역문 없음. 이 환경에서 앱 프로세스의 외부 연결이 실패함 |
| 개발 서버·브라우저 실측 | 이번 재검증에서 `npm run dev -- --host 127.0.0.1` → `listen EPERM: operation not permitted 127.0.0.1:5173`. 로컬 브라우저 전체 동작 검증 불가. 이전 Headless Chrome 로컬 파일 실행도 종료 코드 134 |

직접 `curl`의 실서비스 성공은 앱 서버 경유 번역 성공을 뜻하지 않는다. 현재 실행 환경에서는 서버의 실제 외부 연결이 막혀 있어 텍스트와 이미지의 **앱 내 실번역 성공은 미확인**이다. 자동 테스트의 모의 MyMemory 성공도 실서비스 성공으로 기록하지 않는다. API 실패 시 화면은 결과를 비우고 오류를 표시한다.

## OCR 정량 평가 시스템 및 이번 실행

이미지 원본은 `tests/images/`에 10개 있었다. 요청에 적힌 `test/images/` 폴더는 없었으므로 원본 위치와 파일명을 변경하지 않고 실제 폴더를 사용했다. 스크립트는 `test/images/`가 있으면 그쪽을 우선 사용한다. PNG·JPG·JPEG·WEBP를 탐색하고 `ko`+숫자는 `kor`, `jp`+숫자는 `jpn` 모델로 처리한다. 다른 파일명은 `invalid_filename` 오류로 기록한다. OCR 호출과 모델 설정은 앱의 `server/tesseract-ocr.mjs`를 재사용하며 신뢰도만 추가로 읽는다.

| 항목 | 이번 실행 결과 |
| --- | --- |
| 실행 명령 | `npm run test:ocr:prepare`, `npm run test:ocr` 모두 성공 |
| 이미지 수 | 전체 10개: 한국어 5개, 일본어 5개, 잘못된 파일명 0개 |
| OCR 실행 | 추출 텍스트가 있는 성공 10개, 실패 0개, OCR 엔진 오류 0개 |
| 정확도 평가 | 현재 정답 입력 10개를 보존한 채 모두 평가. OCR 출력은 정답으로 사용하지 않음 |
| 처리 시간 | 이번 `test:ocr` 실행 평균 209.4 ms, 최대 285.4 ms. 이미지별 시간은 결과 보고서에 기록 |
| 인식 경고 | 실행 콘솔에서 각 PNG에 `libpng warning: iCCP: extra compressed data` 출력. OCR은 완료됐다. 이미지의 ICC 프로필 메타데이터 관련 경고로 보이며 정확도 영향은 판단하지 않았다 |
| 환경 | Node.js v24.22.2, macOS Darwin 27.0.0 arm64, Apple M3 Pro, Tesseract.js 7.0.0 |

이번 실행은 `test/ocr-ground-truth.json`의 10개 `groundTruth`를 보존했다. 입력된 정답과 실제 OCR 결과에 Unicode NFC·연속 공백/줄바꿈 한 칸 치환·양끝 공백 제거를 적용한 뒤 Levenshtein 문자/단어 편집거리를 계산했다. CER·WER의 언어별·전체 값은 개별 비율의 평균이 아니라 **편집거리 합계 / 정답 길이 합계**다. 공백은 CER의 문자 수에 포함한다. OCR 결과를 정답으로 간주하지 않았다.

| 구분 | 평가 이미지 | CER | WER | 편집거리 근거 |
| --- | ---: | ---: | ---: | --- |
| 한국어 | 5 | **6.78%** | **18.75%** | 문자 4/59, 단어 3/16 |
| 일본어 | 5 | **76.00%** | **820.00%** | 문자 38/50, 단어 41/5 |
| 전체 | 10 | **38.53%** | **209.52%** | 문자 42/109, 단어 44/21 |

일본어 OCR 결과에는 글자 사이 공백이 많이 들어간 반면, 입력된 정답의 각 문장은 공백 없는 한 단어다. 현재 공백 기반 WER 규칙에서는 삽입 단어가 많아 100%를 크게 넘는다. 이 값은 계산 오류가 아니라 현재 정규화·토큰화 규칙의 결과이며, 일본어 읽기 정확도를 단독으로 해석하는 데 한계가 있다. CER에도 삽입 공백이 포함된다. 한국어 오류 예시는 `ko4.png`의 `땡기네` → `때네`, `ko5.png` 끝의 불필요한 `|`, `ko1.png` 끝 마침표 추가다. 이미지 품질·글꼴이 원인인지는 별도 영상 분석 없이 단정하지 않았다.

실제 추출 텍스트, 신뢰도, 개별 처리 시간, 이미지별 CER·WER, 오류 사례는 [OCR JSON 결과](reports/ocr-results.json)와 [OCR Markdown 보고서](reports/ocr-results.md)에 기록했다. Tesseract 신뢰도는 정답 대비 정확도 수치가 아니다.

## 원본 Papago와 기능 비교

원본 사이트에서 REA로 확인한 UI 구조와 Evidence ID는 [REA_ANALYSIS.md](REA_ANALYSIS.md)에 유지한다. 상단 텍스트·이미지 등 기능 탭, 오른쪽 History·Favorites 메뉴, 원문·결과 작업 영역을 재구현 UI에 반영했다. 이 보고서의 앱 기능 테스트는 원본 사이트의 내부 구현을 증명하지 않는다.

| 기능 | 원본 Papago 관찰 | 현재 재구현 분류 |
| --- | --- | --- |
| 텍스트·이미지 작업 영역과 주요 메뉴 | REA UI 분석에 기록 | 관찰한 UI 구조를 반영. 번역 엔진은 MyMemory, OCR은 Tesseract.js |
| History·Favorites 메뉴 | REA에서 메뉴 확인 | 로컬 저장소 기반 목록 구현 |
| 저장 항목의 독립 상세 화면 | 비로그인 캡처에서 항목이 없어 존재 여부 확인 불가 | **추가 구현 기능**. 기록·즐겨찾기 항목을 누르면 독립 화면 표시 |
| 상세 화면의 TTS·복사·즐겨찾기·뒤로 가기 | 원본의 항목별 상세 조작 확인 불가 | **추가 구현 기능** |
| 문서·음성·웹사이트·용어집·설정 내부 기능 | 메뉴는 관찰 | 재구현에서 미구현 |

REA History 클릭 Evidence `ev_841e37a85e3725e11f826c505be89fad184c76874650a6516923d0b5f13352a7`은 버튼 클릭 성공까지만 확인했다. 저장 항목이 없었으므로 상세 화면을 원본 재현 기능으로 분류하지 않는다.

## 관련 파일

- `src/App.tsx`, `src/styles.css`, `src/storage.ts`: 화면, 동작, 로컬 데이터
- `server/translation.mjs`, `server/tesseract-ocr.mjs`, `server/tessdata/`: 번역 API, OCR, 로컬 언어 모델
- `tests/translation.test.mjs`, `tests/ocr.test.mjs`, `tests/storage.test.mjs`, `tests/ui.test.mjs`, `tests/fixtures/hello.png`: 자동 검증
- `scripts/ocr-evaluate.mjs`, `tests/ocr-evaluate.test.mjs`: OCR 일괄 실행 및 Levenshtein 정확도 계산
- `tests/images/`, `test/ocr-ground-truth.json`, `reports/ocr-results.json`, `reports/ocr-results.md`: 원본 테스트 이미지, 정답 입력 파일, 실행 결과
- `README.md`: 실행 방법과 API 사용 한도
