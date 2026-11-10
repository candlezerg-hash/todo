# 작은 계획 — Apache 정적 페이지 예제

HTML, CSS, JavaScript만 사용하는 한국어 할 일 목록입니다. 할 일 추가, 완료 체크, 삭제, 완료 항목 정리와 브라우저 저장을 지원합니다. 날짜는 접속한 기기의 날짜를 표시합니다.

## 바로 보기

`index.html`을 브라우저로 열면 화면을 볼 수 있습니다. 브라우저 저장 동작은 Apache로 접속해서 확인하는 것을 권장합니다.

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

`index.html`, `style.css`, `app.js` 세 파일을 Apache 문서 루트 아래의 `apache-demo` 폴더로 복사합니다. XAMPP의 일반적인 위치는 `C:\xampp\htdocs\apache-demo`입니다. Apache를 시작하고 http://localhost/apache-demo/ 에 접속하세요. Apache 포트를 바꾼 경우 주소에 해당 포트를 붙입니다.

## 파일 역할

- `index.html`: 화면 구조와 문구
- `style.css`: 색상, 여백, 모바일 화면 디자인
- `app.js`: 버튼 동작과 브라우저 localStorage 저장
- `compose.yaml`: Apache 컨테이너 실행 설정

## Codex로 이어서 바꿔보기

예: “이 화면의 초록색을 파란색으로 바꿔줘”, “할 일에 마감일을 추가해줘”, “파일별로 코드가 무슨 역할을 하는지 설명해줘”. 요청하면 Codex가 해당 파일을 직접 수정합니다.

이 예제는 서버 데이터베이스 없이 같은 브라우저에만 할 일을 저장합니다.

Supabase 저장을 위한 테이블 SQL, REST 요청 예제와 JavaScript 연결 어댑터는 `supabase/` 폴더에 있습니다. 실행 순서는 `supabase/README.md`를 확인하세요. 기존 화면은 아직 브라우저 저장 방식입니다.
