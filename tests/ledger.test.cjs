const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ledger.js'),'utf8');
test('balances include all dates and adjustments; monthly statistics include only expenses',()=>{
  const ctx=vm.createContext({Intl});vm.runInContext(source,ctx);
  const rows=[
    {account:'bank',kind:'adjustment',amount:50000,spent_on:'2026-10-01'},
    {account:'bank',kind:'expense',amount:-2000,category:'food',spent_on:'2026-10-31'},
    {account:'bank',kind:'expense',amount:-3000,category:'fixed',spent_on:'2026-11-01'},
    {account:'credit',kind:'adjustment',amount:10000,spent_on:'2026-11-01'},
    {account:'credit',kind:'expense',amount:-500,category:'hobby',spent_on:'2026-11-30'},
    {account:'paypay',kind:'adjustment',amount:1000,spent_on:'2026-11-01'},
    {account:'paypay',kind:'expense',amount:-200,category:'food',spent_on:'2026-12-01'}
  ];
  const data=ctx.ledgerSummary(rows,'2026-11');
  assert.equal(data.balances.bank,45000);assert.equal(data.balances.credit,9500);assert.equal(data.balances.paypay,800);
  assert.equal(data.total,3500);assert.equal(data.totals.food,0);assert.equal(data.totals.fixed,3000);assert.equal(data.expenses.length,2);
  const empty=ctx.ledgerSummary([],'2027-01');assert.equal(empty.total,0);assert.equal(empty.balances.bank,0);
});

function screen(){
  const nodes=new Map(), created=[];
  class Element{
    constructor(){this.children=[];this.attrs={};this.listeners={};this.value='';this.classList={toggle(){}};}
    setAttribute(k,v){this.attrs[k]=v;}
    append(...children){this.children.push(...children);}
    replaceChildren(){this.children=[];}
    addEventListener(k,fn){this.listeners[k]=fn;}
    querySelector(s){return get(s);}
    querySelectorAll(s){return s==='button'?[get('#todo-tab'),get('#ledger-tab')]:[];}
    reset(){for(const f of Object.values(this.elements||{}))f.value='';}
    focus(){}
  }
  const get=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
  for(const id of ['balance-form','expense-form']){get('#'+id).elements=Object.fromEntries(['account','amount','date','merchant','category'].map(k=>[k,{value:''}]));}
  const account=get('.account'),host=get('.planner');host.children=[account,new Element()];
  const calls=[];let stored=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return {error:null};},from:()=>{const query={select:()=>query,order:()=>query,range:async()=>({data:stored,error:null})};return query;}};
  const ctx=vm.createContext({Intl,document:{querySelector:get,createElement:()=>{const el=new Element();created.push(el);return el;}},account,user:{id:'a'},client,dateString:()=> '2026-11-17'});
  vm.runInContext(source,ctx);
  return {ctx,get,calls,created,setRows:r=>stored=r};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('ledger tab loads data, writes expense RPC, cancels expense, and clears on logout',async()=>{
  const {ctx,get,calls,created,setRows}=screen();
  get('#ledger-tab').listeners.click();await settle();
  assert.equal(created.find(el=>el.id==='todo-panel').hidden,true);
  assert.equal(created.find(el=>el.id==='ledger-panel').hidden,false);
  assert.equal(get('#ledger-tab').attrs['aria-selected'],'true');
  const form=get('#expense-form');Object.assign(form.elements.account,{value:'bank'});form.elements.amount.value='250';form.elements.merchant.value='점심';form.elements.category.value='food';form.elements.date.value='2026-11-17';
  setRows([{id:'e',account:'bank',kind:'expense',amount:-250,merchant:'점심',category:'food',spent_on:'2026-11-17',created_at:'2026-11-17'}]);
  form.listeners.submit({preventDefault(){},currentTarget:form});await settle();
  assert.equal(calls[0].name,'little_plan_record');assert.equal(calls[0].args.p_amount,250);assert.equal(calls[0].args.p_category,'food');assert.equal(calls[0].args.p_kind,'expense');
  const cancel=get('#ledger-expenses').children[0].children[1];cancel.listeners.click();await settle();assert.equal(calls[1].name,'little_plan_cancel_expense');assert.equal(calls[1].args.p_id,'e');
  vm.runInContext('user=null;ledgerSessionChanged()',ctx);assert.equal(get('#ledger-expenses').children.length,0);assert.match(get('#ledger-status').textContent,/로그인/);
});
