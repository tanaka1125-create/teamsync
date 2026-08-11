# TeamSync

TeamSyncは、ゲームチーム向けのシンプルな日程調整Webサイトです。

GitHub Pagesでそのまま公開できる静的サイトです。ログインやビルド作業は不要です。

公開サイト: <https://tanaka1125-create.github.io/teamsync/>

## 実装済み

- イベント名の必須入力
- 任意の説明入力
- 月送りに対応した日本語カレンダー
- 今日以降の候補日を最大10件選択
- 候補日ごとの開始・終了時刻を30分刻みで設定
- 候補日時の並べ替え表示・個別削除・時刻検証
- 選択状態の表示とキーボードの矢印キー操作
- Supabase REST APIによるイベント保存処理
- 1回の処理でイベントと候補日時を保存するデータベース関数
- Row Level Securityと入力値検証を含むSQL
- イベント作成ボタンと基本的な入力検証
- イベントページのプレースホルダー
- PC・スマートフォン対応のレスポンシブデザイン

Supabaseへの接続とイベント保存まで設定済みです。共有URL、出欠回答、集計は後続フェーズで実装します。

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
│  ├─ event.js
│  └─ supabase.js
├─ supabase/
│  └─ schema.sql
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

## Supabaseを接続する

1. Supabaseでプロジェクトを作成します。
2. **SQL Editor** で `supabase/schema.sql` の内容をすべて実行します。
3. **Project Settings → API** からProject URLとpublishable key（旧プロジェクトではanon key）を確認します。
4. `js/config.js` の `supabaseUrl` と `supabasePublicKey` に設定します。
5. GitHubへ反映し、イベント作成画面の保存先表示が緑色になることを確認します。

ブラウザで使うpublishable/anon keyだけを設定してください。`service_role` keyやデータベースパスワードは、HTML・JavaScript・GitHubリポジトリへ保存しないでください。

イベントと1〜10件の候補日時は、`create_event_with_dates` 関数によって1回のトランザクションで保存されます。途中でエラーになった場合は全体が取り消されるため、イベントだけが残ることはありません。
