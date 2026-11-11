'use strict';
const $ = selector => document.querySelector(selector);
const planner = $('.planner');
const account = document.createElement('section');
account.className = 'account';
account.innerHTML = `
  <form id="login-form" class="login-form">
    <h3>나의 숙제 노트 열기</h3>
    <label for="email">이메일</label>
    <input id="email" type="email" autocomplete="username" required>
    <label for="password">비밀번호</label>
    <input id="password" type="password" autocomplete="current-password" required>
    <button type="submit" class="account-button">로그인</button>
    <p>Supabase에 등록한 사용자 계정으로 로그인하세요.</p>
  </form>
  <div id="signed-in" hidden><span id="account-email"></span><button id="logout" type="button" class="account-button">로그아웃</button></div>
  <div class="date-controls"><label for="task-date">계획 날짜</label><input id="task-date" type="date" required><button id="refresh" type="button" class="account-button">불러오기</button></div>
  <p id="connection-status" role="status" aria-live="polite"></p>`;
planner.insertBefore(account, $('#task-form'));
const overdueSection = document.createElement('section');
overdueSection.className = 'overdue-section';
overdueSection.hidden = true;
overdueSection.setAttribute('aria-labelledby', 'overdue-title');
overdueSection.innerHTML = `<h3 id="overdue-title">지난 미완료 할 일 <span id="overdue-count"></span></h3>
  <p class="overdue-description">오늘 이전에 끝내지 못한 할 일이에요. 원래 날짜를 유지하며 지금 완료할 수 있어요.</p>
  <ul id="overdue-tasks"></ul><p id="overdue-empty">지난 미완료 할 일이 없어요.</p>`;
