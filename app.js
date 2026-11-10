'use strict';
const storageKey = 'little-plan-v1';
const initial = [{ text: '물 한 잔 마시고 하루 시작하기', done: true }, { text: '오늘 가장 중요한 일 하나 정하기', done: false }, { text: '잠깐 밖에 나가 산책하기', done: false }];
let tasks;
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  tasks = Array.isArray(saved) ? saved.filter(t => t && typeof t.text === 'string' && typeof t.done === 'boolean') : initial;
} catch { tasks = initial; }
document.querySelector('#today').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
function render() {
  const list = document.querySelector('#tasks');
  list.replaceChildren();
  tasks.forEach((task, index) => {
    const row = document.createElement('li');
    row.classList.toggle('done', task.done);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', task.text + ' 완료');
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; update(); list.children[index]?.querySelector('input').focus(); });
    const label = document.createElement('span'); label.className = 'text'; label.textContent = task.text;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = '×';
    remove.setAttribute('aria-label', task.text + ' 삭제');
    remove.addEventListener('click', () => { tasks.splice(index, 1); update(); const next = list.children[Math.min(index, tasks.length - 1)]; (next?.querySelector('.delete') || document.querySelector('#task-input')).focus(); });
    row.append(checkbox, label, remove); list.append(row);
  });
  const complete = tasks.filter(t => t.done).length;
  const percent = tasks.length ? Math.round(complete / tasks.length * 100) : 0;
  document.querySelector('#count').textContent = tasks.length;
  document.querySelector('#progress-text').textContent = `${tasks.length}개 중 ${complete}개 완료`;
  document.querySelector('#percentage').textContent = `${percent}%`;
  document.querySelector('#progress-bar').style.width = `${percent}%`;
  document.querySelector('#empty').hidden = tasks.length > 0;
  document.querySelector('#clear').disabled = complete === 0;
}
function update() {
  try { localStorage.setItem(storageKey, JSON.stringify(tasks)); } catch { storageAvailable = false; }
  if (!storageAvailable) document.querySelector('.list-footer span').textContent = '저장 공간을 사용할 수 없어 새로고침하면 초기화됩니다.';
  render();
}
document.querySelector('#task-form').addEventListener('submit', event => {
  event.preventDefault(); const input = document.querySelector('#task-input'); const text = input.value.trim();
  if (!text) { input.focus(); return; }
  tasks.push({ text, done: false }); input.value = ''; update(); input.focus();
});
document.querySelector('#clear').addEventListener('click', () => { tasks = tasks.filter(t => !t.done); update(); });
render();
