---
name: doneq-app
description: Use when creating, modifying, debugging, or publishing a Doneq external app (外部アプリ / コミュニティアプリ), when a doneq-app.json manifest or the DoneqApp SDK (/app-sdk/v1.js) is involved, or when asked to build a small screen that runs inside Doneq's "アプリを追加" / app sidebar.
---

# Doneq 外部アプリを作る

対応 SDK: v1（`/app-sdk/v1.js`）。手元の Doneq がこの版を配信していなければ、Doneq の画面「SKILL.md を保存」で手元と同じ版を使う。

## Overview

Doneq の外部アプリは「静的ファイル（HTML/JS/CSS/画像）＋ **`doneq-app.json`（必須のマニフェスト）**」だけでできた画面。サーバ側のコードは書けない。アプリは `sandbox="allow-scripts allow-forms"` の iframe（不透明オリジン・`connect-src 'none'`）で動き、Doneq のデータには SDK `window.DoneqApp` 経由で、マニフェストに宣言し利用者が追加時に許可した権限の範囲だけ触れる。配布は GitHub 公開リポジトリの URL、開発中はローカルフォルダの絶対パスで追加する。

核心:
- **HTTP 通信は一切できない。** Doneq の REST API（`/api/tasks` 等）を直接呼ばない。データは SDK だけで取る。
- **アプリは認証トークン・API の URL・ポートを扱わない（扱えない）。** 親画面の Doneq が権限を確認して代行する。接続設定の入力欄は作らない。
- **ブラウザ保存とモジュールは使えない。** 保存は `DoneqApp.storage`、スクリプトは classic script。
- **モックデータで代用しない。** Doneq の外で開かれたら「Doneq の中で開いてください」と出すだけにする。
- **1ページ構成。** 別 HTML への遷移・外部リンクはできない（ブラウザ版はアプリが停止、デスクトップ版は遷移がブロックされる）。画面切替は1つの HTML 内で DOM を出し分ける。
- **読んだデータを外へ送る仕組みを作らない。** ブラウザ版では遷移や WebRTC などの経路を完全には塞げず、権限は利用者が「作者を信頼できる場合だけ」許可するもの。

## Quick Reference

### doneq-app.json（フォルダ直下に必ず置く。無いと追加できない）

| キー | 必須 | 制約 |
|---|---|---|
| `manifest_version` | 必須 | `1` |
| `id` | 必須 | `^[a-z][a-z0-9-]{1,39}$`。公式 id（`gcal` `objectives` `reports`）と `_sdk` は不可。公開後は変えない |
| `name` | 必須 | 1〜40文字 |
| `version` | 必須 | `^\d+\.\d+\.\d+$` |
| `description` | 必須 | 1〜200文字 |
| `entry` | 任意 | 既定 `index.html`。フォルダ内の相対パス・`.html`・`..` 不可 |
| `author` | 任意 | 〜60文字 |
| `homepage` | 任意 | `https://` で始まる |
| `permissions` | 任意 | 既定 `[]`。`tasks:read` `tasks:write` `storage` のみ |

ファイル制限: 300 ファイル・5MB、深さはアプリ直下 0 段でフォルダ 6 段まで。ドットファイルと `node_modules` は除外し、それ以外の範囲に symlink があると拒否。`/app-frame/<id>/` は `entry` を返す。取り込む拡張子は `html htm js css json svg png jpg jpeg gif webp ico woff woff2 txt md` のみ（`.mjs` `.ts` や、`LICENSE` のような拡張子の無いファイルは黙って除外されるだけで、追加は拒否されない。GitHub 上に `LICENSE` を置くのは問題ない）。

### SDK（`<script src="/app-sdk/v1.js"></script>`）

| 呼び出し | 権限 | 戻り値（Promise） |
|---|---|---|
| `DoneqApp.info()` | 不要 | `{ id, name, version, permissions, locale, theme }` |
| `DoneqApp.tasks.list({ status? })` | `tasks:read` | タスク配列 |
| `DoneqApp.tasks.create({ title, description?, due_date?, priority? })` | `tasks:write` | task（常に `todo` で作られる） |
| `DoneqApp.tasks.update({ id, title?, status?, due_date?, priority? })` | `tasks:write` | task（`status` は `todo` / `done` のみ指定可。対象は現在 `todo` / `done` のタスクだけ） |
| `DoneqApp.storage.get(key)` / `.set(key, value)` / `.remove(key)` | `storage` | 値（無ければ `null`）/ `undefined` / `undefined` |
| `DoneqApp.ui.toast(message)` | 不要 | `undefined`（先頭にアプリ名が付いて表示。200文字で切られるプレーンテキスト。1秒に1回まで、超えた分は表示されない） |
| `DoneqApp.call(method, params)` | メソッド次第 | 生の result（`tasks.list` なら `{ tasks }`） |
| `DoneqApp.isEmbedded` | - | Doneq 内なら `true`（プロパティ） |

