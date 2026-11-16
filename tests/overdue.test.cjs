const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => readFileSync(path.join(__dirname, '..', file), 'utf8');

test('overdue query filters, sorts, paginates, and propagates errors', async () => {
  const calls = [], context = vm.createContext({});
  vm.runInContext(source('supabase/tasks-api.js'), context);
  let page = 0;
  const query = {};
  for (const name of ['select', 'lt', 'eq', 'order']) {
    query[name] = (...args) => { calls.push([name, ...args]); return query; };
  }
  query.range = (start, end) => {
    calls.push(['range', start, end]);
    return Promise.resolve({ data: page++ === 0 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }] });
  };
  const api = context.createTasksApi({ from: () => query });
  assert.equal((await api.loadOverdue('2026-11-11')).length, 501);
  assert.ok(calls.some(c => c[0] === 'lt' && c[1] === 'task_date' && c[2] === '2026-11-11'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'done' && c[2] === false));
  assert.deepEqual(calls.filter(c => c[0] === 'range'), [['range', 0, 499], ['range', 500, 999]]);
  assert.deepEqual(calls.filter(c => c[0] === 'order').slice(0, 3), [['order', 'task_date'], ['order', 'created_at'], ['order', 'id']]);
  query.range = async () => ({ error: new Error('offline') });
  await assert.rejects(api.loadOverdue(), /offline/);
});

function appContext() {
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.classList = { toggle() {} }; this.style = {}; this.value = ''; }
    setAttribute() {}
    insertBefore() {}
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    replaceChildren() { this.children = []; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
  }
  const elements = new Map();
  const select = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const context = vm.createContext({document: {
    querySelector: select, querySelectorAll: () => [], createElement: () => new Element()
  }, Intl, Date, setTimeout});
  vm.runInContext(source('app.js'), context);
  return { select, evaluate: code => vm.runInContext(code, context) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('completed total uses an exact count across all dates and propagates errors', async () => {
  const context = vm.createContext({}), calls = [];
  vm.runInContext(source('supabase/tasks-api.js'), context);
  const query = {
    select: (...args) => { calls.push(['select', ...args]); return query; },
    eq: (...args) => { calls.push(['eq', ...args]); return Promise.resolve({ count: 1501, error: null }); }
  };
  const api = context.createTasksApi({ from: () => query });
  assert.equal(await api.countCompleted(), 1501);
  assert.equal(calls[0][2].count, 'exact');
  assert.equal(calls[0][2].head, true);
  assert.deepEqual(calls[1], ['eq', 'done', true]);
  query.eq = async () => ({ error: new Error('offline') });
  await assert.rejects(api.countCompleted(), /offline/);
});

test('completed total refreshes after changes, survives date selection, and clears on logout', async () => {
  const { select, evaluate } = appContext();
  evaluate("user={id:'a'};api={countCompleted:async()=>12};");
  await evaluate('refreshCompleted();');
  evaluate('render();');
  assert.equal(select('#completed-total').textContent, '12개');
  await evaluate('run(async()=>{api.countCompleted=async()=>13;},"saved")');
  assert.equal(select('#completed-total').textContent, '13개');
  evaluate("day='2000-01-01';tasks=[];render();");
  assert.equal(select('#completed-total').textContent, '13개');
  evaluate("api.countCompleted=async()=>{throw new Error('offline')}");
  await evaluate('refreshCompleted();');
  evaluate('render();');
  assert.equal(select('#completed-total').textContent, '집계 확인 필요');
  evaluate('sessionChanged(null)');
  assert.equal(evaluate('completedTotal'), null);
  assert.equal(select('#completed-total').textContent, '로그인 후 확인');
});

test('levels start at one, advance at each ten XP, and have no level cap', () => {
  const { select, evaluate } = appContext();
  for (const [xp, level, progress] of [[0,1,0],[9,1,9],[10,2,0],[19,2,9],[20,3,0],[10000,1001,0]]) {
    evaluate(`user={id:'a'};completedTotal=${xp};render();`);
    assert.equal(select('#level-number').textContent, `Lv. ${level.toLocaleString('ko-KR')}`);
    assert.equal(select('#level-progress').value, progress);
    assert.equal(select('#level-details').hidden, false);
  }
  evaluate('completedTotal=null;render();');
  assert.equal(select('#level-details').hidden, true);
  evaluate('user=null;completedTotal=20;render();');
  assert.equal(select('#level-details').hidden, true);
});

test('level-up is announced on crossing a threshold; undo recalculates XP and level', async () => {
  const { select, evaluate } = appContext();
  evaluate("user={id:'a'};completedTotal=9;api={countCompleted:async()=>10};render();");
  await evaluate('run(async()=>{},"saved")');
  assert.match(select('#connection-status').textContent, /레벨업! Lv\. 2/);
  assert.equal(select('#level-progress').value, 0);
  evaluate('api.countCompleted=async()=>9');
  await evaluate('run(async()=>{},"saved")');
  assert.equal(select('#connection-status').textContent, 'saved');
  assert.equal(select('#level-number').textContent, 'Lv. 1');
  assert.equal(select('#level-progress').value, 9);
});

test('complete, reopen, and delete past tasks across both lists', async () => {
  const { select, evaluate } = appContext();
  evaluate(`user={id:'a'};
    tasks=[{id:'past',text:'숙제',done:false,task_date:'2000-01-01',created_at:'2000-01-01'}];
    overdueTasks=[...tasks];
    api={setDone:async(id,done)=>({...tasks[0],done}),remove:async()=>({id:'past'})};render();`);
  const row = select('#overdue-tasks').children[0];
  assert.equal(row.children[1].children[0].dateTime, '2000-01-01');
  row.children[0].checked = true;
  row.children[0].listeners.change();
  await settle();
  assert.equal(evaluate('tasks[0].done'), true);
  assert.equal(evaluate('overdueTasks.length'), 0);
  evaluate('saveTask({...tasks[0],done:false});render();');
  assert.equal(select('#overdue-tasks').children.length, 1);
  await select('#overdue-tasks').children[0].children[2].listeners.click();
  assert.equal(evaluate('tasks.length'), 0);
  assert.equal(evaluate('overdueTasks.length'), 0);
});

test('failed completion retains task; logout clears past data', async () => {
  const { select, evaluate } = appContext();
  evaluate(`user={id:'a'};overdueTasks=[{id:'past',text:'숙제',done:false,task_date:'2000-01-01'}];
    api={setDone:async()=>{throw new Error('offline');}};render();`);
  const check = select('#overdue-tasks').children[0].children[0];
  check.checked = true;
  check.listeners.change();
  await settle();
  assert.equal(evaluate('overdueTasks.length'), 1);
  assert.equal(select('#overdue-tasks').children[0].children[0].checked, false);
  evaluate('sessionChanged(null)');
  assert.equal(evaluate('overdueTasks.length'), 0);
  assert.equal(evaluate('overdueSection.hidden'), true);
});
