# Project TODO

## 本番環境対応
- [x] Socket.IOクライアントの接続設定を本番環境対応に修正（動的URL生成）
- [x] サーバー側のCORS設定を本番環境のドメインに対応させる

## WebSocket接続エラー修正
- [x] 本番環境でのSocket.IO WebSocket接続エラーを解決
- [x] server/_core/vite.tsにSocket.IO設定を追加

## Render.comデプロイ準備
- [x] render.yaml設定ファイルの作成
- [x] .env.exampleファイルの作成
- [x] DEPLOYMENT.md手順書の作成
- [x] package.jsonのビルドスクリプト調整

## Renderビルドパス修正
- [x] package.jsonのビルド出力パスを修正
- [x] 起動コマンドのパスを修正
## Renderデプロイ失敗修正（esbuildが実行されない問題）
- [x] esbuildがdevDependenciesに入っているか確認
- [x] server/socket.tsの存在確認とビルドスクリプト修正
- [x] ビルドスクリプトの出力確認

## Render静的ファイルパスと環境変数修正
- [x] server/_core/vite.tsの静的ファイルパスを修正（dist/_core/public → dist/public）
- [x] render.yamlにOAUTH関連の環境変数を追加（ダミー値）
- [x] 環境変数の設定方法をDEPLOYMENT.mdに追記

## 初回アクセス時のメディアデバイス選択肢表示バグ修正
- [x] 許可取得後のデバイスリスト再取得ロジックを追加
- [x] NotReadableErrorのエラーハンドリング強化
- [x] デバイス取得失敗時のユーザーへの案内メッセージ追加

## デバイス選択反映とチャットスクロール機能
- [x] デバイス変更時にストリームを再取得する処理を実装
- [x] チャットボックスにスクロール機能を追加
- [x] 新しいメッセージ受信時に自動スクロール（既に実装済み）
