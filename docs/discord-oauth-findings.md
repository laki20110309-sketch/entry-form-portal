# Discord OAuth監査メモ

Discord公式OAuth2仕様では、`identify`でユーザー基本情報、`guilds`でユーザー所属サーバーの基本情報（`/users/@me/guilds`）を取得できる。Bot OAuthは`bot`スコープでサーバーへ追加される。ユーザー所属サーバー一覧だけではBot参加状況やチャンネル権限を確定できないため、サーバー側のBotキャッシュ/APIで対象Guildとチャンネルを照合し、Botが閲覧・送信できるテキストチャンネルだけを候補にする。

参照:
- https://docs.discord.com/developers/topics/oauth2 — OAuth2 scopes and authorization flow
- https://docs.discord.com/developers/resources/user — Get Current User Guilds and user resource
- https://docs.discord.com/developers/resources/guild — Guild and permissions resource
