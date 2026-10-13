# Doneq 外部アプリ（コミュニティアプリ）開発者ガイド

TL;DR
- 外部アプリは「静的な HTML/JS/CSS ＋ `doneq-app.json`」だけでできた小さな画面で、GitHub の公開リポジトリに置けば利用者が URL を貼るだけで追加できる。
- アプリは隔離された iframe の中で動き、通信・localStorage・Cookie は使えない。Doneq のデータには SDK（`/app-sdk/v1.js` の `DoneqApp`）経由で、利用者が許可した権限の範囲だけ触れる。
- 作り方は「マニフェストと index.html を書く → ローカルフォルダから追加して試す → GitHub で公開する」の3段階。AI に作らせるときは doneq-app スキル（SKILL.md）を入れる。スキルは公開キット https://github.com/taisei17/doneq-app-kit から導入するか、Doneq のアプリ制作ガイド画面の「SKILL.md を保存」で入手できる（§10）。

## 1. 外部アプリとは

| | 公式アプリ（例: カレンダー） | 外部アプリ（コミュニティアプリ） |
|---|---|---|
| 誰が作る | Doneq 本体の開発者 | 誰でも |
| 置き場所 | Doneq 本体に同梱 | 作者の GitHub 公開リポジトリ（開発中は手元のフォルダ） |
| 中身 | サーバ API・画面・DB を自由に使える | 静的ファイル（HTML/JS/CSS/画像）だけ |
| データへのアクセス | 直接 | SDK 経由・許可された権限の範囲だけ |
| 手順書 | Doneq 本体の開発者向け（本ガイドの対象外） | この文書 |

できること: タスクの一覧を読む、タスクを追加・変更する、アプリ専用の保存領域に値を保存する、Doneq の画面にトースト（短い通知）を出す。

できないこと: 外部サーバとの通信、Doneq のファイルや設定・AI 実行への直接アクセス、サーバ側でのコード実行、ポップアップや新しいタブを開くこと。

## 2. 構成

```
my-app/
  doneq-app.json   必須。マニフェスト
  index.html       必須（entry で変更可）
  app.js / style.css / 画像   任意
  README.md        推奨（GitHub 上の説明）
  LICENSE          推奨（MIT など）
```

### doneq-app.json

| キー | 必須 | 制約 |
|---|---|---|
| `manifest_version` | 必須 | `1` |
| `id` | 必須 | `^[a-z][a-z0-9-]{1,39}$`（英小文字で始まり、英小文字・数字・ハイフンで計2〜40文字）。公式アプリの id（`gcal` 等）と予約語（`_sdk`）は不可 |
| `name` | 必須 | 1〜40文字 |
| `version` | 必須 | `^\d+\.\d+\.\d+$`（例: `1.0.0`） |
| `description` | 必須 | 1〜200文字 |
| `entry` | 任意 | 既定 `index.html`。アプリフォルダ内の相対パス・`.html` のみ・`..` 不可 |
| `author` | 任意 | 〜60文字 |
| `homepage` | 任意 | `https://` で始まる URL |
| `permissions` | 任意 | 既定 `[]`。`tasks:read` `tasks:write` `storage` のみ |

```json
{
  "manifest_version": 1,
  "id": "my-app",
  "name": "マイアプリ",
  "version": "1.0.0",
  "description": "何をするアプリかを1〜2文で。",
  "permissions": ["tasks:read"]
}
```

`id` はアプリの身元です。同じ `id` のアプリを追加すると「更新」として置き換わるため、他人と重なりにくい名前にし、公開後は変えないでください。

### エントリポイントとファイル制限

- 画面は `entry`（既定 `index.html`）から始まる。`/app-frame/<id>/` を開くと `entry` が返る。使うのは「自分のフォルダ内の相対パス」と `/app-sdk/v1.js` だけにする（それ以外の Doneq のパスに依存しない）。
- **アプリは1ページ構成**。別の HTML への遷移やリンク移動はできない（§5）。画面の切り替えは1つの HTML の中で DOM を出し分けて行う。
- 取り込み時の制限: 合計 300 ファイル・5MB 以下。深さはアプリ直下を 0 段として、フォルダ 6 段まで。
- `.` で始まるファイル/フォルダ（`.git` など）と `node_modules` は取り込まない。それ以外の範囲に symlink があると追加を拒否する（除外される範囲の symlink は問題にならない）。
- 取り込む拡張子は `html htm js css json svg png jpg jpeg gif webp ico woff woff2 txt md` のみ。それ以外（`.mjs`・`.map`・`.ts` など）は黙って除外される。拡張子の無い `LICENSE` も Doneq には取り込まれないが、GitHub 上で読まれるためのファイルなので問題ない。

