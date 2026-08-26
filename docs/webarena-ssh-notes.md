# WebARENA Indigo SSH確認メモ

WebARENA公式ヘルプによると、UbuntuのSSHログインユーザー名は`ubuntu`で、Indigoではキーペアを使った公開鍵認証が必須。パスワードは不要と案内されている。

出典:
- https://help.arena.ne.jp/hc/ja/articles/360038700414-OS%E3%81%ABSSH%E6%8E%A5%E7%B6%9A-%E3%83%AD%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%9B%E3%82%93-Indigo
- https://web.arena.ne.jp/news/2024/0509.html

したがって`Permission denied (publickey)`は、主に秘密鍵が対象インスタンス作成時のキーペアと一致していない、または別インスタンスのIPへ接続している場合に確認する。
