# Discord OAuth監査メモ

Discord公式OAuth2仕様では、`identify`でユーザー基本情報、`guilds`でユーザー所属サーバーの基本情報（`/users/@me/guilds`）を取得できる。Bot OAuthは`bot`スコープでサーバーへ追加される。ユーザー所属サーバー一覧だけではBot参加状況やチャンネル権限を確定できないため、サーバー側のBotキャッシュ/APIで対象Guildとチャンネルを照合し、Botが閲覧・送信できるテキストチャンネルだけを候補にする。

参照:
- https://docs.discord.com/developers/topics/oauth2 — OAuth2 scopes and authorization flow
- https://docs.discord.com/developers/resources/user — Get Current User Guilds and user resource
- https://docs.discord.com/developers/resources/guild — Guild and permissions resource
## 公開環境スモーク確認

2026-08-26時点で、`https://entryform-4xosiknu.manus.space/api/discord/login`を公開環境で開いたところ、OAuth開始ルートではなく404ページが返った。これはOAuth実装を含むチェックポイントの公開反映または実行サービス更新前の状態を示す。開発サービス再起動後、公開チェックポイント保存・公開ドメインの再確認が必要。
