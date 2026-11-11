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
