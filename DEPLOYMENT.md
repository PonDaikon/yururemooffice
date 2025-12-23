# ゆるリモオフィス - Render.comデプロイ手順書

本ドキュメントでは、ゆるリモオフィス（Spatial Chat App）を無料でWebSocketをサポートするRender.comにデプロイする手順を説明します。

## 前提条件

デプロイを開始する前に、以下のアカウントとツールを準備してください。

| 項目 | 説明 | 取得方法 |
|------|------|----------|
| GitHubアカウント | ソースコードを管理するために必要 | [github.com](https://github.com) で無料登録 |
| Renderアカウント | デプロイ先のプラットフォーム | [render.com](https://render.com) で無料登録（GitHubアカウントでログイン可能） |
| Gitクライアント | ローカルでコードを管理 | [git-scm.com](https://git-scm.com) からダウンロード |

## ステップ1: プロジェクトファイルのダウンロード

Manusの管理画面から、プロジェクトファイル一式をダウンロードします。

1.  管理画面の「Code」パネルを開く
2.  右上の「Download All Files」ボタンをクリック
3.  ZIPファイルを任意の場所に展開

## ステップ2: GitHubリポジトリの作成

プロジェクトをGitHubにアップロードします。

### 2-1. GitHubで新しいリポジトリを作成

1.  GitHubにログイン後、右上の「+」→「New repository」をクリック
2.  以下の設定で作成：
    *   **Repository name**: `yurure-office`（任意の名前でOK）
    *   **Visibility**: `Private`（無料プランでもプライベートリポジトリ作成可能）
    *   **Initialize this repository with**: チェックを入れない
3.  「Create repository」をクリック

### 2-2. ローカルでGitリポジトリを初期化

ターミナル（WindowsならGit Bash、MacならTerminal）を開き、展開したプロジェクトフォルダに移動します。

```bash
cd /path/to/your/spatial_chat_app
```

以下のコマンドを順番に実行します：

```bash
# Gitリポジトリを初期化
git init

# すべてのファイルをステージング
git add .

# 最初のコミット
git commit -m "Initial commit"

# GitHubのリポジトリをリモートとして追加（URLは自分のリポジトリのものに置き換える）
git remote add origin https://github.com/YOUR_USERNAME/yurure-office.git

# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

**注意**: `YOUR_USERNAME`は自分のGitHubユーザー名に置き換えてください。

## ステップ3: Render.comでのデプロイ設定

### 3-1. Renderにログイン

[render.com](https://render.com)にアクセスし、GitHubアカウントでログインします。

### 3-2. 新しいWebサービスを作成

1.  ダッシュボードで「New +」→「Web Service」をクリック
2.  「Connect a repository」で、先ほど作成したGitHubリポジトリ（`yurure-office`）を選択
3.  以下の設定を入力：

| 項目 | 設定値 |
|------|--------|
| **Name** | `yurure-office`（任意） |
| **Region** | `Singapore`（日本に最も近いリージョン） |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `pnpm install && pnpm run build` |
| **Start Command** | `NODE_ENV=production node dist/server/_core/index.js` |
| **Plan** | `Free` |

### 3-3. 環境変数の設定

「Advanced」セクションを展開し、以下の環境変数を追加します：

| Key | Value | 説明 |
|-----|-------|------|
| `NODE_VERSION` | `22.13.0` | Node.jsのバージョン |
| `PORT` | `10000` | サーバーのポート番号 |
| `JWT_SECRET` | ランダムな文字列（例: `your-super-secret-jwt-key-12345`） | JWT認証用の秘密鍵 |

**JWT_SECRETの生成方法**:
ターミナルで以下のコマンドを実行すると、ランダムな文字列が生成されます：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3-4. PostgreSQLデータベースの作成

1.  ダッシュボードで「New +」→「PostgreSQL」をクリック
2.  以下の設定を入力：

| 項目 | 設定値 |
|------|--------|
| **Name** | `yurure-office-db` |
| **Database** | `yurure_office` |
| **User** | `yurure_office_user` |
| **Region** | `Singapore`（Webサービスと同じリージョン） |
| **Plan** | `Free` |

3.  「Create Database」をクリック

### 3-5. データベースをWebサービスに接続

1.  作成したWebサービス（`yurure-office`）の設定画面に戻る
2.  「Environment」タブを開く
3.  「Add Environment Variable」をクリックし、以下を追加：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | データベースの「Internal Database URL」をコピーして貼り付け（Render内部接続用） |
| `OAUTH_SERVER_URL` | `https://oauth.example.com`（ダミー値、OAuth機能は現在未使用） |
| `VITE_OAUTH_PORTAL_URL` | `https://oauth.example.com/login`（ダミー値） |
| `VITE_APP_ID` | `spatial-chat-app`（アプリ識別子） |
| `OWNER_OPEN_ID` | `owner`（管理者ID） |
| `OWNER_NAME` | `Admin`（管理者名） |

**Internal Database URLの取得方法**:
1.  データベース（`yurure-office-db`）のダッシュボードを開く
2.  「Connections」セクションの「**Internal Database URL**」をコピー（Render内部接続用）

### 3-6. デプロイ開始

「Create Web Service」ボタンをクリックすると、自動的にビルドとデプロイが開始されます。

## ステップ4: デプロイ後の確認

デプロイが完了すると、Renderから自動的にURLが発行されます（例: `https://yurure-office.onrender.com`）。

### 4-1. 動作確認

1.  発行されたURLにアクセス
2.  名前を入力して入室
3.  別のブラウザ/タブで同じURLにアクセスし、2人目として入室
4.  以下の機能が正常に動作するか確認：
    *   ビデオ通話
    *   音声通話
    *   チャット
    *   画面共有
    *   絵文字リアクション

### 4-2. トラブルシューティング

| 問題 | 原因 | 解決方法 |
|------|------|----------|
| ビルドエラー | 依存関係のインストール失敗 | Renderのログを確認し、`pnpm install`が成功しているか確認 |
| 起動エラー | 環境変数の設定ミス | `DATABASE_URL`と`JWT_SECRET`が正しく設定されているか確認 |
| WebSocket接続エラー | ファイアウォールやプロキシの問題 | Renderは標準でWebSocketをサポートしているため、通常は発生しない |

## ステップ5: カスタムドメインの設定（オプション）

独自ドメインを使用したい場合は、以下の手順で設定できます。

1.  Webサービスの「Settings」→「Custom Domain」を開く
2.  「Add Custom Domain」をクリック
3.  自分のドメイン（例: `yururemooffice.com`）を入力
4.  表示されるDNS設定（CNAMEレコード）を、ドメインレジストラ（お名前.com、ムームードメインなど）で設定
5.  DNS設定が反映されると、自動的にSSL証明書が発行される

## ステップ6: 継続的デプロイ（自動更新）

GitHubリポジトリにコードをプッシュすると、Renderが自動的に検知して再デプロイします。

```bash
# コードを修正後
git add .
git commit -m "機能追加: ○○機能を実装"
git push origin main
```

プッシュ後、Renderのダッシュボードで自動的にビルドが開始されます。

## 注意事項

Renderの無料プランには以下の制限があります：

| 項目 | 制限内容 |
|------|----------|
| **スリープ** | 15分間アクセスがないとサービスがスリープ状態になり、次回アクセス時に起動に30秒程度かかる |
| **データベース** | 90日間アクセスがないと削除される |
| **月間稼働時間** | 750時間（約31日）まで無料 |

常時稼働させたい場合や、スリープを避けたい場合は、有料プラン（月$7〜）へのアップグレードを検討してください。

## まとめ

以上の手順で、ゆるリモオフィスをRender.comに無料でデプロイできます。WebSocketが完全にサポートされているため、リアルタイム通信機能が正常に動作します。

---

**作成者**: Manus AI  
**最終更新**: 2025年12月22日
