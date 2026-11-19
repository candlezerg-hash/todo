const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../crm.js'),'utf8');
function helpers(){const context=vm.createContext({});vm.runInContext(source,context);return context.crmHelpers;}
test('relationships use the correct direction and keep multiple roles',()=>{
  const {relationsFor}=helpers(),rows=[{id:'1',person_id:'child',related_id:'parent',label:'어머니',reverse_label:'아들'}, {id:'2',person_id:'parent',related_id:'colleague',label:'직장 동료',reverse_label:'직장 동료'}];
  const child=relationsFor(rows,'child');assert.equal(child.length,1);assert.equal(child[0].otherId,'parent');assert.equal(child[0].description,'어머니');
  const parent=relationsFor(rows,'parent');assert.equal(parent.length,2);assert.equal(parent[0].description,'아들');assert.equal(parent[0].otherId,'child');assert.equal(parent[1].otherId,'colleague');assert.equal(relationsFor(rows,'unknown').length,0);
});
test('journal filters combine owner, category, content and inclusive date boundaries',()=>{
  const {filterEntries}=helpers(),rows=[
    {id:'a',person_id:'p',category:'event',title:'점심',body:'커피를 좋아함',happened_on:'2026-11-19',created_at:'2026-11-19T00:00:00Z'},
    {id:'b',person_id:'q',category:'event',title:'점심',body:'커피',happened_on:'2026-11-19',created_at:'2026-11-19T00:00:00Z'},
    {id:'c',person_id:'p',category:'schedule',title:'약속',body:'커피',happened_on:'2026-11-20',created_at:'2026-11-19T00:00:00Z'},
    {id:'d',person_id:'p',category:'event',title:'과거',body:'커피',happened_on:'2026-11-18',created_at:'2026-11-19T00:00:00Z'}];
  const result=filterEntries(rows,{personId:'p',category:'event',search:' 커피 ',from:'2026-11-19',to:'2026-11-19'});assert.equal(result.length,1);assert.equal(result[0].id,'a');assert.equal(filterEntries(rows)[0].id,'c');assert.equal(filterEntries(rows,{from:'2026-11-20',to:'2026-11-18'}).length,0);assert.equal(rows[0].id,'a');
});

function screen(){
  const nodes=new Map();
  class Element{
    constructor(){this.listeners={};this.children=[];this.value='';this.hidden=false;this.files=[];this.classList={add(){},toggle(){}};this.attributes={};}
    querySelector(s){return get(s);}
    querySelectorAll(){return [];}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(k,fn){this.listeners[k]=fn;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];}
    focus(){}
    reset(){for(const el of Object.values(this.elements||{})){el.value='';el.files=[];el.checked=false;}}
  }
  function get(s){if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);}
  for(const [id,fields] of [['#crm-person-form',['personName','summary','photo','removePhoto']],['#crm-relation-form',['related','label','reverseLabel','note']],['#crm-entry-form',['category','date','title','body']]])get(id).elements=Object.fromEntries(fields.map(f=>[f,new Element()]));
  let registered,serial=0,hold,fail=false;
  const db={little_plan_people:[{id:'a',name:'민수',summary:'대학 친구',photo:'',created_at:'2026-11-19'}],little_plan_relations:[],little_plan_person_entries:[]};
  const client={from(table){let mode='read',values,id;const query={
    select(){return query;},order(){return query;},eq(k,v){id=v;return query;},insert(v){mode='insert';values=v;return query;},update(v){mode='update';values=v;return query;},delete(){mode='delete';return query;},
    range:async()=>{if(hold)return new Promise(resolve=>hold.push(()=>resolve({data:[...db[table]]})));if(fail)return {error:{message:'offline'}};return {data:[...db[table]]};},
    single:async()=>{const saved=mode==='insert'?{...values,id:'new'+(++serial),created_at:'2026-11-19'}:{...db[table].find(r=>r.id===id),...values};db[table]=db[table].filter(r=>r.id!==saved.id).concat(saved);return {data:saved};},
    then(resolve,reject){if(mode==='delete')db[table]=db[table].filter(r=>r.id!==id);return Promise.resolve({data:[]}).then(resolve,reject);}
  };return query;}};
  const context=vm.createContext({document:{createElement:()=>new Element()},client,user:{id:'u'},dateString:()=> '2026-11-19',confirm:()=>true,registerNoteTab:tab=>{registered=tab;tab.panel.hidden=true;}});
  vm.runInContext(source,context);
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const click=async id=>{get(id).listeners.click();await tick();};
  const submit=async id=>{get(id).listeners.submit({preventDefault(){}});await tick();};
  return {get,context,db,tick,click,submit,open:async()=>{registered.panel.hidden=false;registered.open();await tick();},pause:()=>{hold=[];return hold;},fail:()=>{fail=true;}};
}
test('CRM registers people, links both directions, writes records, filters and clears private data on logout',async()=>{
  const s=screen();await s.open();assert.equal(s.get('#crm-people').children.length,1);
  await s.click('#crm-new');const p=s.get('#crm-person-form').elements;p.personName.value='지수';p.summary.value='회사 동료';await s.submit('#crm-person-form');
  assert.equal(s.db.little_plan_people.length,2);assert.equal(s.get('#crm-detail').hidden,false);
  const r=s.get('#crm-relation-form').elements;r.related.value='a';r.label.value='선배';r.reverseLabel.value='후배';r.note.value='소개로 만남';await s.submit('#crm-relation-form');assert.equal(s.db.little_plan_relations.length,1);
  const e=s.get('#crm-entry-form').elements;e.category.value='journal';e.date.value='2026-11-19';e.title.value='커피 취향';e.body.value='라테를 좋아한다';await s.submit('#crm-entry-form');assert.equal(s.db.little_plan_person_entries.length,1);
  assert.equal(s.get('#crm-entries').children.length,2);await s.click('#crm-reread');assert.equal(s.get('#crm-memory').hidden,false);
  s.get('#crm-record-search').value='없는 단어';s.get('#crm-record-search').listeners.input();assert.equal(s.get('#crm-entries').children.length,2);assert.match(s.get('#crm-entries').children[0].textContent,/0개의/);
  s.get('#crm-record-search').value='';await s.click('#crm-all');assert.equal(s.get('#crm-detail').hidden,true);
  s.context.user=null;s.context.crmSessionChanged();assert.equal(s.get('#crm-people').children.length,0);assert.equal(s.get('#crm-profile').children.length,0);assert.equal(s.get('#crm-memory').children.length,0);
});
test('stale CRM loading after logout is discarded and connection errors are shown',async()=>{
  const s=screen(),pending=s.pause();const opening=s.open();await s.tick();assert.equal(pending.length,3);s.context.user=null;s.context.crmSessionChanged();pending.forEach(resolve=>resolve());await opening;await s.tick();assert.equal(s.get('#crm-people').children.length,0);assert.match(s.get('#crm-status').textContent,/로그인/);
  const broken=screen();broken.fail();await broken.open();assert.match(broken.get('#crm-status').textContent,/offline/);assert.equal(broken.get('#crm-people').children.length,0);
});