- タスク項目（フィールド名はこのとおり。`dueDate` `due` `deadline` は存在しない）: `id, title, status, priority, due_date, start_date, created_at, completed_at`。`id` は `task-<数字>` 形式の文字列（例 `task-1791439003609`）で、そのままストレージのキーに使える
- `status`: `todo` / `queued` / `in_progress` / `awaiting_approval` / `done` / `failed`
- `priority`: `high` / `medium` / `low` / `null`。`due_date` / `start_date`: `YYYY-MM-DD` 文字列または `null`
- 失敗時は Error で拒否。`err.code` = `permission_denied` / `unknown_method` / `invalid_params` / `failed` / `timeout`（15秒）/ `not_embedded`（Doneq の外で開かれている）。`ui.toast` も同じく拒否しうるので `.catch` を付ける
- 回数制限: 同時に応答待ちにできる依頼は1アプリ 8 件まで（超えると `failed`）。一覧の全件を `Promise.all` で更新するような並列呼び出しはせず、`await` で順に呼ぶ
- `tasks.update` は現在の `status` が `todo` / `done` のタスクだけ変更できる（AI 実行中・承認待ち・失敗のタスクは `title` も含めて `invalid_params`）
- ストレージはアプリ専用・合計 256KB まで。キーは `^[\w.-]{1,64}$`。「更新」では残り、アプリ削除時だけ消える

「今日が期限」の判定（ローカル日付で比較する。`toISOString()` は UTC なので使わない）:

```js
var d = new Date();
var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
var dueToday = tasks.filter(function (t) { return t.due_date === today && t.status !== 'done'; });
```

### 権限

| 権限 | 意味 | 付ける条件 |
|---|---|---|
| `tasks:read` | タスク一覧を読む | 一覧・集計を表示する |
| `tasks:write` | タスクを追加・変更する | 追加・完了化・期日変更をする |
| `storage` | アプリ専用の保存領域 | 設定やメモを次回まで残す |

## 最小テンプレ

`doneq-app.json`:

```json
{
  "manifest_version": 1,
  "id": "todo-counter",
  "name": "未着手カウンター",
  "version": "1.0.0",
  "description": "未着手のタスク件数を表示します。",
  "permissions": ["tasks:read"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>未着手カウンター</title>
  <style>body { font: 14px system-ui, sans-serif; margin: 24px; }</style>
</head>
<body>
  <h1>未着手: <span id="count">-</span> 件</h1>
  <p id="msg"></p>
  <script src="/app-sdk/v1.js"></script>
  <script>
    (async function () {
      var msg = document.getElementById('msg');
      // Doneq の外では動かさない（モックで代用しない）
      if (typeof DoneqApp === 'undefined' || !DoneqApp.isEmbedded) {
        msg.textContent = 'Doneq の中で開いてください。';
        return;
      }
      try {
        var tasks = await DoneqApp.tasks.list({ status: 'todo' });
        document.getElementById('count').textContent = String(tasks.length);
      } catch (err) {
        msg.textContent = 'エラー: ' + err.message + '（' + (err.code || 'unknown') + '）';
      }
    })();
  </script>
</body>
</html>
```

## 作業手順

1. **要件を決める**: 何を表示し、何を操作するか。外部通信が必要な要件は実現できないと先に伝える。
2. **権限を最小に決める**: 読むだけなら `tasks:read` のみ。保存が要るときだけ `storage`。
3. **ファイルを作る**: 最初に `doneq-app.json`、次に上のテンプレの `index.html`。JS が長くなれば `app.js` に分けて `<script src="app.js">` で SDK の後に読む。エラーは画面内に表示する。
4. **手元で確認する**: Doneq の「アプリを追加」→「URL から追加」→「ローカルフォルダから（開発者向け）」にフォルダの絶対パス → 確認 → 追加 → サイドナビから開く。直したら詳細の「更新を確認」で取り込み直す（ファイルはコピーされるため自動反映されない）。
5. **公開する**: GitHub 公開リポジトリのルート（またはサブフォルダ）に置き、`README.md`・`LICENSE` を添える。URL は `https://github.com/<owner>/<repo>[/tree/<ref>[/<subpath>]]`。変更ごとに `version` を上げる。
6. **チェックリストを全項目確認して報告する**。

## Common Mistakes

