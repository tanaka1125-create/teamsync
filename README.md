# TeamSync

TeamSyncは、ゲームチーム向けのシンプルな日程調整Webサイトです。

Phase 1では、GitHub Pagesでそのまま公開できる静的な基本画面を用意しています。ログインやビルド作業は不要です。

## Phase 1で実装済み

- イベント名の必須入力
- 任意の説明入力
- 候補日時エリアのプレースホルダー
- イベント作成ボタンと基本的な入力検証
- イベントページのプレースホルダー
- PC・スマートフォン対応のレスポンシブデザイン

カレンダー、イベント保存、Supabase接続、共有URL、出欠回答、集計はまだ実装していません。

## ファイル構成

```text
teamsync/
├─ index.html
├─ event.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ calendar.js
│  ├─ config.js
│  ├─ create-event.js
│  └─ event.js
└─ README.md
```

## ローカルで確認する

依存パッケージはありません。`index.html`をブラウザで直接開くか、任意の静的Webサーバーでこのフォルダを公開してください。

Pythonが利用できる場合の例：

```powershell
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000/` を開きます。

## GitHub Pagesで公開する

1. このフォルダをGitHubリポジトリへプッシュします。
2. リポジトリの **Settings → Pages** を開きます。
3. **Build and deployment** のSourceを **Deploy from a branch** にします。
4. 公開ブランチと `/(root)` を選択して保存します。

数分後、`https://<GitHubユーザー名>.github.io/<リポジトリ名>/` で表示できます。

## Supabaseについて

Phase 1ではSupabaseに接続していません。`js/config.js`にもURLやキーは設定していません。

後続フェーズで接続する際は、ブラウザ公開を前提としたSupabaseのanon keyとRow Level Securityを使用します。service role keyなどの秘密情報はリポジトリへ保存しないでください。
