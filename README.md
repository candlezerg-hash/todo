# 작은 계획 — Apache 정적 페이지 예제

Supabase 연결판입니다. 로그인, 날짜별 DB 저장·조회, 완료 체크, 삭제, 완료 항목 정리를 지원합니다. GitHub Pages 업로드는 `DEPLOY.md`를 확인하세요. 기존 브라우저 저장 데이터는 그대로 남지만 현재 화면에는 DB의 데이터만 표시합니다.

## 바로 보기

Apache 또는 GitHub Pages에서 index.html을 열고 Supabase Auth 사용자로 로그인합니다. SDK와 DB 연결을 위해 인터넷이 필요합니다.

## Apache로 실행 (Docker 사용)

Docker Desktop을 실행하고 이 폴더에서 다음 명령을 실행하세요.

```powershell
docker compose up -d
```

브라우저에서 http://localhost:8080 에 접속합니다. 최초 실행은 Apache 이미지 다운로드가 필요합니다.

종료:

```powershell
docker compose down
```

## 이미 설치된 Apache / XAMPP 사용

`index.html`, `style.css`, `app.js`, `config.js`, `supabase/tasks-api.js`를 같은 폴더 구조로 Apache 문서 루트 아래에 복사합니다. Apache를 시작한 뒤 해당 경로로 접속하세요. requests.http는 웹에 올리지 않습니다.

## 파일 역할

- `index.html`: 화면 구조와 문구
- `style.css`: 색상, 여백, 모바일 화면 디자인
- `app.js`: 로그인 화면, 버튼 동작과 Supabase 저장
- `config.js`: Supabase URL과 브라우저 공개용 키
- `supabase/tasks-api.js`: 날짜별 DB 접근
- `compose.yaml`: Apache 컨테이너 실행 설정

## Codex로 이어서 바꿔보기

예: “이 화면의 초록색을 파란색으로 바꿔줘”, “할 일에 마감일을 추가해줘”, “파일별로 코드가 무슨 역할을 하는지 설명해줘”. 요청하면 Codex가 해당 파일을 직접 수정합니다.

기존 localStorage 데이터는 자동 업로드하거나 삭제하지 않습니다.

Supabase 테이블 SQL, REST 요청 예제와 JavaScript 어댑터는 `supabase/` 폴더에 있습니다. 배포 파일은 `DEPLOY.md`를 확인하세요.
