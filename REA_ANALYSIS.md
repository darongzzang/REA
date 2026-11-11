# Papago 공개 웹 REA 분석 기록

조사일: 2026-11-11 · 원본: <https://papago.naver.com/>

## MCP 등록 및 호출 결과

이번 세션의 도구 목록에 `mcp__rea__*` 도구가 노출됐다. `binary_session({})`가 `open: false`와 기능 목록을 정상 반환했으므로 **REA MCP 연결이 작동함을 확인했다.** 이전 세션에서 기록한 미등록 상태는 현재 상태가 아니다.

| 도구·호출 | 결과 | Evidence |
| --- | --- | --- |
| `binary_session({})` | 성공. 활성 바이너리 없음, REA 기능 목록 반환 | 상태 조회 |
| `capture_browser_scenario` 첫 시도 | 실패: `invalid_request` / `invalid_input`. `capture`의 `dom`, `accessibility`, `screenshot` 키가 스키마에 없음 | 생성 안 됨 |
| `capture_browser_scenario`, Chrome launch, 첫 화면, `wait_for(body)` | 성공. URL·DOM·접근성·1280×720 PNG 캡처. 소유 Chrome 프로세스 종료 확인 | `ev_18b38cc4c7886bd8ffb6680ab30a9dccc72a5d94e12e89c6031691ed76e07b8b` |
| `capture_browser_scenario`, 입력 `안녕하세요` → Image 클릭 → 화면 대기 | 성공. 각 단계의 URL·접근성, 최종 이미지 화면 DOM·PNG 캡처. 소유 Chrome 프로세스 종료 확인 | `ev_69db12865cdae119fae9ba602d705818cfd445490faaa2af47a0a13f82dab74d` |

첫 시도는 스키마 오류를 확인하고 `capture.at_end` 및 `capture.after_each_step`으로 수정했다. 오류가 난 시도에서 분석이 수행됐다고 간주하지 않았다.

## 실제 관찰

두 캡처 모두 REA가 원본 공개 사이트를 Chrome 157의 임시 프로필에서 열고 실행한 **통제된 브라우저 시나리오**다. 기본 뷰포트는 1280×720, 로케일은 `en-US`였다. 아래 영어 표기는 그 로케일의 실제 접근성 트리에서 확인한 것이다.

| 영역 | REA 관찰 | Evidence |
| --- | --- | --- |
| 상단 | Papago 링크, Dictionary 외부 링크, Papago Plus 버튼 | 첫 화면 접근성·PNG |
| 기능 탭 | Text, Image, Document, Voice, Website가 상단 중앙의 둥근 탭에 배치. Image 링크의 경로는 `/image` | 첫 화면 접근성·PNG |
| 보관 메뉴 | History, Favorites, Glossary, Settings 버튼이 오른쪽 세로 메뉴에 배치 | 첫 화면 접근성·PNG |
| 텍스트 작업 영역 | 기본 원본 언어 Korean, 목표 언어 English. 언어 선택 두 개와 교환 버튼, 왼쪽 편집 영역·오른쪽 결과 영역, 하단 조작 아이콘. 원본 화면은 큰 소개 제목을 두지 않음 | 첫 화면 접근성·PNG |
| 텍스트 입력 | `[contenteditable=true]`에 `안녕하세요`를 입력하자 접근성 트리의 textbox 문단에 문자열과 `5/3000`이 표시됨 | 두 번째 시나리오 `editor` 단계 |
| 이미지 첫 화면 | Image 클릭 후 `/image`로 이동. 원본 언어는 Detect language, 목표 언어는 English. 업로드 영역은 빈 상태에서 하나의 넓은 패널이며 드래그 안내와 Load image 버튼을 표시 | 두 번째 시나리오 `image_loaded` 단계·PNG |
| 이미지 형식 안내 | 원본 UI에 JPG, JPEG, PNG, GIF 지원 문구가 표시 | 이미지 화면 접근성·PNG |

DOM에서 Next.js의 `/_next/static/chunks/` 자산 참조도 확인했다. 이는 배포된 화면의 프런트엔드 자산 구조에 관한 관찰이며 서버 내부 구현을 뜻하지 않는다.

## 기존 React 구현과 비교 및 반영

| 차이 | 반영 |
| --- | --- |
| 기존 기능 탭에 기록·즐겨찾기·사전이 섞여 있었음 | 상단을 Text·Image·Document·Voice·Website로 정리하고 기록·즐겨찾기·용어집·설정을 오른쪽 별도 메뉴로 이동 |
| 기존 화면에 큰 홍보 제목과 녹색 장식, 카드형 패널이 있었음 | 제목을 제거하고 원본의 낮은 언어 바와 넓은 두 칸 작업 영역에 가까운 치수·색으로 수정 |
| 기존 기본 원본 언어가 자동 감지였음 | Text 초기 화면은 한국어, Image로 이동하면 자동 감지 선택 |
| 기존 Image 빈 화면이 두 칸 결과 레이아웃이었음 | 결과가 없는 동안 한 장의 업로드 패널로 표시 |
| 원본에는 Document·Voice·Website·Glossary·Settings 진입 항목이 있음 | 메뉴 항목을 표시하고, 구현되지 않은 기능은 명확히 안내 |

이미지 형식은 원본 UI에서 GIF를 안내하지만 현재 재구현의 공식 이미지 API 중계는 JPG·PNG·TIFF만 검증한다. 지원하지 않는 형식을 원본과 같다고 표시하지 않았다. 로고·아이콘은 자체 제작 자산이다.

## 관찰 범위와 미확인 사항

- 첫 캡처의 `completeness.status`는 `incomplete`다. 일부 네트워크 요청이 캡처 종료 시점까지 완료되지 않아 이벤트 범위가 완전하지 않다.
- 입력 후 실제 번역 결과나 원본 번역 API의 요청·응답은 확인하지 않았다. 입력 직후 접근성 트리에는 결과가 없었다. 원본이 어느 요청을 보내는지, 어떤 조건에서 번역되는지는 미확인이다.
- 이미지 파일 자체를 업로드하거나 OCR·번역 결과를 관찰하지 않았다. History·Favorites·Glossary·Settings 및 Document·Voice·Website의 내부 화면도 열지 않았다.
- 원본 페이지의 로케일, 로그인 상태, 화면 크기별 UI가 달라질 수 있다. 반응형 중단점과 CSS 수치의 정확한 동일성은 검증하지 않았다.
- 이 프로젝트는 현재 MyMemory REST API로 텍스트를 번역하고 운영체제 독립형 Tesseract.js로 이미지 OCR을 시도하는 **독립 구현**이다. 이전 NAVER Cloud 중계와 macOS Apple Vision 의존성은 제거했다. 이 변경은 위 REA 원본 Papago 관찰 결과를 바꾸지 않으며, 원본 웹사이트가 MyMemory를 사용한다는 증거도 없다.