planner.append(overdueSection);
let tasks = [], overdueTasks = [], user = null, pending = 0, revision = 0, client, api;
const dateString = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
let day = dateString(new Date());
$('#task-date').value = day;
$('#today').textContent = new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
const message = (text, error=false) => { $('#connection-status').textContent=text; $('#connection-status').classList.toggle('error',error); };
function controls() {
  const busy = pending > 0;
  $('#login-form').hidden = !!user;
  $('#signed-in').hidden = !user;
  $('#account-email').textContent = user?.email || '';
  $('#login-form button').disabled = busy || !client;
  for(const el of [$('#task-input'),$('#task-form button'),$('#task-date'),$('#refresh')]) el.disabled = busy || !user;
  $('#logout').disabled = busy;
  $('#clear').disabled = busy || !user || !tasks.some(t=>t.done);
  for(const el of document.querySelectorAll('#tasks input, #tasks button, #overdue-tasks input, #overdue-tasks button')) el.disabled = busy || !user;
  planner.setAttribute('aria-busy',String(busy));
}
function saveTask(saved) {
  tasks=tasks.map(t=>t.id===saved.id?saved:t);
  overdueTasks=overdueTasks.filter(t=>t.id!==saved.id);
  if(!saved.done && saved.task_date < dateString(new Date())) {
    overdueTasks.push(saved);
    overdueTasks.sort((a,b)=>a.task_date.localeCompare(b.task_date)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  }
}
function renderList(list, rows, showDate=false) {
  list.replaceChildren();
  for(const task of rows) {
    const row=document.createElement('li'); row.classList.toggle('done',task.done);
    const check=document.createElement('input');check.type='checkbox';check.checked=task.done;check.setAttribute('aria-label',task.text+' 완료');
    check.addEventListener('change',()=>{
      const value=check.checked;check.checked=task.done;
      run(async()=>{const saved=await api.setDone(task.id,value);saveTask(saved);},'완료 상태를 저장했습니다.');
    });
    const text=document.createElement('span');text.className='text';text.textContent=task.text;
    if(showDate) {
      const date=document.createElement('time');date.className='task-original-date';date.dateTime=task.task_date;date.textContent=task.task_date;
      text.prepend(date);
      check.setAttribute('aria-label',task.task_date+' '+task.text+' 완료');
    }
    const remove=document.createElement('button');remove.type='button';remove.className='delete';remove.textContent='×';remove.setAttribute('aria-label',task.text+' 삭제');
    remove.addEventListener('click',()=>run(async()=>{await api.remove(task.id);tasks=tasks.filter(t=>t.id!==task.id);overdueTasks=overdueTasks.filter(t=>t.id!==task.id);},'삭제했습니다.'));
    row.append(check,text,remove);list.append(row);
  }
}
function render() {
  renderList($('#tasks'),tasks);
  renderList($('#overdue-tasks'),overdueTasks,true);
  overdueSection.hidden=!user;
  $('#overdue-count').textContent=`${overdueTasks.length}개`;
  $('#overdue-empty').hidden=overdueTasks.length>0;
  const done=tasks.filter(t=>t.done).length, percent=tasks.length?Math.round(done/tasks.length*100):0;
  $('#count').textContent=tasks.length;$('#progress-text').textContent=`${tasks.length}개 중 ${done}개 완료`;
  $('#percentage').textContent=`${percent}%`;$('#progress-bar').style.width=`${percent}%`;
  $('#empty').hidden=tasks.length>0;
  $('#empty').textContent=user?'이 날짜의 계획이 비어 있어요. 작은 할 일 하나를 적어보세요.':'로그인하면 저장한 계획을 불러옵니다.';
  $('.list-footer span').textContent=user?`${day} · Supabase에 저장됩니다.`:'기존 브라우저 저장 데이터는 그대로 보관됩니다.';
  controls();
}
async function run(action, success) {
  if(pending || !user)return;
  const current=revision;
  pending++;controls();message('처리 중…');
  try{await action();if(current===revision)message(success);}
  catch(error){if(current===revision)message('처리하지 못했습니다. 인터넷 연결과 로그인 상태를 확인하고 다시 시도하세요.',true);}
  finally{pending--;if(current===revision)render();else controls();}
}
async function load() {
  const current=revision, selectedDay=day;
  pending++;controls();message('계획을 불러오는 중…');
  try{
    const [rows, overdue]=await Promise.all([api.load(selectedDay),api.loadOverdue(dateString(new Date()))]);
    if(current===revision){tasks=rows;overdueTasks=overdue;message('저장한 계획을 불러왔습니다.');}
  }catch(error){if(current===revision)message('불러오지 못했습니다. 인터넷 연결을 확인한 뒤 불러오기를 다시 눌러주세요.',true);}
  finally{pending--;if(current===revision)render();else controls();}
}
function sessionChanged(session) {
  const next=session?.user||null;
  if(next?.id===user?.id)return;
  revision++;user=next;tasks=[];overdueTasks=[];$('#task-input').value='';$('#password').value='';render();
  if(user)load();else message('로그인하면 다른 기기에서도 같은 계획을 사용할 수 있어요.');
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(pending || !client)return;
  pending++;controls();message('로그인 중…');
  try{
    const {data,error}=await client.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
    if(error)throw error;
    sessionChanged(data.session);
  }catch(error){message('로그인하지 못했습니다. 이메일·비밀번호와 이메일 인증 여부를 확인하세요.',true);}
  finally{pending--;$('#password').value='';controls();}
});
$('#logout').addEventListener('click',async()=>{
  if(pending)return;pending++;controls();
  try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;sessionChanged(null);}
  catch(error){message('로그아웃하지 못했습니다. 다시 시도하세요.',true);}
  finally{pending--;controls();}
});
$('#task-form').addEventListener('submit',event=>{
  event.preventDefault();const text=$('#task-input').value.trim();if(!text)return;
  run(async()=>{const saved=await api.add(text,day);tasks.push(saved);saveTask(saved);$('#task-input').value='';},'새 계획을 저장했습니다.');
});
$('#clear').addEventListener('click',()=>run(async()=>{
  const removed=await api.clearDone(day);const ids=new Set(removed.map(t=>t.id));tasks=tasks.filter(t=>!ids.has(t.id));
},'완료한 계획을 정리했습니다.'));
$('#refresh').addEventListener('click',()=>{if(user&&!pending)load();});
$('#task-date').addEventListener('change',()=>{
  const value=$('#task-date').value;
  if(!value){$('#task-date').value=day;return;}
  if(!user||pending)return;
  day=value;revision++;tasks=[];overdueTasks=[];render();load();
});
render();
try{
  if(!globalThis.supabase||!globalThis.createTasksApi)throw new Error('라이브러리 로딩 실패');
  const config=globalThis.LITTLE_PLAN_CONFIG;
  client=supabase.createClient(config.url,config.publishableKey);api=createTasksApi(client);controls();
  client.auth.onAuthStateChange((event,session)=>setTimeout(()=>sessionChanged(session),0));
  client.auth.getSession().then(({data,error})=>{
    if(error)throw error;sessionChanged(data.session);
    if(!data.session)message('로그인하면 저장한 계획을 불러옵니다.');
  }).catch(()=>message('로그인 상태를 확인하지 못했습니다. 새로고침해주세요.',true));
}catch(error){message('연결 파일을 불러오지 못했습니다. 인터넷 연결과 파일 업로드 상태를 확인해주세요.',true);controls();}

