'use strict';
(function(){
  // 읽은 횟수에 반비례하여 추첨하고, 직전 카드는 가중치를 낮춥니다.
  function pickPhrase(rows,previousId,random=Math.random){
    const choices=rows;
    const weight=row=>(row.id===previousId?0.25:1)/(Number(row.read_count)+1);
    const total=choices.reduce((sum,row)=>sum+weight(row),0);
    let ticket=random()*total;
    for(const row of choices){ticket-=weight(row);if(ticket<0)return row;}
    return choices.at(-1)||null;
  }
  globalThis.pickJapanesePhrase=pickPhrase;
  if(typeof document==='undefined')return;
  const panel=document.createElement('div');panel.id='japanese-panel';panel.className='japanese-panel';
  panel.innerHTML=`<p class="eyebrow">ONE JAPANESE PHRASE</p><h2>일본어 한마디</h2>
    <p class="ledger-help">적게 읽은 표현일수록 더 자주 만나요. 읽은 뒤 ‘읽음 · 다음 카드’를 눌러 주세요.</p>
    <p id="japanese-status" role="status" aria-live="polite">로그인 후 이용할 수 있어요.</p>
    <button id="japanese-refresh" type="button" class="account-button">표현·통계 새로고침</button>
    <div class="japanese-stats" aria-label="읽기 통계"><div><span>등록된 표현</span><strong id="japanese-count">—</strong></div><div><span>총 읽은 횟수</span><strong id="japanese-reads">—</strong></div><div><span>아직 안 읽은 표현</span><strong id="japanese-unread">—</strong></div></div>
    <section class="phrase-card" aria-label="오늘의 일본어 카드" aria-live="polite"><p id="phrase-expression" lang="ja"></p><p id="phrase-reading" lang="ja"></p><p id="phrase-meaning"></p><small id="phrase-count"></small></section>
    <button id="phrase-read" type="button" class="account-button phrase-read">읽음 · 다음 카드</button>
    <form id="japanese-form" class="ledger-form"><h3>새 표현 등록</h3>
      <label>일본어 표현<textarea name="expression" lang="ja" maxlength="500" rows="2" required placeholder="예: お疲れさまです。"></textarea></label>
      <label>읽는 법 (선택)<input name="reading" maxlength="500" placeholder="예: おつかれさまです"></label>
      <label>한국어 뜻<textarea name="meaning" maxlength="500" rows="2" required placeholder="예: 수고하십니다."></textarea></label>
      <button class="account-button">표현 등록</button></form>`;
  const q=s=>panel.querySelector(s);
  let rows=[],current=null,ready=false,busy=false,epoch=0;
  const format=n=>n.toLocaleString('ko-KR');
  function status(text,error=false){q('#japanese-status').textContent=text;q('#japanese-status').classList.toggle('error',error);}
  function render(){
    q('#japanese-count').textContent=ready?format(rows.length)+'개':'—';
    q('#japanese-reads').textContent=ready?format(rows.reduce((sum,row)=>sum+Number(row.read_count),0))+'회':'—';
    q('#japanese-unread').textContent=ready?format(rows.filter(row=>Number(row.read_count)===0).length)+'개':'—';
    q('#phrase-expression').textContent=ready&&current?current.expression:ready?'첫 표현을 등록해 보세요.':'표현을 불러오면 카드가 나타나요.';
    q('#phrase-reading').textContent=ready&&current?current.reading:'';
    q('#phrase-meaning').textContent=ready&&current?current.meaning:'';
    q('#phrase-count').textContent=ready&&current?`이 표현을 ${format(Number(current.read_count))}회 읽었어요.`:'';
    for(const el of panel.querySelectorAll('button,input,textarea'))el.disabled=busy||!user;
    q('#phrase-read').disabled=busy||!user||!ready||!current;
    panel.setAttribute('aria-busy',String(busy));
  }
  async function fetchRows(){
    const all=[];
    for(let start=0;;start+=500){const {data,error}=await client.from('little_plan_japanese').select('*').order('created_at').order('id').range(start,start+499);if(error)throw error;all.push(...data);if(data.length<500)return all;}
  }
  function failure(error){
    if(['PGRST205','42P01','PGRST202','42883'].includes(error?.code))return '일본어 기능 설정이 필요합니다. Supabase SQL Editor에서 supabase/japanese.sql 전체를 실행해 주세요.';
    return '저장·조회하지 못했습니다. '+(error?.message||'인터넷 연결과 로그인을 확인해 주세요.');
  }
  async function load(){
    if(!user||busy)return;const version=epoch;busy=true;render();status('표현을 불러오는 중…');
    try{const loaded=await fetchRows();if(version!==epoch)return;rows=loaded;ready=true;current=rows.find(row=>row.id===current?.id)||pickPhrase(rows);status('표현과 통계를 불러왔습니다.');}
    catch(error){if(version===epoch){ready=false;current=null;status(failure(error),true);}}
    finally{if(version===epoch){busy=false;render();}}
  }
  q('#japanese-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!user||busy)return;
    const form=event.currentTarget,fields=form.elements;
    const entry={expression:fields.expression.value.trim(),meaning:fields.meaning.value.trim(),reading:fields.reading.value.trim()};
    if(!entry.expression||!entry.meaning){status('일본어 표현과 한국어 뜻을 입력하세요.',true);return;}
    const version=epoch;busy=true;render();status('표현을 저장하는 중…');
    try{
      const {data,error}=await client.from('little_plan_japanese').insert(entry).select().single();if(error)throw error;
      if(version!==epoch)return;
      if(ready){rows.push(data);current=current||data;}
      form.reset();status('표현을 등록했습니다.');
    }catch(error){if(version===epoch)status(failure(error),true);}
    finally{if(version===epoch){busy=false;render();}}
    if(version===epoch&&!ready)await load();
  });
  q('#phrase-read').addEventListener('click',async()=>{
    if(!user||busy||!ready||!current)return;
    const version=epoch,id=current.id;busy=true;render();status('읽은 횟수를 저장하는 중…');
    try{
      const {data,error}=await client.rpc('little_plan_read_japanese',{p_id:id});if(error)throw error;
      if(!data?.[0])throw new Error('표현을 찾지 못했습니다. 새로고침해 주세요.');
      if(version!==epoch)return;rows=rows.map(row=>row.id===id?data[0]:row);current=pickPhrase(rows,id);
      status(rows.length===1?'읽음을 기록했습니다. 새 표현을 등록하면 다른 카드도 볼 수 있어요.':'읽음을 기록하고 다음 카드로 넘어갔습니다.');
    }catch(error){if(version===epoch)status(failure(error),true);}
    finally{if(version===epoch){busy=false;render();}}
  });
  q('#japanese-refresh').addEventListener('click',load);
  globalThis.registerNoteTab({id:'japanese',label:'일본어 한마디',panel,open:()=>{if(user&&!ready)load();}});
  globalThis.japaneseSessionChanged=()=>{epoch++;rows=[];current=null;ready=false;busy=false;q('#japanese-form').reset();status(user?'일본어 탭을 열면 표현을 불러옵니다.':'로그인 후 이용할 수 있어요.');render();if(user&&!panel.hidden)load();};
  globalThis.japaneseSessionChanged();
})();
