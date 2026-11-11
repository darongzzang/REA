# 구현 및 검증 보고서

갱신일: 2026-11-11

## API 변경

기존 NAVER Cloud Papago Translation 및 Image Translation 중계를 제거했다. 인증 정보 없이 텍스트 번역을 사용할 수 있도록 [MyMemory REST API](https://mymemory.translated.net/doc/spec.php)의 `/get`으로 교체했다. 기존 React + TypeScript + Vite UI, 번역 기록, 즐겨찾기는 유지했다. 원본 Papago 사이트의 API 사용 방식과는 무관한 **재구현 앱의 선택**이다.

| 항목 | 현재 구현 |
| --- | --- |
| 텍스트 | 서버의 `/api/translate`가 `q`와 `langpair`를 MyMemory에 전달. 한국어·영어·일본어 우선 지원 |
| 언어 선택·교환 | 화면의 원본·목표 언어를 매 요청의 `langpair`에 반영. 미지원·동일 언어 조합 거부 |
| 자동 감지 | 한글·가나·라틴 문자로 명확한 입력만 감지. 한자만 있는 등 모호한 입력은 거부 |
| 요청 크기 | `Buffer.byteLength(..., 'utf8')`로 500바이트 초과를 API 호출 전에 거부 |
| 사용량 | [MyMemory 공식 한도](https://mymemory.translated.net/doc/usagelimits.php): 익명 무료 5,000자/일, 유효한 `de` 이메일 제공 시 50,000자/일. 앱은 서버가 반환한 사용량 초과를 429 오류로 표시 |
| 이미지 | 운영체제 독립형 Tesseract.js OCR. 선택한 한국어·영어·일본어 모델로 읽은 텍스트를 같은 MyMemory 번역 함수에 전달. JPG·PNG·TIFF, 20MB 이하 |
| 오류 | HTTP 오류, `responseStatus` 실패, 빈 번역문, 일일 사용량 초과, OCR 실패 시 번역 결과를 만들지 않음 |
| 기록·즐겨찾기 | 기존 `localStorage` 구현 유지. 성공한 텍스트 번역만 기록에 추가 |
| 번역 상세 | 기록·즐겨찾기 항목에서 독립 화면으로 진입. 원문·번역문, 언어, 각각의 TTS·복사, 즐겨찾기 추가·해제, 이전 목록으로 돌아가기 및 번역기에서 열기 제공 |

MyMemory의 요청당 500바이트 제한 때문에 긴 텍스트와 긴 OCR 결과는 번역하지 않는다. 문장 분할은 문맥과 번역 단위를 바꾸므로 자동 적용하지 않았다. Apple Vision 의존성은 제거했다. [Tesseract.js 공식 문서](https://github.com/naptha/tesseract.js)는 브라우저와 Node.js에서 WebAssembly OCR을 지원하며, 언어 데이터는 첫 사용 시 다운로드할 수 있다고 설명한다. 시스템 `curl`은 Node `fetch`가 DNS 조회에 실패하는 환경에서만 재시도에 사용한다.

## 실제 외부 API 확인

2026-11-11에 `curl -G https://api.mymemory.translated.net/get`으로 세 언어쌍을 실제 호출했다. 모두 **HTTP 요청 성공**, `responseStatus: 200`, `quotaFinished: false`를 반환했다.

| 요청 | 실제 `responseData.translatedText` |
| --- | --- |
| `안녕하세요`, `ko|en` | `Hi,` |
| `Hello`, `en|ja` | `こんにちは` |
| `ありがとう`, `ja|ko` | `감사합니다` |

이 문자열은 MyMemory의 실제 응답이며 앱이 생성한 대체 문구가 아니다.

같은 샌드박스에서 Node의 기본 `fetch`는 `ENOTFOUND`, Node 자식 프로세스의 `curl`도 `Could not resolve host: api.mymemory.translated.net`으로 실패했다. 따라서 **앱 서버 경로를 통한 실서비스 번역 성공은 확인하지 못했다.** 직접 `curl` 호출의 성공과 서버 경로의 실패를 구분한다. 일반 네트워크 환경에서의 서버 경로 재검증이 남아 있다.

## 테스트 결과

| 검사 | 결과 |
| --- | --- |
| `npm test` | 13개 통과: 언어쌍, 500바이트 경계, 사용량·실패 응답, 미지원 언어, OCR worker의 모델 선택·종료, OCR 텍스트 연결, 기록·즐겨찾기, UI |
| `npm run build` | TypeScript 검사 및 Vite 프로덕션 빌드 성공. 상세 화면 추가 후 재실행 |
| `npm run dev -- --host 127.0.0.1` | 실패: 이 샌드박스의 `listen EPERM`으로 브라우저에서 로컬 앱을 열 수 없음 |
| MyMemory 실제 REST 호출 | 성공: `ko|en`, `en|ja`, `ja|ko` 모두 `responseStatus: 200` |
| 앱 서버 경로의 실제 외부 호출 | 실패: 현재 샌드박스의 DNS 제한으로 502 반환. 가짜 번역문 없음 |
| `npm install` / 실제 Tesseract.js 이미지 인식 | 실패: npm 레지스트리 DNS `ENOTFOUND`, 오프라인 설치는 `ENOTCACHED`. 이 세션에서 실제 OCR 및 최종 이미지 번역 성공은 미확인 |
| 이미지 번역 경로 | 모의 Tesseract worker와 MyMemory 응답 연결 테스트 통과. 실제 이미지 OCR 및 최종 이미지 번역 성공은 미확인 |

API 성공 모의 테스트는 실서비스 성공의 증거로 취급하지 않는다. 이미지에 텍스트가 없거나 500바이트를 넘으면 MyMemory 요청을 보내지 않는다.

## 원본과 재구현의 경계

원본 Papago의 REA UI 구조·기능 관찰과 Evidence ID는 [REA_ANALYSIS.md](REA_ANALYSIS.md)에 그대로 보존했다. 원본의 번역 API 경로와 동작은 이 MyMemory 전환의 근거가 아니다. UI는 상단 기능 탭, 오른쪽 보관 메뉴, 텍스트·이미지 작업 영역을 유지한다. 문서·음성·웹사이트·용어집·설정 내부 기능은 계속 미구현이다.

### 기능 비교: 번역 상세 화면

| 기능 | 원본 Papago 관찰 | 재구현 분류 및 동작 |
| --- | --- | --- |
| 번역 기록·즐겨찾기 목록 | 오른쪽 History·Favorites 메뉴 확인 | 기존 로컬 목록 유지 |
| 저장 항목의 독립 상세 화면 | 비로그인 REA 캡처에서 항목을 확보하지 못해 존재 여부 미확인 | **추가 구현 기능**. 목록 클릭 시 `detail` 화면으로 이동 |
| 상세 화면의 TTS·복사·즐겨찾기·뒤로 가기 | 원본의 항목별 상세 동작 미확인 | **추가 구현 기능**. 선택 항목의 내용과 원래 목록을 유지하며 조작 |

REA에서 History 버튼 클릭 시나리오를 추가 실행했다(Evidence `ev_841e37a85e3725e11f826c505be89fad184c76874650a6516923d0b5f13352a7`). 버튼 클릭은 성공했지만 비로그인 상태에 저장된 항목이 없어 원본의 항목 상세 동작은 검증하지 못했다. 따라서 상세 화면을 원본 재현 기능으로 분류하지 않았다.

실제 내용과 전환이 있는 화면은 **5개**로 확인했다: 텍스트 번역, 이미지 번역, 번역 기록, 즐겨찾기, 번역 상세. 문서·음성·웹사이트·용어집·설정의 미구현 안내는 이 숫자에 포함하지 않았다. 상세 화면은 `Screen`의 독립 상태이며 기록·즐겨찾기 어느 쪽에서 들어왔는지 보관해 해당 목록으로 돌아간다. 즐겨찾기 해제 후 목록으로 돌아가면 기존 저장소 상태에 따라 항목이 사라진다.

## 파일

- `src/App.tsx`, `src/styles.css`: 기존 화면과 상호작용
- `server/translation.mjs`: MyMemory 중계, 언어·크기·오류 검사, 이미지 경로
- `server/tesseract-ocr.mjs`: Tesseract.js OCR 및 언어 모델 선택
- `vite.config.ts`: 개발 서버 API 미들웨어
- `tests/translation.test.mjs`, `tests/storage.test.mjs`, `tests/ui.test.mjs`: 검증
