# doneq-app-kit

Doneq の**外部アプリ（コミュニティアプリ）**を AI と一緒に作るための制作キットです。

- `skills/doneq-app/SKILL.md` … AI 向けスキル（外部アプリの作り方・制約・公開手順）
- `template/task-glance/` … そのまま動くサンプルアプリ（コピーして作り始める雛形）
- `docs/external-app-development.md` … 人間向けの開発者ガイド

このリポジトリは Claude Code のプラグインマーケットプレイス兼プラグインになっています。

- **作ったアプリを動かすには Doneq 本体が必要です。** このキットだけではアプリは動きません。
- **対応 SDK は v1**（`/app-sdk/v1.js`）です。手元の Doneq がこの版を配信していない場合は、Doneq の「アプリ制作ガイド」画面の「SKILL.md を保存」で手元と同じ版のスキルを使ってください。
- **ライセンス**: MIT（[LICENSE](LICENSE) 参照）。`template/task-glance/LICENSE` はサンプルアプリ自体のライセンスです。
- このリポジトリは Doneq 本体から自動生成した配布用コピーです（元のコミットは `SOURCE_COMMIT` に記録）。直接の PR ではなく Issue で報告してください。

## 導入方法（3通り）

### 1) Claude Code（プラグインとして入れる）

Claude Code 上で次の2つを実行します。

```
/plugin marketplace add taisei17/doneq-app-kit
/plugin install doneq-app@doneq
```

- SSH キーが無く clone に失敗する場合は、`/plugin marketplace add https://github.com/taisei17/doneq-app-kit.git` のように HTTPS の URL で追加してください。
- 更新を自動で受け取るには、`/plugin` の Marketplaces で `doneq` を選び Enable auto-update にしてください。

### 2) その他の AI ツール（Codex / Cursor など）

[skills CLI](https://www.npmjs.com/package/skills) で入れます。

```
npx skills add taisei17/doneq-app-kit
```

### 3) 手動で置く

`skills/doneq-app/SKILL.md` を、作業フォルダの `.claude/skills/doneq-app/SKILL.md` に置きます。
Claude Code はこの場所のスキルを自動で参照します。他の AI ツールでは、依頼時に SKILL.md の内容を一緒に渡してください。

## アプリを作って Doneq に追加する流れ

1. **テンプレートから作る**: `template/task-glance/` を自分の作業フォルダにコピーし、AI に「doneq-app スキルを使って、○○するアプリに作り替えて」と依頼します。
   `doneq-app.json` の `id` / `name` / `author` / `permissions` は自分のアプリに合わせて書き換えてください。
2. **手元で試す**: Doneq の「アプリを追加」→「URL から追加」→「ローカルフォルダから（開発者向け）」に、作業フォルダの絶対パスを入れて動作を確認します。
3. **公開リポジトリに置く**: 自分の GitHub **公開**リポジトリに push します（プライベートリポジトリからは追加できません）。
4. **Doneq に追加する**: Doneq の「アプリを追加」に、リポジトリの URL（例: `https://github.com/<you>/<repo>`）を貼り付けます。
   サブフォルダに置いた場合は `https://github.com/<you>/<repo>/tree/<ブランチ>/<フォルダ>` の形式で指定できます。

詳しい仕様（SDK・権限・制約・公開前チェックリスト）は [docs/external-app-development.md](docs/external-app-development.md) を参照してください。
