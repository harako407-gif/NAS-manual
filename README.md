# NAS 사용자 매뉴얼 유지보수

## 실행과 빌드

`start.bat`을 더블 클릭하면 4개 페이지를 빌드하고 로컬 서버와 브라우저를 실행합니다. Python 3.10 이상이 필요하며 추가 패키지는 없습니다. 서버 종료는 실행 창에서 Ctrl+C입니다.

템플릿 수정 후 `build.bat` 또는 `python tools/build.py`를 실행해 주세요. CSS, JavaScript, 이미지 수정은 브라우저 새로고침으로 반영됩니다.

GIF 컨트롤은 외부 이미지 파일을 읽으므로 HTML 더블 클릭 대신 로컬 서버를 사용해 주세요.

## 운영체제별 템플릿

| 수정 파일 | 생성 페이지 | 내용 |
| --- | --- | --- |
| `templates/platforms/windows.html` | `index.html` | Windows 매뉴얼 전체 본문과 목차 |
| `templates/platforms/android.html` | `android.html` | Android 준비 화면 |
| `templates/platforms/ios.html` | `ios.html` | iOS 준비 화면 |
| `templates/platforms/mac.html` | `mac.html` | Mac 준비 화면 |

목차별로 템플릿을 나누지 않습니다. 앞으로 지원할 운영체제의 템플릿에서 준비 화면을 실제 매뉴얼 내용으로 교체하면 됩니다.

## 공통 파일

- `templates/page.html`: 모든 플랫폼이 공유하는 HTML 문서 틀과 CSS/JS 연결
- `templates/shared/header.html`: 로고와 Windows·Android·iOS·Mac 메뉴. 빌드 시 현재 페이지에 밑줄 표시
- `assets/css/manual.css`: 매뉴얼 레이아웃, 본문, 반응형 및 인쇄 스타일
- `assets/css/platforms.css`: 공통 헤더 메뉴와 준비 화면
- `assets/css/content.css`: 개별 본문 스타일
- `assets/css/gif-player.css`: 작은 재생 아이콘, 진행 막대, 시간, 배속 UI
- `assets/js/gif-player.js`: GIF 재생·일시정지·탐색·배속. 이미지 클릭으로도 재생 전환
- `assets/js/reveal.js`: 스크롤 표시 효과
- `assets/js/lightbox.js`: 정지 이미지 확대와 닫기
- `assets/js/photo-layout.js`: 사진 행 높이 정렬
- `assets/js/vendor/gif-reader.js`: GIF 라이브러리 및 원본 라이선스
- `assets/images/`: 이미지와 GIF. 동일 파일은 공유하며 원본 추출 기록은 `manifest.json`
- `tools/build.py`: 플랫폼별 HTML 생성
- `tools/serve.py`: 빌드 후 로컬 서버 실행
- `backup/index.original.html`: 분리 전 원본 백업

생성된 루트 HTML 4개를 직접 수정하지 마세요. 템플릿에서 이미지 경로는 루트 HTML 기준으로 `assets/images/파일명.png`처럼 작성합니다.

배포 시 `index.html`, `android.html`, `ios.html`, `mac.html`과 `assets` 폴더를 함께 복사합니다. `templates`, `tools`, `backup`은 배포에 필요하지 않습니다.

## 수정 규칙

- HTML은 두 칸 들여쓰기를 사용하고, 카드·본문·이미지 영역을 줄 단위로 구분합니다. 링크가 포함된 문장은 한 줄로 유지해 문장 사이 공백이 바뀌지 않게 합니다.
- CSS는 기본 스타일 → 구성 요소 → 반응형 → 인쇄 순서로 관리합니다. 기존 선택자의 규칙을 수정하고 파일 끝에 같은 규칙을 덧붙이지 않습니다.
- 카드 배치는 Flex 방식이며 `photo-layout.js`가 같은 행의 설명 높이를 맞춥니다. 별도 Grid/subgrid 카드 배치 규칙을 중복 추가하지 않습니다.
- GIF 컨트롤 스타일은 `gif-player.css`, 운영체제 메뉴는 `platforms.css`에서 관리합니다.
- 이미지 파일명은 소문자 영문과 하이픈으로 용도를 표현합니다. 예: `dsm-login-username.png`, `windows-drive-select-team-folder.gif`.
- 이미지 이름이나 내용을 바꾸면 템플릿의 경로와 `assets/images/manifest.json`의 경로·SHA-256·바이트 수를 함께 갱신합니다. `original_path`는 최초 추출 이름을 추적하기 위한 기록입니다.
- `backup/`은 로컬 원본 보관용이며 Git에 올리지 않습니다. 수정 이력은 Git 커밋으로 관리합니다.
