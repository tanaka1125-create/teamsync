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
- 選択中の全候補日時へ開始・終了時刻を一括設定し、必要な日だけ個別に再調整
- 候補日時の並べ替え表示・個別削除・時刻検証
- 選択状態の表示とキーボードの矢印キー操作
- Supabase REST APIによるイベント保存処理
- 1回の処理でイベントと候補日時を保存するデータベース関数
- 保存後に `event.html?id=<イベントID>` の専用URLを発行
- イベント専用URLに回答一覧と「出欠を回答」ボタンを表示
- `response.html?id=<イベントID>` の回答画面で出欠を入力
- 回答保存後にイベント専用URLの回答一覧へ自動で戻る
- 専用URLからイベント名・説明・候補日時を読み込み表示
- イベント専用URLのコピーボタン
- 名前と候補ごとの○・△・×による出欠回答
- 候補ごとの任意コメント入力
- 一部候補だけの回答と、同じ名前による既存回答の更新
- 回答者・回答データを1回の処理で保存するデータベース関数
- 候補日時ごとの○・△・×・未回答人数の集計
- 参加者ごとの回答・コメント一覧表
- 回答保存後の結果自動更新と手動更新ボタン
- Row Level Securityと入力値検証を含むSQL
- イベント作成ボタンと基本的な入力検証
- PC・スマートフォン対応のレスポンシブデザイン

Supabaseへの接続、イベント保存、専用URLでのイベント表示、出欠回答、回答一覧・集計まで設定済みです。最多候補の強調は後続フェーズで実装します。

## ファイル構成

```text
teamsync/
├─ index.html
├─ event.html
├─ response.html
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

イベント専用ページは `get_event_details` 関数を使い、URLのイベントIDに一致するイベント名・説明・候補日時だけを読み込みます。ブラウザからテーブルを直接読み書きする権限は付与していません。

出欠回答は `submit_event_responses` 関数を使い、名前と選択した候補の○・△・×、任意コメントを保存します。同じイベント内で同じ名前が再回答した場合は、今回選択した候補の回答だけを更新します。