## 3. SDK リファレンス

`index.html` で SDK を classic script として読み、その後に自分のスクリプトを読みます。

```html
<script src="/app-sdk/v1.js"></script>
<script src="app.js"></script>
```

| 呼び出し | 必要な権限 | 戻り値（Promise） |
|---|---|---|
| `DoneqApp.info()` | 不要 | `{ id, name, version, permissions, locale, theme }` |
| `DoneqApp.tasks.list({ status? })` | `tasks:read` | タスクの配列（`status` は文字列1つか文字列の配列） |
| `DoneqApp.tasks.create({ title, description?, due_date?, priority? })` | `tasks:write` | 作成したタスク |
| `DoneqApp.tasks.update({ id, title?, status?, due_date?, priority? })` | `tasks:write` | 更新後のタスク |
| `DoneqApp.storage.get(key)` | `storage` | 保存した値（無ければ `null`） |
| `DoneqApp.storage.set(key, value)` | `storage` | なし（`undefined`） |
| `DoneqApp.storage.remove(key)` | `storage` | なし（`undefined`） |
| `DoneqApp.ui.toast(message)` | 不要 | なし（`undefined`）。Doneq 側にトーストを出す（先頭にアプリ名が付く。200文字で切られる・プレーンテキスト。1秒に1回まで） |
| `DoneqApp.call(method, params)` | メソッドによる | ブリッジの生の result（下の §4 の表） |
| `DoneqApp.isEmbedded` | - | Doneq の中で開かれていれば `true`（プロパティ） |

- タスクの項目: `id, title, status, priority, due_date, start_date, created_at, completed_at`（`dueDate` などの別名は無い）。
- `status` の値: `todo` / `queued` / `in_progress` / `awaiting_approval` / `done` / `failed`。
- `priority` の値: `high` / `medium` / `low` / `null`（未設定）。`due_date` は `YYYY-MM-DD` 文字列か `null`。
- `tasks.create` のタスクは常に `todo` で作られ、`source: 'app:<id>'` が付く。
- `tasks.update` で変更できるのは、現在の `status` が `todo` か `done` のタスクだけ。AI 実行中・承認待ち・失敗（`queued` / `in_progress` / `awaiting_approval` / `failed`）のタスクは、`title` などを含めて変更できない（`invalid_params`）。変更後の `status` も `todo` か `done` だけ。
- 回数制限: 1つのアプリが同時に処理中にできる依頼は 8 件まで（超えた分は `failed`）。`ui.toast` は 1 秒に 1 回まで（超えた分は表示されない）。
- ストレージのキーは `^[\w.-]{1,64}$`（英数字・`_`・`.`・`-` で1〜64文字）。
- 失敗すると Promise は Error で拒否され、`err.code` に `permission_denied` / `unknown_method` / `invalid_params` / `failed` / `timeout` / `not_embedded` のいずれかが入る。応答が 15 秒来なければ `timeout`、Doneq の外で直接開かれていると `not_embedded`（すぐに拒否される）。
- ストレージはアプリごとに分かれ、合計 256KB まで。超えると保存は失敗する。「更新」で置き換えても残り、アプリを削除したときだけ消える。

```js
try {
  const tasks = await DoneqApp.tasks.list({ status: 'todo' });
  await DoneqApp.ui.toast('未着手は ' + tasks.length + ' 件です');
} catch (err) {
  console.error(err.code, err.message);
}
```

## 4. メッセージ形式と権限

SDK は内部で親画面（Doneq）と postMessage でやり取りします。通常は SDK を使えばよく、この形式を直接扱う必要はありません。

- アプリ → Doneq: `{ doneq: 1, kind: 'request', id: <文字列>, method, params }`
- Doneq → アプリ: `{ doneq: 1, kind: 'response', id, ok: true, result }` または `{ doneq: 1, kind: 'response', id, ok: false, error: { code, message } }`
- Doneq は、表示中のアプリの iframe 以外から届いたメッセージや形式の違うメッセージを黙って捨てる。

