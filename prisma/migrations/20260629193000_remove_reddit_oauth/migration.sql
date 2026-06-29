DROP TABLE IF EXISTS "RedditConnection";

DELETE FROM "OAuthState"
WHERE provider = 'reddit';
