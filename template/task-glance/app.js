// タスク一覧のまとめ — Doneq 外部アプリのサンプル
// 使う権限: tasks:read（件数の集計）/ tasks:write（タスク追加）/ storage（メモ保存）
// fetch・localStorage・type="module"・外部 CDN は使わない（アプリ内では使えないため）
(function () {
  'use strict';

  // 状態の表示名と並び順（Doneq の status 6 値）
  var STATUS_LABELS = {
    todo: '未着手',
    queued: '実行待ち',
    in_progress: '実行中',
    awaiting_approval: '承認待ち',
    done: '完了',
    failed: '失敗'
  };
  var STATUS_ORDER = ['todo', 'queued', 'in_progress', 'awaiting_approval', 'done', 'failed'];
  var MEMO_KEY = 'memo';

  function $(id) { return document.getElementById(id); }

  // エラーを画面内に表示する（code があれば併記）
  function showError(err) {
    var msg = (err && err.message) ? err.message : String(err);
    if (err && err.code) msg += '（' + err.code + '）';
    $('error').textContent = 'エラー: ' + msg;
    $('error').hidden = false;
  }

  function clearError() {
    $('error').hidden = true;
    $('error').textContent = '';
  }

  // 今日の日付を YYYY-MM-DD（端末のローカル日付）で返す
  function todayYmd() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // 期限切れ = 未完了 かつ 期日が今日より前（due_date は YYYY-MM-DD 文字列なので文字列比較でよい）
  function isOverdue(task, today) {
    return !!task.due_date && task.due_date < today && task.status !== 'done';
  }

  // タスク一覧を取得して件数を描画する
  async function refreshCounts() {
    clearError();
    try {
      var tasks = await DoneqApp.tasks.list();
      var counts = {};
      STATUS_ORDER.forEach(function (s) { counts[s] = 0; });
      var today = todayYmd();
      var overdue = 0;
      tasks.forEach(function (t) {
        if (Object.prototype.hasOwnProperty.call(counts, t.status)) counts[t.status] += 1;
        if (isOverdue(t, today)) overdue += 1;
      });

      var list = $('counts');
      list.textContent = '';
      STATUS_ORDER.forEach(function (s) {
        var li = document.createElement('li');
        var label = document.createElement('span');
        label.textContent = STATUS_LABELS[s];
        var num = document.createElement('strong');
        num.textContent = String(counts[s]);
        li.appendChild(label);
        li.appendChild(num);
        list.appendChild(li);
      });
      $('overdue').textContent = String(overdue);
    } catch (err) {
      showError(err);
    }
  }

  // タイトルだけでタスクを1件追加する
  async function addTask(ev) {
    ev.preventDefault(); // フォーム送信によるページ遷移を止める（form-action は禁止されている）
    clearError();
    var input = $('add-title');
    var title = input.value.trim();
    if (!title) return;
    try {
      var task = await DoneqApp.tasks.create({ title: title });
      input.value = '';
      await DoneqApp.ui.toast('タスクを追加しました: ' + task.title);
      await refreshCounts();
    } catch (err) {
      showError(err);
    }
  }

  // メモを storage から復元する（未保存なら null が返る）
  async function loadMemo() {
    try {
      var value = await DoneqApp.storage.get(MEMO_KEY);
      $('memo').value = typeof value === 'string' ? value : '';
    } catch (err) {
      showError(err);
    }
  }

  // メモを storage へ保存する
  async function saveMemo() {
    clearError();
    $('memo-state').textContent = '保存中…';
    try {
      await DoneqApp.storage.set(MEMO_KEY, $('memo').value);
      $('memo-state').textContent = '保存しました';
    } catch (err) {
      $('memo-state').textContent = '';
      showError(err);
    }
  }

  async function main() {
    // SDK が読めていない、または Doneq の外で直接開かれた場合は案内だけ出す
    if (typeof window.DoneqApp === 'undefined' || !DoneqApp.isEmbedded) {
      $('not-embedded').hidden = false;
      return;
    }
    $('app').hidden = false;

    try {
      var info = await DoneqApp.info();
      $('version').textContent = 'v' + info.version;
      document.documentElement.setAttribute('data-theme', info.theme === 'light' ? 'light' : 'dark');
    } catch (err) {
      showError(err);
    }

    $('refresh').addEventListener('click', refreshCounts);
    $('add-form').addEventListener('submit', addTask);
    $('memo-save').addEventListener('click', saveMemo);
    $('memo').addEventListener('input', function () { $('memo-state').textContent = '未保存の変更があります'; });

    await Promise.all([refreshCounts(), loadMemo()]);
  }

  main();
})();