| method | 権限 | params → result |
|---|---|---|
| `app.info` | 不要 | → `{ id, name, version, permissions, locale, theme }` |
| `ui.toast` | 不要 | `{ message }` → `{ ok: true }` |
| `tasks.list` | `tasks:read` | `{ status? }`（文字列または文字列の配列）→ `{ tasks: [...] }` |
| `tasks.create` | `tasks:write` | `{ title, description?, due_date?, priority? }` → `{ task }` |
| `tasks.update` | `tasks:write` | `{ id, title?, status?, due_date?, priority? }` → `{ task }` |
| `storage.get` / `storage.set` / `storage.remove` | `storage` | `{ key, value? }` → `{ value }` / `{ ok }` |

糖衣関数（`tasks.list` など）は result を開いて中身（配列・タスク・値）だけを返します。`DoneqApp.call` は result をそのまま返します。

| 権限 | 利用者への意味 | 付ける目安 |
|---|---|---|
| `tasks:read` | タスクの一覧を読む | 一覧・集計・表示をするとき |
| `tasks:write` | タスクを追加・変更する | 追加・状態変更・期日変更をするとき |
| `storage` | このアプリ専用の保存領域を使う | 設定やメモを次回まで残すとき |

権限は最小限にしてください。追加時に利用者へ一覧で示され、多いほど警戒されます。マニフェストに無い権限のメソッドは `permission_denied` になります。

## 5. 隔離と制約

アプリは `sandbox="allow-scripts allow-forms"` の iframe（`allow-same-origin` なし）で表示され、配信時の CSP でも sandbox と `connect-src 'none'` がかかります。アプリは「不透明オリジン」になり、Doneq の認証トークン・Cookie・API には触れません。直接 URL を開いても同じ制約がかかります。

| 使えないもの | 理由 | 代わりに |
|---|---|---|
| `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` | `connect-src 'none'` で全通信が禁止 | Doneq のデータは SDK で。外部 API は使えない |
| `localStorage` / `sessionStorage` / `indexedDB` / Cookie | 不透明オリジンのため、触ると例外になる | `DoneqApp.storage` |
| `<script type="module">` / `import` | モジュールは CORS が要り、不透明オリジンからは読めない | classic script を複数 `<script src>` で並べる |
| 外部 CDN（ライブラリ・Web フォント） | CSP で自分のフォルダ以外は読めない | 必要なファイルをフォルダに同梱する |
| `window.open` / `target="_blank"` / `alert` / `confirm` | sandbox でポップアップ・モーダルが許可されていない | 画面内に表示する。通知は `DoneqApp.ui.toast` |
| フォームの送信先（`action`） | `form-action 'none'` | `submit` イベントで `preventDefault()` して JS で処理 |
| 別の HTML への遷移・外部リンク（`<a href="page2.html">`・`location.href = ...`） | ブラウザ版では Doneq が「別のページへ移動しようとした」と判断してアプリを停止する。デスクトップ版は iframe の外部遷移そのものをブロックする | 1つの HTML の中で DOM を出し分ける（1ページ構成） |

インラインの `<script>` と `<style>` は使えますが、保守のためファイルに分けることを推奨します。

アプリは Doneq の URL・ポート・認証トークンを知る必要がなく、扱うこともできません（SDK の呼び出しは親画面の Doneq が権限を確認して代行します）。「接続設定」の入力欄は作らないでください。また、Doneq の外で開かれたときや SDK が失敗したときにモックデータで代用しないでください（実データと誤認させるため）。`isEmbedded` が偽なら案内を、失敗時はエラーを表示します。

### 隔離の限界（利用者・作者とも知っておくこと）

sandbox と CSP により、アプリは Doneq のトークン・API・`fetch`・Cookie・localStorage には触れません。ただしブラウザ版では、自己遷移や WebRTC などを使ってアプリが読んだデータを外部へ送る経路を完全には塞げません（自己遷移は検知してアプリを停止しますが、送信そのものを事前に防ぐことはできません）。デスクトップ版は iframe の外部遷移を止めます。そのため権限は「作者を信頼できる場合だけ許可する」ものであり、追加時の確認画面にもその注意が表示されます。作者は README に権限の使い道を書き、データを外へ送らないことを明記してください。

