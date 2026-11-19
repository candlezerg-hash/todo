'use strict';
(function(){
  const categories={schedule:'일정',event:'사건',journal:'저널',info:'정보'};
  function relationsFor(rows,id){return rows.filter(r=>r.person_id===id||r.related_id===id).map(r=>({...r,otherId:r.person_id===id?r.related_id:r.person_id,description:r.person_id===id?r.label:r.reverse_label}));}
  function filterEntries(rows,{personId='',search='',category='',from='',to=''}={}){
    const term=search.trim().toLocaleLowerCase();
    return rows.filter(r=>(!personId||r.person_id===personId)&&(!category||r.category===category)&&(!from||r.happened_on>=from)&&(!to||r.happened_on<=to)&&(!term||`${r.title} ${r.body}`.toLocaleLowerCase().includes(term)))
      .sort((a,b)=>b.happened_on.localeCompare(a.happened_on)||b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
  }
  globalThis.crmHelpers={relationsFor,filterEntries};
  if(typeof document==='undefined')return;
  const panel=document.createElement('div');panel.id='crm-panel';panel.className='crm-panel';
  const options=Object.entries(categories).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  panel.innerHTML=`<p class="eyebrow">PEOPLE & MEMORIES</p><h2>주변 사람 노트</h2>
    <p class="ledger-help">관계로 기억하고, 하루의 이야기로 가까워져요. 사람을 선택하면 관련 인물과 기록을 함께 볼 수 있어요.</p>
    <p id="crm-status" role="status" aria-live="polite"></p>
    <div class="crm-actions"><button id="crm-refresh" type="button" class="account-button">새로고침</button><button id="crm-new" type="button" class="account-button">+ 인물 등록</button></div>
    <label class="crm-search">인물 찾기<input id="crm-search" type="search" placeholder="이름·소개·관계로 검색"></label>
    <div id="crm-people" class="crm-people" aria-label="인물 목록"></div><p id="crm-empty" class="ledger-help"></p>
    <form id="crm-person-form" class="crm-form" hidden><h3 id="crm-person-heading">인물 등록</h3>
      <label>이름<input name="personName" maxlength="120" required></label>
      <label>소개·기억할 정보<textarea name="summary" maxlength="2000" rows="3" placeholder="처음 만난 곳, 하는 일, 좋아하는 것, 연락처 등"></textarea></label>
      <label>얼굴 사진 (선택)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG·PNG·WebP, 최대 10MB. 긴 변 320px로 줄여 저장해요.</small></label>
      <label class="crm-check"><input name="removePhoto" type="checkbox"> 기존 사진 지우기</label>
      <div class="crm-actions"><button class="account-button">인물 저장</button><button id="crm-person-cancel" type="button" class="account-button">취소</button></div></form>
    <section id="crm-detail" hidden>
      <div id="crm-profile" class="crm-profile"></div>
      <div class="crm-actions"><button id="crm-edit" type="button" class="account-button">인물 수정</button><button id="crm-delete-person" type="button" class="account-button crm-danger">인물 삭제</button></div>
      <h3>연결된 사람들</h3><p class="ledger-help">관계는 양쪽 인물에 표시됩니다. 관련 인물을 누르면 그 사람의 노트로 이동해요.</p><div id="crm-relations"></div>
      <details><summary>관계 추가</summary><form id="crm-relation-form" class="crm-form">
        <label>연결할 인물<select name="related" required></select></label>
        <label>상대는 이 사람의 누구인가요?<input name="label" maxlength="120" placeholder="예: 직장 동료, 어머니" required></label>
        <label>이 사람은 상대의 누구인가요?<input name="reverseLabel" maxlength="120" placeholder="예: 직장 동료, 아들" required></label>
        <label>관계 메모<textarea name="note" maxlength="1000" rows="2"></textarea></label><button class="account-button">관계 저장</button></form></details>
      <details id="crm-entry-editor"><summary>일정·사건·저널·정보 기록하기</summary><form id="crm-entry-form" class="crm-form">
        <h3 id="crm-entry-heading">새 기록</h3><label>카테고리<select name="category">${options}</select></label>
        <label>날짜<input name="date" type="date" required></label><label>제목<input name="title" maxlength="200" required></label>
        <label>내용<textarea name="body" maxlength="10000" rows="5" placeholder="함께한 일, 기억하고 싶은 이야기, 다음에 물어볼 것…"></textarea></label>
        <div class="crm-actions"><button class="account-button">기록 저장</button><button id="crm-entry-cancel" type="button" class="account-button">새 기록으로 초기화</button></div></form></details>
    </section>
    <section class="crm-journal"><h3 id="crm-records-heading">모든 사람의 기록</h3>
      <div class="crm-filters"><label>기록 검색<input id="crm-record-search" type="search" placeholder="제목·내용"></label><label>카테고리<select id="crm-category"><option value="">전체</option>${options}</select></label>
      <label>시작일<input id="crm-from" type="date"></label><label>종료일<input id="crm-to" type="date"></label></div>
      <div class="crm-actions"><button id="crm-all" type="button" class="account-button">모든 사람 보기</button><button id="crm-reread" type="button" class="account-button">기록 한 편 다시 읽기</button></div>
      <article id="crm-memory" class="crm-memory" hidden></article><div id="crm-entries"></div>
    </section>`;
  const q=s=>panel.querySelector(s), personForm=q('#crm-person-form'),entryForm=q('#crm-entry-form'),relationForm=q('#crm-relation-form');
  let people=[],relations=[],entries=[],selected='',editingPerson=null,editingEntry=null,busy=false,ready=false,epoch=0,lastMemory='';
  const person=()=>people.find(p=>p.id===selected);
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
  function button(text,action){const el=node('button',text,'account-button');el.type='button';el.addEventListener('click',action);return el;}
  function status(text,error=false){q('#crm-status').textContent=text;q('#crm-status').classList.toggle('error',error);}
  function controls(){for(const el of panel.querySelectorAll('button,input,select,textarea'))el.disabled=busy||!user||(!ready&&el.id!=='crm-refresh');panel.setAttribute('aria-busy',String(busy));}
  function avatar(p){if(p.photo){const img=node('img');img.src=p.photo;img.alt=p.name+' 사진';img.className='crm-avatar';return img;}return node('span',p.name.slice(0,1),'crm-avatar crm-initial');}
  function resetEntry(){editingEntry=null;entryForm.reset();entryForm.elements.date.value=dateString(new Date());q('#crm-entry-heading').textContent='새 기록';}
  function choose(id){selected=id;personForm.hidden=true;editingPerson=null;resetEntry();q('#crm-memory').hidden=true;render();}
  function matchingEntries(){return filterEntries(entries,{personId:selected,search:q('#crm-record-search').value,category:q('#crm-category').value,from:q('#crm-from').value,to:q('#crm-to').value});}
  function entryCard(entry,withActions=true){
    const card=node('article',undefined,'crm-entry');
    const owner=people.find(p=>p.id===entry.person_id);
    card.append(node('small',`${entry.happened_on} · ${categories[entry.category]} · ${owner?.name||'인물'}`),node('h4',entry.title),node('p',entry.body));
    if(withActions){const actions=node('div',undefined,'crm-actions');actions.append(button('인물 보기',()=>choose(entry.person_id)),button('수정',()=>{
      choose(entry.person_id);editingEntry=entry.id;entryForm.elements.category.value=entry.category;entryForm.elements.date.value=entry.happened_on;entryForm.elements.title.value=entry.title;entryForm.elements.body.value=entry.body;q('#crm-entry-heading').textContent='기록 수정';q('#crm-entry-editor').open=true;entryForm.elements.title.focus();
    }),button('삭제',()=>{if(confirm('이 기록을 삭제할까요?'))perform(async active=>{await result(client.from('little_plan_person_entries').delete().eq('id',entry.id));if(!active())return;entries=entries.filter(r=>r.id!==entry.id);if(editingEntry===entry.id)resetEntry();},'기록을 삭제했습니다.');}));card.append(actions);}
    return card;
  }
  function renderEntries(){const host=q('#crm-entries');host.replaceChildren();q('#crm-records-heading').textContent=person()?person().name+'의 기록':'모든 사람의 기록';
    if(q('#crm-from').value&&q('#crm-to').value&&q('#crm-from').value>q('#crm-to').value){host.append(node('p','종료일을 시작일 이후로 선택하세요.','ledger-help'));return;}
    const rows=matchingEntries();host.append(node('p',`${rows.length}개의 기록 · 최신 날짜순`,'ledger-help'));for(const entry of rows)host.append(entryCard(entry));if(!rows.length)host.append(node('p','이 조건에 맞는 기록이 없어요. 사람을 선택해 첫 이야기를 남겨보세요.','ledger-help'));controls();}
  function render(){
    const term=q('#crm-search').value.trim().toLocaleLowerCase(),list=q('#crm-people');list.replaceChildren();
    for(const p of people.filter(p=>[p.name,p.summary,...relationsFor(relations,p.id).map(r=>`${r.description} ${people.find(x=>x.id===r.otherId)?.name||''}`)].join(' ').toLocaleLowerCase().includes(term))){
      const el=button('',()=>choose(p.id));el.classList.add('crm-person');el.setAttribute('aria-pressed',String(p.id===selected));el.append(avatar(p),node('span',p.name));list.append(el);
    }
    q('#crm-empty').textContent=!ready?'로그인하고 새로고침하면 인물을 불러옵니다.':!people.length?'아직 등록된 사람이 없어요. 나 자신부터 등록하고 주변 사람들과 연결해 보세요.':!list.children.length?'검색 결과가 없어요.':`${people.length}명의 사람을 기억하고 있어요.`;
    const p=person();q('#crm-detail').hidden=!p;
    if(p){const profile=q('#crm-profile');profile.replaceChildren(avatar(p));const info=node('div');info.append(node('h3',p.name),node('p',p.summary||'소개를 남겨 이 사람을 기억해 보세요.'));profile.append(info);
      const host=q('#crm-relations');host.replaceChildren();const links=relationsFor(relations,p.id);
      for(const link of links){const other=people.find(x=>x.id===link.otherId);if(!other)continue;const card=node('div',undefined,'crm-relation');const go=button('',()=>choose(other.id));go.append(avatar(other),node('span',`${other.name} · ${link.description}`));card.append(go);if(link.note)card.append(node('p',link.note));card.append(button('관계 수정',()=>{
        const label=prompt('선택한 사람 기준으로 상대의 관계',link.description);if(label===null||!label.trim())return;const reverse=prompt('상대 기준으로 선택한 사람의 관계',link.person_id===p.id?link.reverse_label:link.label);if(reverse===null||!reverse.trim())return;const note=prompt('관계 메모',link.note);if(note===null)return;
        if(label.trim().length>120||reverse.trim().length>120||note.length>1000){status('관계는 120자, 메모는 1000자 이내로 입력하세요.',true);return;}
        perform(async active=>{const saved=await result(client.from('little_plan_relations').update({label:link.person_id===p.id?label.trim():reverse.trim(),reverse_label:link.person_id===p.id?reverse.trim():label.trim(),note}).eq('id',link.id).select().single());if(!active())return;relations=relations.map(r=>r.id===link.id?saved:r);},'관계를 수정했습니다.');
      }),button('연결 해제',()=>{if(confirm('이 관계를 해제할까요? 인물과 기록은 유지됩니다.'))perform(async active=>{await result(client.from('little_plan_relations').delete().eq('id',link.id));if(!active())return;relations=relations.filter(r=>r.id!==link.id);},'관계를 해제했습니다.');}));host.append(card);}
      if(!links.length)host.append(node('p','아직 연결된 사람이 없어요. 아래에서 관계를 추가하세요.','ledger-help'));
      const select=relationForm.elements.related;select.replaceChildren();for(const other of people.filter(x=>x.id!==p.id)){const option=node('option',other.name);option.value=other.id;select.append(option);}if(!select.children.length){const option=node('option','다른 인물을 먼저 등록하세요');option.value='';select.append(option);}
    }
    renderEntries();controls();
  }
  async function result(query){const {data,error}=await query;if(error)throw error;return data;}
  async function fetchAll(table){const rows=[];for(let offset=0;;offset+=200){const data=await result(client.from(table).select('*').order('created_at').order('id').range(offset,offset+199));rows.push(...data);if(data.length<200)return rows;}}
  function failure(error){return ['42P01','PGRST205'].includes(error?.code)?'CRM 설정이 필요해요. Supabase SQL Editor에서 supabase/crm.sql 전체를 실행하세요.':'저장·조회하지 못했습니다. '+(error?.message||'연결을 확인하고 다시 시도하세요.');}
  async function load(){if(!user||busy)return;const version=epoch;busy=true;controls();status('인물과 기록을 불러오는 중…');try{
    const data=await Promise.all([fetchAll('little_plan_people'),fetchAll('little_plan_relations'),fetchAll('little_plan_person_entries')]);if(version!==epoch)return;
    [people,relations,entries]=data;people.sort((a,b)=>a.name.localeCompare(b.name,'ko'));if(!person())selected='';ready=true;status('인물과 기록을 불러왔습니다.');
  }catch(error){if(version===epoch)status(failure(error),true);}finally{if(version===epoch){busy=false;render();}}}
  async function perform(action,success){if(!user||busy||!ready)return;const version=epoch;busy=true;controls();status('저장 중…');try{await action(()=>version===epoch);if(version===epoch){q('#crm-memory').hidden=true;status(success);}}catch(error){if(version===epoch)status(failure(error),true);}finally{if(version===epoch){busy=false;render();}}}
  async function resizePhoto(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('사진은 10MB 이하 JPG·PNG·WebP 파일을 선택하세요.');
    const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const photo=canvas.toDataURL('image/jpeg',0.8);if(photo.length>250000)throw new Error('사진을 더 작은 파일로 선택하세요.');return photo;}finally{bitmap.close();}
  }
  function openPersonForm(edit=false){editingPerson=edit?selected:null;personForm.reset();q('#crm-person-heading').textContent=edit?'인물 수정':'인물 등록';if(edit){personForm.elements.personName.value=person().name;personForm.elements.summary.value=person().summary;}personForm.hidden=false;personForm.elements.personName.focus();}
  q('#crm-new').addEventListener('click',()=>openPersonForm());q('#crm-edit').addEventListener('click',()=>openPersonForm(true));q('#crm-person-cancel').addEventListener('click',()=>{personForm.hidden=true;editingPerson=null;});
  personForm.addEventListener('submit',event=>{event.preventDefault();const f=personForm.elements,id=editingPerson,name=f.personName.value.trim(),summary=f.summary.value.trim(),file=f.photo.files[0],remove=f.removePhoto.checked;if(!name)return;
    const oldPhoto=people.find(p=>p.id===id)?.photo||'';
    perform(async active=>{const photo=file?await resizePhoto(file):remove?'':oldPhoto;if(!active())return;const values={name,summary,photo};const saved=await result(id?client.from('little_plan_people').update(values).eq('id',id).select().single():client.from('little_plan_people').insert(values).select().single());if(!active())return;people=people.filter(p=>p.id!==saved.id).concat(saved).sort((a,b)=>a.name.localeCompare(b.name,'ko'));choose(saved.id);},'인물을 저장했습니다.');
  });
  q('#crm-delete-person').addEventListener('click',()=>{const p=person();if(!p||!confirm(`${p.name} 인물과 이 사람의 모든 기록·관계를 삭제할까요? 되돌릴 수 없습니다.`))return;perform(async active=>{await result(client.from('little_plan_people').delete().eq('id',p.id));if(!active())return;people=people.filter(x=>x.id!==p.id);relations=relations.filter(r=>r.person_id!==p.id&&r.related_id!==p.id);entries=entries.filter(r=>r.person_id!==p.id);choose('');},'인물과 관련 기록을 삭제했습니다.');});
  relationForm.addEventListener('submit',event=>{event.preventDefault();const f=relationForm.elements,values={person_id:selected,related_id:f.related.value,label:f.label.value.trim(),reverse_label:f.reverseLabel.value.trim(),note:f.note.value.trim()};if(!values.person_id||!values.related_id||!values.label||!values.reverse_label)return;
    if(relationsFor(relations,selected).some(r=>r.otherId===values.related_id&&r.description===values.label)){status('이미 같은 관계가 있어요.',true);return;}
    perform(async active=>{const saved=await result(client.from('little_plan_relations').insert(values).select().single());if(!active())return;relations.push(saved);relationForm.reset();},'관계를 연결했습니다.');
  });
  entryForm.addEventListener('submit',event=>{event.preventDefault();const f=entryForm.elements,id=editingEntry,values={category:f.category.value,title:f.title.value.trim(),body:f.body.value.trim(),happened_on:f.date.value};if(!selected||!values.title||!values.happened_on)return;
    perform(async active=>{const saved=await result(id?client.from('little_plan_person_entries').update(values).eq('id',id).select().single():client.from('little_plan_person_entries').insert({...values,person_id:selected}).select().single());if(!active())return;entries=entries.filter(r=>r.id!==saved.id).concat(saved);resetEntry();},'기록을 저장했습니다.');
  });
  q('#crm-entry-cancel').addEventListener('click',resetEntry);q('#crm-refresh').addEventListener('click',load);q('#crm-search').addEventListener('input',render);
  for(const id of ['#crm-record-search','#crm-category','#crm-from','#crm-to'])q(id).addEventListener('input',()=>{q('#crm-memory').hidden=true;renderEntries();});
  q('#crm-all').addEventListener('click',()=>choose(''));
  q('#crm-reread').addEventListener('click',()=>{const today=dateString(new Date()),rows=matchingEntries().filter(r=>r.happened_on<=today);if(!rows.length){status('다시 읽을 기록이 없어요. 미래 일정은 해당 날짜부터 다시 읽기에 포함됩니다.');return;}const choices=rows.length>1?rows.filter(r=>r.id!==lastMemory):rows,entry=choices[Math.floor(Math.random()*choices.length)];lastMemory=entry.id;const memory=q('#crm-memory');memory.replaceChildren(node('h3','다시 만나는 기억'),entryCard(entry,false));memory.hidden=false;});
  globalThis.registerNoteTab({id:'crm',label:'인물 노트',panel,open:()=>{if(user&&!ready)load();}});
  globalThis.crmSessionChanged=()=>{epoch++;people=[];relations=[];entries=[];selected='';editingPerson=null;busy=false;ready=false;lastMemory='';personForm.reset();relationForm.reset();personForm.hidden=true;resetEntry();for(const id of ['#crm-search','#crm-record-search','#crm-category','#crm-from','#crm-to'])q(id).value='';q('#crm-profile').replaceChildren();q('#crm-relations').replaceChildren();relationForm.elements.related.replaceChildren();q('#crm-memory').replaceChildren();q('#crm-memory').hidden=true;status(user?'인물 노트를 열면 기록을 불러옵니다.':'로그인 후 이용할 수 있어요.');render();if(user&&!panel.hidden)load();};
  globalThis.crmSessionChanged();
})();
