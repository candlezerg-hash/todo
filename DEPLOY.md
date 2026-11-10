# Supabase 연결판 배포

연결판은 Supabase 로그인 후 날짜별 할 일을 불러오고, 추가·완료 변경·삭제·완료 항목 정리를 DB에 저장합니다. 비밀번호나 REST 테스트의 access_token을 소스에 넣지 않습니다. 세션 갱신은 supabase-js가 처리합니다.

## GitHub Pages에 반영

`todo-deploy.zip`을 풀고 다음 파일을 기존 GitHub 저장소 `todo`의 Pages 배포 폴더에 같은 구조로 올립니다.

```
index.html
style.css
app.js
config.js
supabase/
  tasks-api.js
```

기존 파일을 교체하고 Commit changes를 누릅니다. GitHub Pages 배포가 완료되면 https://candlezerg-hash.github.io/todo/ 에서 강력 새로고침합니다. 요청 테스트 파일 requests.http는 비밀번호와 토큰이 들어 있을 수 있으므로 업로드하지 않습니다. SQL 파일도 웹 배포에 필요하지 않습니다.

## 사용

1. REST 테스트에 사용한 Supabase Auth 이메일과 비밀번호로 로그인합니다.
2. 계획 날짜가 저장한 날짜(2026-11-10)인지 확인합니다. 다른 날짜의 기록은 날짜를 선택해서 조회합니다.
3. 기존에 REST로 저장한 항목이 나타나는지 확인합니다.
4. 새 항목을 추가하고 새로고침해서 유지되는지 확인합니다.
5. 완료 체크, 삭제, 로그아웃을 확인합니다.

기존 localStorage의 할 일은 지우거나 자동 업로드하지 않습니다. 연결판 화면은 DB 목록만 표시합니다. Supabase URL과 Publishable key는 config.js에 설정되어 있습니다. 로그인 폼은 기존 사용자용이며 회원가입 화면은 포함하지 않습니다. 기존 setup.sql의 사용자별 RLS가 적용되어 있어야 합니다.

이 페이지는 외부 SDK와 Supabase를 사용하므로 인터넷 연결이 필요합니다. localhost의 Apache 또는 GitHub Pages에서 실행하세요. DB 실패 시 기존 화면 상태와 입력을 유지하고 오류를 표시합니다. 이 변경에서는 실제 사용자 비밀번호나 토큰으로 원격 테스트하지 않았습니다.