## 6. 手元で作って試す

1. 任意の場所にフォルダを作り、`doneq-app.json` と `index.html` を置く（最小構成は §2 の例と §3 の script 2行）。
2. Doneq を開き、サイドナビの「アプリを追加」→「URL から追加」を押す。
3. 「ローカルフォルダから（開発者向け）」に切り替え、フォルダの絶対パス（例: `/Users/you/my-app`）を入れる。
4. 確認画面で名前・バージョン・権限を確認して「追加」。
5. サイドナビに出たアプリ名をクリックして開く。

ファイルは追加時に Doneq 側へコピーされるため、元のフォルダを直しても自動では反映されません。直したら「アプリを追加」で該当アプリの詳細を開き、「更新を確認」で取り込み直してください（アプリ上部バーの再読み込みは、取り込み済みのファイルを読み直すだけです）。

動作の確認にはブラウザの開発者ツールを使い、コンソールの対象をアプリの iframe に切り替えて見ます。CSP 違反（通信・外部読み込み）もコンソールに出ます。

## 7. GitHub で公開する

1. GitHub に公開リポジトリを作る（プライベートリポジトリからは取得できない）。
2. リポジトリのルート、または任意のサブフォルダに `doneq-app.json` を置く。
3. `LICENSE`（MIT など）と `README.md`（何をするか・使う権限とその理由）を置く。
4. 利用者に URL を伝える。対応する形式は次のとおり。

| URL | 取得するもの |
|---|---|
| `https://github.com/<owner>/<repo>` | 既定ブランチのルート |
| `https://github.com/<owner>/<repo>/tree/<ref>` | 指定したブランチまたはタグのルート |
| `https://github.com/<owner>/<repo>/tree/<ref>/<subpath>` | 指定した ref のサブフォルダ（1リポジトリに複数アプリを置ける） |

- 安定版を配るならタグ（例: `v1.2.0`）の URL を伝えると、利用者の手元が勝手に変わらない。最新を追ってほしいならブランチの URL を伝える。
- ref はスラッシュを含まない名前（`main`、`v1.2.0` など）を推奨。
- 変更を出すときは `version` を上げる。利用者が「更新を確認」すると、確認画面が「更新」として表示され、新しい版を確認してから置き換えられる。
- 更新で権限を増やすと、確認画面に「今より多くの権限を求めています」と警告が出る。リポジトリの移動・改名で取得元 URL が変わった場合も「取得元が違います」と警告が出るので、README などで利用者に知らせる。

## 8. 利用者が追加する手順

1. 「アプリを追加」→「URL から追加」に GitHub の URL を貼る。
2. 確認画面で名前・作者・バージョン・取得元・コミット・権限を確認する。外部アプリは「Doneq 公式が確認したアプリではありません」と表示される。権限は作者を信頼できる場合だけ許可する（§5「隔離の限界」）。
3. 「追加」を押す。アプリは一覧に「コミュニティ」バッジ付きで並び、サイドナビから開ける。
4. 更新: 詳細を開いて「更新を確認」。同じ取得元から取り直し、確認のうえ置き換える（ストレージの保存データは残る）。追加済みと同じ id のアプリを別の取得元から追加しようとしたとき・権限が増えるときは、確認画面の上部に警告が出る。心当たりが無ければ追加しない（同じ id の別アプリで置き換わるおそれがある）。
   - バックアップから復元しても、アプリのファイルは戻らない（登録とストレージだけが戻る）。開けなくなったアプリは取得元から追加し直す。
5. 削除: 詳細の「削除」。ファイル・登録・そのアプリのストレージがすべて消える。

## 9. サンプル: task-glance

サンプル task-glance（公開キットでは `template/task-glance/`、Doneq 本体では `examples/apps/task-glance/`）は3つの権限をすべて使うサンプルです。開発者ガイドページの「サンプルを追加して試す」からも追加できます。

| ファイル | 見どころ |
|---|---|
| `doneq-app.json` | 3権限を宣言した最小のマニフェスト |
| `index.html` | SDK と `app.js` を classic script で読む。`isEmbedded` が偽のときの案内とエラー表示欄 |
| `app.js` | `tasks.list` で状態ごとの件数と期限切れを集計、`tasks.create` で1件追加、`storage.get/set` でメモを保存・復元、`ui.toast`。エラーは `err.code` 付きで画面に出す |
| `style.css` | `info().theme` で切り替える控えめな配色 |

