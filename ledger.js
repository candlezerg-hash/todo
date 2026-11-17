'use strict';
(function () {
  const accounts = {bank:'은행 잔고',credit:'PayPay 크레딧',paypay:'PayPay 잔고'};
  const categories = {fixed:'고정지출',food:'식비',hobby:'취미',transport:'교통',shopping:'쇼핑',other:'기타'};
  const yen = n => new Intl.NumberFormat('ko-KR',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n);
  function summarize(rows, month) {
    const balances={bank:0,credit:0,paypay:0}, totals=Object.fromEntries(Object.keys(categories).map(k=>[k,0]));
    const expenses=rows.filter(r=>r.kind==='expense' && r.spent_on.slice(0,7)===month);
    for(const row of rows) balances[row.account]+=Number(row.amount);
    for(const row of expenses) totals[row.category]-=Number(row.amount);
    return {balances,totals,expenses,total:Object.values(totals).reduce((a,b)=>a+b,0)};
  }
  globalThis.ledgerSummary=summarize;
  if(typeof document==='undefined')return;
  const host=document.querySelector('.planner');
  const todo=document.createElement('div');todo.id='todo-panel';todo.setAttribute('role','tabpanel');todo.setAttribute('aria-labelledby','todo-tab');
  for(const child of [...host.children]) if(child!==account)todo.append(child);
  const tabs=document.createElement('div');tabs.className='app-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','노트 전환');
  tabs.innerHTML='<button id="todo-tab" role="tab" aria-selected="true" aria-controls="todo-panel">할 일</button><button id="ledger-tab" role="tab" aria-selected="false" aria-controls="ledger-panel" tabindex="-1">가계부</button>';
  const panel=document.createElement('div');panel.id='ledger-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ledger-tab');
  const options = map => Object.entries(map).map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
  panel.innerHTML=`<p class="eyebrow">MY MONEY NOTE</p><h2>나의 가계부</h2>
    <p class="ledger-help">엔(¥) 기준 · PayPay 크레딧은 사용 가능액을 입력하세요. 실제 결제나 계좌 연동 없이 기록만 관리합니다.</p>
    <p id="ledger-status" role="status" aria-live="polite">로그인 후 이용할 수 있어요.</p>
    <button id="ledger-refresh" class="account-button" type="button">잔액·내역 새로고침</button>
    <div id="ledger-balances" class="ledger-balances"></div>
    <form id="balance-form" class="ledger-form"><h3>현재 잔액 설정·조정</h3>
      <label>자금<select name="account">${options(accounts)}</select></label><label>현재 잔액 (¥)<input name="amount" type="number" min="0" max="1000000000000" step="1" required></label>
      <p class="ledger-help">선택한 자금의 잔액을 입력한 금액으로 맞춥니다. 조정액은 지출 통계에 포함하지 않아요.</p><button class="account-button">잔액 저장</button></form>
    <form id="expense-form" class="ledger-form"><h3>지출 기록</h3>
      <label>사용 자금<select name="account">${options(accounts)}</select></label><label>금액 (¥)<input name="amount" type="number" min="1" max="1000000000000" step="1" required></label>
      <label>사용 날짜<input name="date" type="date" required></label><label>사용처<input name="merchant" maxlength="120" placeholder="예: 마트, 점심 식당" required></label>
      <label>카테고리<select name="category">${options(categories)}</select></label><button class="account-button">지출 저장·잔액 차감</button></form>
    <section class="ledger-stats"><h3>월별 지출 통계</h3><label for="ledger-month">조회 월</label><input id="ledger-month" type="month" required>
      <p id="ledger-total"></p><div id="ledger-categories"></div><h3>이번 달 사용 자금별 지출</h3><div id="ledger-account-totals"></div>
      <h3>지출 내역</h3><ul id="ledger-expenses"></ul><p id="ledger-empty">이 달의 지출이 없어요.</p></section>`;
  host.append(tabs,account,todo,panel);
  const q=s=>panel.querySelector(s);
  q('#expense-form').elements.date.value=dateString(new Date());q('#ledger-month').value=dateString(new Date()).slice(0,7);
  let rows=[],busy=false,ready=false,epoch=0;
  function status(text,error=false){q('#ledger-status').textContent=text;q('#ledger-status').classList.toggle('error',error);}
  function controls(){for(const el of panel.querySelectorAll('button,input,select'))el.disabled=busy||!user||(!ready&&el.id!=='ledger-refresh');panel.setAttribute('aria-busy',String(busy));}
  function renderLedger(){
    const data=summarize(rows,q('#ledger-month').value);
    q('#ledger-balances').replaceChildren();
    for(const [key,label] of Object.entries(accounts)){
      const card=document.createElement('div');const title=document.createElement('span'),value=document.createElement('strong');
      title.textContent=label;value.textContent=ready?yen(data.balances[key]):'—';card.append(title,value);q('#ledger-balances').append(card);
    }
    q('#ledger-total').textContent=ready?`총 지출 ${yen(data.total)}`:'기록을 불러오면 통계를 표시합니다.';
    q('#ledger-categories').replaceChildren();q('#ledger-account-totals').replaceChildren();q('#ledger-expenses').replaceChildren();
    if(ready){
      for(const [key,label] of Object.entries(categories)){
        const row=document.createElement('div');row.className='category-stat';const text=document.createElement('span'),bar=document.createElement('progress');
        text.textContent=`${label} · ${yen(data.totals[key])} (${data.total?Math.round(data.totals[key]/data.total*100):0}%)`;
        bar.max=data.total||1;bar.value=data.totals[key];bar.setAttribute('aria-label',label+' 지출 비중');row.append(text,bar);q('#ledger-categories').append(row);
      }
      for(const [key,label] of Object.entries(accounts)){
        const p=document.createElement('p');p.textContent=label+' · '+yen(data.expenses.filter(r=>r.account===key).reduce((sum,r)=>sum-Number(r.amount),0));q('#ledger-account-totals').append(p);
      }
      for(const expense of [...data.expenses].sort((a,b)=>b.spent_on.localeCompare(a.spent_on)||b.created_at.localeCompare(a.created_at))){
        const li=document.createElement('li'),text=document.createElement('span'),cancel=document.createElement('button');text.className='text';
        text.textContent=`${expense.spent_on} · ${expense.merchant} · ${categories[expense.category]} · ${accounts[expense.account]} · ${yen(-Number(expense.amount))}`;
        cancel.type='button';cancel.className='account-button';cancel.textContent='취소';cancel.setAttribute('aria-label',expense.merchant+' 지출 취소 및 잔액 복원');
        cancel.addEventListener('click',()=>perform(()=>client.rpc('little_plan_cancel_expense',{p_id:expense.id}),'지출을 취소하고 잔액을 복원했습니다.'));
        li.append(text,cancel);q('#ledger-expenses').append(li);
      }
    }
    q('#ledger-empty').hidden=!ready||data.expenses.length>0;controls();
  }
  async function fetchRows(){
    const all=[];
    for(let start=0;;start+=500){const {data,error}=await client.from('little_plan_ledger').select('*').order('created_at').order('id').range(start,start+499);if(error)throw error;all.push(...data);if(data.length<500)return all;}
  }
  async function perform(action,success){
    if(busy||!user)return;const current=epoch;busy=true;controls();status('처리 중…');let saved=false;
    try{
      if(action){const result=await action();if(result.error)throw result.error;saved=true;}
      const loaded=await fetchRows();if(current!==epoch)return;rows=loaded;ready=true;
      if(saved&&action.form){action.form.reset();action.form.elements.date.value=dateString(new Date());}
      status(success);
    }catch(error){if(current===epoch){ready=false;status(saved?'저장은 완료했지만 조회하지 못했습니다. 새로고침해 주세요.':error.message==='Insufficient balance'?'잔액이 부족합니다. 잔액을 조정하거나 금액을 확인하세요.':'저장·조회하지 못했습니다. 연결과 로그인을 확인하세요. 최초 사용 시 ledger.sql을 Supabase SQL Editor에서 실행해야 합니다.',true);}}
    finally{if(current===epoch){busy=false;renderLedger();}}
  }
  for(const id of ['balance-form','expense-form'])q('#'+id).addEventListener('submit',event=>{
    event.preventDefault();if(!ready)return;const form=event.currentTarget,f=form.elements,amount=Number(f.amount.value),expense=id==='expense-form';
    if(!Number.isSafeInteger(amount)||amount<(expense?1:0)||amount>1000000000000)return;
    if(expense&&!f.merchant.value.trim()){status('사용처를 입력하세요.',true);return;}
    const action=()=>client.rpc('little_plan_record',{p_account:f.account.value,p_amount:amount,p_date:expense?f.date.value:dateString(new Date()),p_merchant:expense?f.merchant.value.trim():'잔액 조정',p_category:expense?f.category.value:null,p_kind:expense?'expense':'adjustment'});
    if(expense)action.form=form;
    perform(action,expense?'지출을 저장하고 잔액에서 차감했습니다.':'현재 잔액을 저장했습니다.');
  });
  q('#ledger-refresh').addEventListener('click',()=>perform(null,'잔액과 내역을 불러왔습니다.'));
  q('#ledger-month').addEventListener('change',()=>{if(q('#ledger-month').value)renderLedger();});
  const tabButtons=[...tabs.querySelectorAll('button')];
  function activate(index){tabButtons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});todo.hidden=index!==0;panel.hidden=index!==1;account.querySelector('.date-controls').hidden=index!==0;if(index===1&&user&&!ready)perform(null,'잔액과 내역을 불러왔습니다.');}
  tabButtons.forEach((button,i)=>{button.addEventListener('click',()=>activate(i));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=1-i;else if(event.key==='Home')next=0;else if(event.key==='End')next=1;else return;event.preventDefault();activate(next);tabButtons[next].focus();});});
  globalThis.ledgerSessionChanged=()=>{epoch++;rows=[];ready=false;busy=false;q('#expense-form').reset();q('#expense-form').elements.date.value=dateString(new Date());q('#balance-form').reset();status(user?'가계부 탭을 열면 기록을 불러옵니다.':'로그인 후 이용할 수 있어요.');renderLedger();if(user&&!panel.hidden)perform(null,'잔액과 내역을 불러왔습니다.');};
  globalThis.ledgerSessionChanged();
})();
