# 오늘의 작은 계획 — Supabase 테이블과 REST

이 폴더는 `index.html`의 `text`, `done` 데이터를 Supabase에 저장하기 위한 SQL, REST 요청 예제, 화면 연결용 JavaScript 어댑터입니다. 실제 Supabase에 연결하거나 SQL을 실행하지 않은 준비 파일입니다. 기존 index.html과 app.js는 브라우저 저장 방식으로 계속 작동합니다.

## 1. 테이블 생성

Supabase 프로젝트의 SQL Editor에서 setup.sql 전체를 한 번 실행합니다. 테이블과 사용자별 조회·추가·수정·삭제 권한을 함께 만듭니다. public 스키마가 Data API에 노출되어 있고 Data API가 활성화되어 있는지 확인하세요.

| 컬럼 | 의미 |
| --- | --- |
| id | 할 일 고유 UUID |
| user_id | 로그인한 사용자 ID. 저장 시 자동 설정 |
| task_date | 할 일이 속한 날짜(YYYY-MM-DD) |
| text | 기존 화면의 할 일 문구. 1~120자 |
| done | 기존 화면의 완료 여부 |
| created_at | 생성 시각 |

날짜는 브라우저의 현지 날짜를 명시적으로 전송합니다. 서버의 UTC 날짜를 오늘로 사용하지 않습니다. 과거 날짜의 기록은 오늘 목록에서 빠져도 DB에 그대로 남습니다.

### 지난 미완료 할 일

현재 화면은 로그인 시 날짜별 목록과 별도로 `api.loadOverdue()`를 호출합니다. 브라우저의 오늘 이전(`task_date < 오늘`)이면서 `done = false`인 항목을 원래 날짜와 함께 오래된 순서로 표시합니다. 선택한 계획 날짜를 바꾸어도 오늘 기준은 유지됩니다. 이 목록에서도 완료·삭제할 수 있으며, 같은 항목이 날짜별 목록에 있으면 함께 갱신됩니다. 과거 항목을 다시 미완료로 바꾸면 지난 미완료 목록에 다시 나타납니다.

불러오기 버튼은 두 목록을 함께 갱신합니다. 기존 테이블과 RLS를 그대로 사용하므로 추가 SQL 실행은 필요 없습니다. 조회는 500건씩 페이지를 나누어 처리합니다.

로컬 검증: 프로젝트 루트에서 `node --test tests/overdue.test.cjs` 실행.

## 2. 로그인 준비

웹사이트 방문자 계정은 Supabase 대시보드 계정과 별개입니다. Supabase Auth 이메일/비밀번호 가입을 사용하세요. Authentication → Users에서 테스트 사용자를 생성해도 됩니다. 이메일 확인이 활성화되어 있으면 확인을 완료합니다.

웹페이지에서 회원가입을 붙인다면 Authentication의 URL Configuration에 실제 로컬 웹페이지 주소를 설정합니다. 예: http://localhost:8080/ .

프로젝트 URL과 Publishable key를 확인합니다. Secret key, service_role, DB 비밀번호를 브라우저 코드에 넣지 않습니다.

## 3. REST 테스트

requests.http를 보고 요청을 Postman 또는 REST Client에서 실행합니다. baseUrl, publishableKey, 날짜를 지정한 뒤 로그인 요청을 보냅니다. 로그인 응답의 access_token을 Authorization 헤더에 사용합니다. 토큰이 만료되면 다시 로그인하거나 SDK로 갱신합니다. 비밀번호와 토큰이 들어간 파일은 공유하지 마세요.

별도 REST 서버 코드는 필요 없습니다. Supabase가 `/rest/v1/little_plan_tasks`를 제공합니다.

| 동작 | 메서드 | 경로/필터 |
| --- | --- | --- |
| 날짜별 불러오기 | GET | /rest/v1/little_plan_tasks?task_date=eq.YYYY-MM-DD |
| 저장 | POST | /rest/v1/little_plan_tasks |
| 완료 변경 | PATCH | /rest/v1/little_plan_tasks?id=eq.UUID |
| 한 건 삭제 | DELETE | /rest/v1/little_plan_tasks?id=eq.UUID |
| 해당 날짜 완료 항목 정리 | DELETE | /rest/v1/little_plan_tasks?task_date=eq.YYYY-MM-DD&done=eq.true |

모든 데이터 요청에 apikey와 로그인 사용자의 Authorization: Bearer 토큰이 필요합니다. Publishable key만으로는 로그인되지 않습니다. user_id를 다른 사람의 ID로 보내도 RLS가 거부합니다. 남의 행을 조회하면 목록에 나오지 않습니다.

## 4. 기존 화면 연결 방법

화면 연결 예제(현재 index.html에 아직 적용하지 않음):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase/tasks-api.js"></script>
<script>
const db = supabase.createClient('PROJECT_URL', 'PUBLISHABLE_KEY');
const api = createTasksApi(db);

// 로그인 폼에서 받은 email/password 사용. 아래는 호출 흐름 예시입니다.
async function loginAndLoad(email, password) {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return api.load();
}

// 버튼 이벤트 안에서 await 후 render()를 호출하는 형태로 연결합니다.
// const saved = await api.add('10분 산책하기');
// const tasks = await api.load();
// await api.setDone(saved.id, true);
// await api.remove(saved.id);
// await api.clearDone();
</script>
```

기존 app.js의 localStorage 저장 코드를 이 API 호출로 교체하려면 로그인 UI와 로딩·오류 처리를 함께 연결해야 합니다. DB 성공 응답 후에 목록을 갱신하세요. 네트워크 오류 시 입력값을 유지하고 오류를 표시해야 합니다. 브라우저에 저장돼 있던 예제 할 일은 자동 업로드하지 않습니다.

## 5. 연결 검증

1. 사용자 A로 저장하고 조회한 id/text/done/task_date를 확인합니다.
2. 완료 변경과 한 건 삭제를 확인합니다.
3. 날짜를 바꿔 조회하면 원래 날짜 데이터가 나오지 않는지 확인합니다.
4. 사용자 B로 로그인해 A의 목록이 보이지 않고, A의 user_id로 추가하거나 A의 id로 수정할 수 없는지 확인합니다.
5. 로그아웃 상태에서 데이터에 접근할 수 없는지 확인합니다.

SQL Editor는 관리자 권한으로 작동하므로 그 화면에서 보이는 것만으로 RLS 검증을 대신할 수 없습니다. 실제 사용자 토큰으로 REST 테스트를 해야 합니다.

공식 문서: https://supabase.com/docs/guides/api , https://supabase.com/docs/guides/database/postgres/row-level-security