まずこのフォルダを複製し、`id` と `name` を変えて改造するのが早道です。

## 10. AI に作ってもらう

Doneq の画面（アプリを追加 → 自分でアプリを作る）の「AI に作ってもらう」欄に、スキルの導入コマンド・スキル保存ボタン・コピーできる依頼文があります。

まず AI に doneq-app スキルを入れます（どれか1つ）。

- Claude Code: 次の2つを実行する。
  ```
  /plugin marketplace add taisei17/doneq-app-kit
  /plugin install doneq-app@doneq
  ```
- その他の AI ツール（Codex / Cursor など）: `npx skills add taisei17/doneq-app-kit`
- 手動: SKILL.md（公開キットの `skills/doneq-app/SKILL.md`、または画面の「SKILL.md を保存」で保存したもの）を、作業フォルダの `.claude/skills/doneq-app/SKILL.md` に置く。Claude Code はこの場所のスキルを自動で参照する。スキルを読み込めない AI には、依頼時に SKILL.md の内容を一緒に渡す。

次の依頼文を渡します。

```
Doneq の外部アプリを作ってください。doneq-app スキル（SKILL.md）に従ってください。
作りたいもの: 期日が今週のタスクを曜日ごとに並べて表示し、チェックで完了にできる画面
条件: 権限は必要最小限にする。fetch・localStorage・type="module"・外部 CDN は使わない。
成果物: doneq-app.json・index.html・app.js・style.css・README.md を1つのフォルダにまとめる。
最後に SKILL.md のチェックリストを1項目ずつ確認した結果を報告してください。
```

## 11. 公開前チェックリスト

- [ ] `doneq-app.json` がフォルダの直下にあり、JSON として正しい
- [ ] `manifest_version` が `1`、`id` が形式どおりで公式アプリの id と重ならない
- [ ] `version` が `x.y.z` 形式で、前回公開時より上がっている
- [ ] `name` 40文字以内・`description` 200文字以内
- [ ] `entry` のファイルが実在し、`.html` で、`..` を含まない
- [ ] `permissions` が使う機能に対して過不足ない（使わない権限を付けていない）
- [ ] SDK を `<script src="/app-sdk/v1.js"></script>` で、自分のスクリプトより前に読んでいる
- [ ] `type="module"`・`import` を使っていない
- [ ] `fetch`・XHR・WebSocket・localStorage・sessionStorage・Cookie を使っていない
- [ ] 外部 CDN・外部フォント・外部画像を参照していない
- [ ] 1ページ構成で、別 HTML へのリンク・`location` の変更・`window.open`・`target="_blank"`・`alert`・`confirm` を使っていない
- [ ] SDK の失敗（`err.code`）を画面内に表示している。`isEmbedded` が偽のときの案内があり、モックデータで代用していない
- [ ] 使う拡張子が取り込み対象内で、300 ファイル・5MB 以下、symlink が無い
- [ ] ローカルフォルダから追加し、表示・操作・再読み込み後の状態を確認した
- [ ] `README.md`（何をするか・権限の理由）と `LICENSE` がある

## 12. トラブル対応