| 間違い | 結果 | 正しくは |
|---|---|---|
| `doneq-app.json` を作らない | 追加できない | フォルダ直下に必ず作る |
| `fetch('http://127.0.0.1:4242/api/tasks')` や `/api/task`・`/tasks.json` を叩く | `connect-src 'none'` で全滅 | `DoneqApp.tasks.list()` |
| XHR / WebSocket で外部 API を呼ぶ | CSP で全て失敗 | 外部通信は不可 |
| API のベース URL・ポート・トークンの「接続設定」欄を作る | 不要な UI。入力しても通信できない | 作らない。SDK は設定なしで動く |
| 認証を「無し」と推測、またはトークンを探す | 誤った前提の実装 | アプリはトークンを扱わない。親の Doneq が権限を確認して代行する |
| 期限を `dueDate` / `due` / `deadline` と推測 | 常に `undefined` | `due_date`（`YYYY-MM-DD` または `null`） |
| 今日の日付を `toISOString().slice(0, 10)` で作る | 日本時間の午前に前日扱い | ローカル日付で組み立てる（上の例） |
| `localStorage` / `sessionStorage` / Cookie に保存 | 不透明オリジンで例外 | `DoneqApp.storage` |
| 接続できないときにモックデータへ自動フォールバック | 偽データを実データと誤認させる | 禁止。`isEmbedded` が偽なら「Doneq の中で開いてください」、SDK 失敗はエラー表示 |
| `<script type="module">` / `import` | CORS が要り読めない | classic script を並べる |
| 外部 CDN（ライブラリ・Web フォント） | CSP で読めない | フォルダに同梱 |
| 権限の付け忘れ | `permission_denied` | 使うメソッドの権限を宣言 |
| 権限の付けすぎ | 利用者が警戒して追加しない | 使うものだけ |
| `id` に大文字・`_`・数字始まり・公式 id | 追加時に拒否 | 英小文字始まり、英小文字・数字・ハイフン |
| `entry` に `../`・`.html` 以外・存在しないファイル | 拒否または真っ白 | フォルダ内の実在する `.html` |
| SDK を自分のスクリプトより後に読む | `DoneqApp is not defined` | SDK を先に読む |
| `tasks.list` の戻り値を `{ tasks }` と思う | `undefined` を扱う | 糖衣は配列を返す（`call` だけ生の result） |
| `alert` / `window.open` / `target="_blank"` | sandbox で動かない | 画面内表示・`ui.toast` |
| `<form>` を素で送信 | `form-action 'none'` で止まる | `submit` で `preventDefault()` |
| 別 HTML へのリンク・`location.href` 変更・外部リンクで画面を切り替える | ブラウザ版はアプリ停止、デスクトップ版は遷移がブロック | 1つの HTML 内で DOM を出し分ける |
| `tasks.update` で `status: 'in_progress'` 等にする／AI 実行中のタスクを更新する | エラーになる | `todo` か `done` だけ（AI 実行の状態にはできない）。更新対象は `status` が `todo` / `done` のタスクに絞る |
| 依頼を 9 件以上同時に投げる（`Promise.all` 等） | 超えた分が `failed` | `await` で順に呼ぶ |
| ストレージのキーに空白・`/`・日本語を使う | 保存エラー | 英数字・`_`・`.`・`-` で64文字以内 |

## チェックリスト

- [ ] `doneq-app.json` がフォルダ直下にあり、Quick Reference の制約を満たす
- [ ] `version` を前回より上げた
- [ ] `permissions` が使う機能と一致（過不足なし）
- [ ] SDK を classic script で先に読み、タスクの取得・更新は `DoneqApp.tasks.*` だけで行う
- [ ] `fetch`・XHR・WebSocket・`/api/` への直接アクセス・URL/ポート/トークンの入力欄が無い
- [ ] タスクのフィールド名が `due_date` 等の正式名で、日付比較はローカル日付の `YYYY-MM-DD`
- [ ] localStorage・sessionStorage・Cookie・module・外部 CDN・ポップアップを使っていない
- [ ] モックデータへのフォールバックが無い。`isEmbedded` が偽なら「Doneq の中で開いてください」
- [ ] SDK の失敗を `err.code` 付きで画面内に表示している
- [ ] 1ページ構成で、別 HTML・外部リンクへの遷移が無い
- [ ] `tasks.update` の `status` は `todo` / `done` だけで、対象も `todo` / `done` のタスクだけ。ストレージのキーは `^[\w.-]{1,64}$`
- [ ] 拡張子が取り込み対象内、300 ファイル・5MB 以下、symlink 無し
- [ ] ローカルフォルダから追加して表示・操作を確認した
- [ ] `README.md`（用途・権限の理由）と `LICENSE` がある
