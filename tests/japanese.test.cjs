const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../japanese.js'),'utf8');

test('weighted selection favors less-read expressions and reduces immediate repeats',()=>{
  const ctx=vm.createContext({});vm.runInContext(source,ctx);
  const rows=[{id:'new',read_count:0},{id:'old',read_count:9}];
  let fresh=0,repeat=0;
  for(let i=0;i<1000;i++){
    if(ctx.pickJapanesePhrase(rows,null,()=>i/1000).id==='new')fresh++;
    if(ctx.pickJapanesePhrase(rows,'new',()=>i/1000).id==='new')repeat++;
  }
  assert.ok(fresh>900);assert.ok(repeat<fresh);assert.ok(repeat>500);
  assert.equal(ctx.pickJapanesePhrase([],null),null);
  assert.equal(ctx.pickJapanesePhrase([rows[0]],'new').id,'new');
});

function screen(){
  const nodes=new Map();
  class Element{
    constructor(){this.listeners={};this.classList={toggle(){}};this.value='';}
    querySelector(s){return get(s);}
    querySelectorAll(){return [];}
    setAttribute(){}
    addEventListener(name,fn){this.listeners[name]=fn;}
    reset(){for(const f of Object.values(this.elements||{}))f.value='';}
  }
  function get(s){if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);}
  const form=get('#japanese-form');form.elements={expression:{value:''},meaning:{value:''},reading:{value:''}};
  let registered,rows=[{id:'a',expression:'こんにちは',meaning:'안녕하세요',reading:'',read_count:0}],fail=false,resolveRpc;
  const calls=[];
  const client={
    from(){let entry;const query={select:()=>query,order:()=>query,range:async()=>({data:[...rows]}),insert:data=>{entry=data;return query;},single:async()=>{const row={...entry,id:'b',read_count:0};rows.push(row);return {data:row};}};return query;},
    async rpc(name,args){calls.push([name,args]);if(fail)return {error:{message:'offline'}};if(resolveRpc)return new Promise(resolve=>resolveRpc.resolve=resolve);rows=rows.map(r=>r.id===args.p_id?{...r,read_count:r.read_count+1}:r);return {data:rows.filter(r=>r.id===args.p_id)};}
  };
  const ctx=vm.createContext({document:{createElement:()=>new Element()},user:{id:'u'},client,registerNoteTab:tab=>{registered=tab;tab.panel.hidden=true;}});
  vm.runInContext(source,ctx);
  return {get,ctx,calls,open:()=>{registered.panel.hidden=false;registered.open();},fail:()=>fail=true,defer:()=>{resolveRpc={};return resolveRpc;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('registration, reading, failure retention, statistics, and logout',async()=>{
  const {get,ctx,calls,open,fail}=screen();open();await settle();
  assert.equal(get('#japanese-count').textContent,'1개');assert.equal(get('#japanese-reads').textContent,'0회');
  assert.equal(get('#phrase-expression').textContent,'こんにちは');
  await get('#phrase-read').listeners.click();
  assert.equal(calls[0][0],'little_plan_read_japanese');assert.equal(get('#japanese-reads').textContent,'1회');assert.equal(get('#japanese-unread').textContent,'0개');
  const form=get('#japanese-form');form.elements.expression.value='ありがとう';form.elements.meaning.value='고마워요';
  await form.listeners.submit({preventDefault(){},currentTarget:form});
  assert.equal(get('#japanese-count').textContent,'2개');assert.equal(get('#japanese-unread').textContent,'1개');
  const before=get('#phrase-expression').textContent;fail();await get('#phrase-read').listeners.click();
  assert.equal(get('#phrase-expression').textContent,before);assert.equal(get('#japanese-reads').textContent,'1회');assert.match(get('#japanese-status').textContent,/offline/);
  vm.runInContext('user=null;japaneseSessionChanged()',ctx);
  assert.equal(get('#japanese-count').textContent,'—');assert.equal(get('#phrase-read').disabled,true);
});

test('double clicks and stale reads after logout do not change the new session',async()=>{
  const {get,ctx,calls,open,defer}=screen();open();await settle();
  const pending=defer();const first=get('#phrase-read').listeners.click();await get('#phrase-read').listeners.click();assert.equal(calls.length,1);
  vm.runInContext('user=null;japaneseSessionChanged()',ctx);
  pending.resolve({data:[{id:'a',expression:'こんにちは',meaning:'안녕하세요',reading:'',read_count:1}]});await first;
  assert.equal(get('#japanese-count').textContent,'—');assert.match(get('#japanese-status').textContent,/로그인/);
});