| 症状 | 主な原因 | 対処 |
|---|---|---|
| 画面が真っ白 | `entry` の誤り、スクリプトのエラー、`type="module"` | `entry` を確認。開発者ツールのコンソールを見る。classic script に直す |
| 「Doneq の中で開いてください」のまま | アプリの URL を直接開いている／SDK が読めていない | サイドナビから開く。`/app-sdk/v1.js` の読み込みを確認 |
| `fetch` が失敗する | `connect-src 'none'` で通信は禁止 | 外部通信はできない。Doneq のデータは SDK で取得する |
| localStorage で例外（SecurityError） | 不透明オリジンのため使えない | `DoneqApp.storage` に置き換える |
| `permission_denied` | マニフェストに権限が無い | `permissions` に追加し、`version` を上げて「更新を確認」 |
| `timeout` | Doneq 側が 15 秒応答しない／アプリ画面が閉じられた | 再試行する。大量の呼び出しを並列に投げていないか確認 |
| `failed`（同時に処理できる依頼は 8 件まで、の旨） | 応答待ちの依頼を 8 件より多く同時に投げた | `await` で順に呼ぶか、同時に投げる数を減らす |
| `ui.toast` を呼んでも表示されないことがある | 1 秒に 1 回までの制限（超えた分は表示されない） | 通知はまとめて1回にする。状態の表示は画面内で行う |
| 直したのに変わらない | ファイルは追加時にコピーされる | 詳細の「更新を確認」で取り込み直す |
| アプリが停止し「別のページへ移動しようとした」旨が出る | 別 HTML へのリンク・`location.href` の変更・外部リンク（ブラウザ版） | 1つの HTML 内で DOM を出し分ける。外部サイトへの案内はリンクにせず URL を文字で表示する |
| デスクトップ版でリンクを押しても何も起きない | iframe の外部遷移はブロックされる | 同上 |
| `tasks.update` がエラーになる（`invalid_params`） | `status` に `todo` / `done` 以外を指定した、または対象タスクが AI 実行中・承認待ち・失敗（現在の status が `todo` / `done` 以外） | `status` は `todo` か `done` だけを指定する。`tasks.list` の `status` で `todo` / `done` のタスクだけを更新対象にする |
| `storage.set` がエラーになる | キーが `^[\w.-]{1,64}$` に合わない、または合計 256KB 超過 | キーを英数字・`_`・`.`・`-` の64文字以内にする。不要なキーを `remove` する |
| 追加時に entry のファイルが見つからない旨のエラー | `entry` の綴り違い・ファイルが除外対象（拡張子・ドットファイル） | `entry` とファイル名を一致させる |
| 一部のファイルが読めない（404） | 対象外の拡張子・ドットファイル・`node_modules` は除外される | 拡張子を対象内に変える（例: `.mjs` → `.js`）。ファイルを外に出す |
| 追加時に「マニフェストが見つからない」旨のエラー | `doneq-app.json` が指定フォルダ直下に無い | ファイル名と置き場所、URL のサブフォルダ指定を確認 |
| 追加時にマニフェストの項目に関するエラー | 必須キー欠落・`id`/`version` の形式違反・未知の権限・`entry` の `..` | §2 の表どおりに直す |
| 追加時に公式アプリと id が重なる旨のエラー | `gcal` など公式アプリの id を使っている | 別の `id` にする |
| 追加時にファイル数・サイズ・symlink に関するエラー | 300 ファイル・5MB 超過、symlink を含む | 不要なファイルを消す。symlink を実ファイルに置き換える |
| 追加時に URL に関するエラー | `https://github.com/` 以外の URL、プライベートリポジトリ、存在しない ref | 公開リポジトリの URL を §7 の形式で指定する |
| ローカルフォルダを指定するとエラー | 相対パス、存在しないフォルダ | 絶対パスで、実在するフォルダを指定する |

## 13. 前提の注意

- 外部アプリそのものは誰でも GitHub で公開できますが、作ったアプリを動かすには Doneq 本体が必要です。
- 対応 SDK は v1（`/app-sdk/v1.js`）です。手元の Doneq より新しいスキルを使うと、手元の Doneq が未対応の機能を使うおそれがあります。迷ったら Doneq の画面の「SKILL.md を保存」で、手元と同じ版のスキルを使ってください。

## 変更履歴

- 2026-10-08: 初版（外部アプリの仕組みと同時に作成）
- 2026-10-08: 1ページ構成（遷移でアプリ停止・デスクトップ版は外部遷移をブロック）、隔離の限界、`ui.toast` のアプリ名表示、`tasks.update` の status 制限・`tasks.create` は常に todo、ストレージのキー形式と更新時の保持、symlink・深さの判定範囲、`/app-frame/<id>/` が entry を返すことを追記
- 2026-10-08: 置き換え警告（取得元の違い・増える権限）、回数制限のトラブル対応、`tasks.update` の対象タスクの status 制限のトラブル対応、バックアップ復元でファイルが戻らない点を追記
- 2026-10-13: 公開キット（taisei17/doneq-app-kit）での配布を開始。スキルの入手方法・依頼文例・前提の注意を、本体でもキットでも通じる表現に変更
