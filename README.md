# TeamSync

TeamSyncは、ゲームチーム向けのログイン不要の日程調整Webサイトです。調整さんの使いやすさを参考に、URLを共有するだけで候補日時ごとの○・△・×を集められます。

公開サイト: <https://tanaka1125-create.github.io/teamsync/>

## 主な機能

### 参加者向け

- イベントURLだけで出欠表を閲覧
- 候補日時ごとの○・△・×とコメント入力
- 候補日が縦、参加者が横の一覧表
- ○を1点、△を0.5点としたおすすめ候補の強調
- 確定した開催日の表示
- 回答したブラウザから回答を変更
- 回答締切後の入力停止
- スマートフォンでの横スクロール表示

### 幹事向け

- イベント名、メモ、最大30件の候補日時を登録
- 回答締切と回答保護の設定
- 候補日時の追加・編集・削除・並べ替え
- 参加者の並べ替えと削除
- 開催日の確定・解除
- CSVダウンロード
- イベント全体の削除
- 参加者用URLと秘密の幹事用URLを分離

イベント作成後に発行される幹事用URLは、編集権限そのものです。参加者には通常のイベントURLだけを共有してください。

## 構成

```text
teamsync/
├─ index.html
├─ event.html
├─ response.html
├─ manage.html
├─ css/style.css
├─ js/
│  ├─ calendar.js
│  ├─ config.js
│  ├─ create-event.js
│  ├─ event.js
│  ├─ manage-event.js
│  └─ supabase.js
├─ supabase/
│  ├─ schema.sql
│  └─ phase8.sql
└─ tests/
```

## Supabase設定

新規プロジェクトでは、Supabase SQL Editorで次の順に実行します。

1. `supabase/schema.sql`
2. `supabase/phase8.sql`

既存のPhase 7環境では、`supabase/phase8.sql`だけを実行します。既存イベントは従来の公開編集モデルを維持し、新しく作るイベントから幹事トークンと回答編集トークンが有効になります。

`js/config.js`にはブラウザ公開用のProject URLとpublishable keyだけを設定します。secret key、`service_role` key、データベースパスワードは保存しないでください。

テーブルへの匿名直接アクセスは取り消し、公開RPCだけを許可しています。幹事操作は48桁のランダムトークン、保護された回答変更は参加者ごとのランダムトークンをSHA-256ハッシュで照合します。

## ローカル確認

ビルドや依存パッケージは不要です。

```powershell
python -m http.server 8000
```

<http://localhost:8000/> を開きます。

Node.jsがある場合、テストは次のように実行できます。

```powershell
Get-ChildItem tests/*.test.cjs | ForEach-Object { node $_.FullName }
```

## GitHub Pages

Settings → Pages → Build and deployment で、Sourceを「Deploy from a branch」、ブランチを `main`、フォルダーを `/(root)` に設定します。
