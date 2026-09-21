# NAS 사용자 매뉴얼 유지보수

## 실행과 빌드

`start.bat`을 더블 클릭하면 4개 페이지를 빌드하고 로컬 서버와 브라우저를 실행합니다. Python 3.10 이상이 필요하며 추가 패키지는 없습니다. 서버 종료는 실행 창에서 Ctrl+C입니다.

템플릿, CSS, JavaScript, 이미지 수정 후 `build.bat` 또는 `python tools/build.py`를 실행하고 브라우저를 새로고침해 주세요. 빌드는 완성된 HTML과 assets를 `dist/`에 모읍니다. 로컬 서버도 `dist/`만 제공합니다.

GIF 컨트롤은 외부 이미지 파일을 읽으므로 HTML 더블 클릭 대신 로컬 서버를 사용해 주세요.

리눅스에서는 `python3 tools/serve.py`로 빌드와 서버를 함께 실행합니다. 접속 주소는 `http://127.0.0.1:8765/index.html`입니다.

처음 접속하면 전체화면 사용 안내가 표시됩니다. ‘다음’으로 사진 확대, 영상 재생, 속도 조절 방법을 확인하고 ‘시작하기’를 누르면 매뉴얼이 열립니다. 실제 매뉴얼 카드와 영상으로 자동 시연하며, 동작 줄이기 설정에서는 자동 애니메이션과 재생을 생략합니다. 완료 여부는 탭의 세션에 저장되어 새로고침이나 운영체제 메뉴 이동 시 반복되지 않습니다. 상단 ‘사용 안내’로 언제든 다시 볼 수 있습니다. 사진에 마우스를 올리면 살짝 확대되고 클릭하면 크게 볼 수 있으며, 영상 중앙의 재생 버튼은 일시정지 중 표시됩니다.

## 운영체제별 템플릿

| 수정 파일 | 생성 페이지 | 내용 |
| --- | --- | --- |
| `templates/platforms/windows.html` | `dist/index.html` | Windows 매뉴얼 전체 본문과 목차 |
| `templates/platforms/android.html` | `dist/android.html` | Android 준비 화면 |
| `templates/platforms/ios.html` | `dist/ios.html` | iOS 준비 화면 |
| `templates/platforms/mac.html` | `dist/mac.html` | Mac 준비 화면 |

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
- `templates/shared/tutorial.html`, `assets/css/tutorial.css`, `assets/js/tutorial.js`: 전체화면 첫 사용 안내
- `assets/js/photo-layout.js`: 사진 행 높이 정렬
- `assets/js/vendor/gif-reader.js`: GIF 라이브러리 및 원본 라이선스
- `assets/images/`: 이미지와 GIF. 동일 파일은 공유하며 원본 추출 기록은 `manifest.json`
- `tools/build.py`: 플랫폼별 HTML 생성
- `tools/serve.py`: 빌드 후 로컬 서버 실행
- `backup/index.original.html`: 분리 전 원본 백업

`templates/`와 `assets/`가 수정할 원본이며, `dist/`는 자동 생성되는 배포 결과입니다. `dist/` 내부 파일은 직접 수정하지 마세요. 템플릿에서 이미지 경로는 생성 HTML 기준으로 `assets/images/파일명.png`처럼 작성합니다.

배포 시 빌드 후 `dist/` 안의 내용 전체를 웹 서버의 문서 루트에 복사합니다. `templates`, `tools`, `backup`은 배포에 필요하지 않습니다.

GitHub Pages는 `.github/workflows/pages.yml`에서 관리합니다. `main`에 푸시하면 원본으로 다시 빌드하고 `dist/`만 자동 배포합니다. 저장소 Settings → Pages → Source는 **GitHub Actions**를 사용합니다. Actions에서 수동 실행도 가능합니다.

## 수정 규칙

- 사진 영역은 `figure`의 `data-media-kind`로 크기를 통일합니다. `screen`은 전체 화면(16:9), `dialog`는 설정 창·GIF(3:2), `tray`는 트레이 캡처, `panel`은 작은 패널(1:1)입니다. 각 유형은 최대 너비 안에서 반응형으로 축소되며 원본 비율을 유지합니다.

- HTML은 두 칸 들여쓰기를 사용하고, 카드·본문·이미지 영역을 줄 단위로 구분합니다. 링크가 포함된 문장은 한 줄로 유지해 문장 사이 공백이 바뀌지 않게 합니다.
- CSS는 기본 스타일 → 구성 요소 → 반응형 → 인쇄 순서로 관리합니다. 기존 선택자의 규칙을 수정하고 파일 끝에 같은 규칙을 덧붙이지 않습니다.
- 카드 배치는 Flex 방식이며 `photo-layout.js`가 같은 행의 설명 높이를 맞춥니다. 별도 Grid/subgrid 카드 배치 규칙을 중복 추가하지 않습니다.
- GIF 컨트롤 스타일은 `gif-player.css`, 운영체제 메뉴는 `platforms.css`에서 관리합니다.
- 이미지 파일명은 소문자 영문과 하이픈으로 용도를 표현합니다. 예: `dsm-login-username.png`, `windows-drive-select-team-folder.gif`.
- 이미지 이름이나 내용을 바꾸면 템플릿의 경로와 `assets/images/manifest.json`의 경로·SHA-256·바이트 수를 함께 갱신합니다. `original_path`는 최초 추출 이름을 추적하기 위한 기록입니다.
- `backup/`은 로컬 원본 보관용이며 Git에 올리지 않습니다. 수정 이력은 Git 커밋으로 관리합니다.
