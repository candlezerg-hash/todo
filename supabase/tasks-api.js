// 기존 화면과 연결할 때 쓰는 supabase-js v2용 어댑터입니다.
// createTasksApi(supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY))
// 로그인/토큰 갱신은 supabase-js가 맡습니다. 이 파일은 자동 실행하지 않습니다.
(function (root) {
  'use strict';
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function createTasksApi(client) {
    const table = 'little_plan_tasks';
    async function result(query) {
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    return {
      // 1,000개 이상이어도 페이지 단위로 불러옵니다.
      async load(day = localDate()) {
        const rows = [];
        for (let start = 0; ; start += 500) {
          const page = await result(client.from(table)
            .select('id,text,done,task_date,created_at')
            .eq('task_date', day).order('created_at').order('id')
            .range(start, start + 499));
          rows.push(...page);
          if (page.length < 500) return rows;
        }
      },
      async add(text, day = localDate()) {
        const trimmed = text.trim();
        if (!trimmed || Array.from(trimmed).length > 120) throw new Error('할 일을 1~120자로 입력하세요.');
        return result(client.from(table).insert({ text: trimmed, done: false, task_date: day }).select().single());
      },
      async setDone(id, done) {
        if (typeof done !== 'boolean') throw new Error('완료 상태는 true 또는 false여야 합니다.');
        return result(client.from(table).update({ done }).eq('id', id).select().single());
      },
      async remove(id) {
        // single()로 없는 행이나 접근할 수 없는 행의 삭제를 성공으로 처리하지 않습니다.
        return result(client.from(table).delete().eq('id', id).select('id').single());
      },
      async clearDone(day = localDate()) {
        return result(client.from(table).delete().eq('task_date', day).eq('done', true).select('id'));
      }
    };
  }
  root.createTasksApi = createTasksApi;
  root.littlePlanLocalDate = localDate;
})(globalThis);
