# Backend-only Reddit crawler

Reddit OAuth is disabled. The worker runs the Playwright collector and the frontend only reads LeadSignal API results.

## Runtime flow

1. The worker acquires the `CollectorLease`.
2. `RedditPublicCollectorService.collect()` resolves enabled sources.
3. Playwright launches a persistent backend browser profile.
4. The collector optionally verifies that the profile is authenticated.
5. Playwright navigates, scrolls, parses posts, and enriches details.
6. Posts are upserted into `RedditPost` and `PostDiscovery`.
7. New discoveries are sent to the classification queue.
8. The frontend reads posts, leads, source status, and job status from LeadSignal APIs.

The extension no longer registers a Reddit content script and no longer captures or uploads Reddit posts.

## Configuration

```env
REDDIT_CRAWLER_ENABLED=true
REDDIT_BACKEND_PROFILE_DIR=.runtime/reddit-browser-profile
REDDIT_REQUIRE_AUTHENTICATED_PROFILE=true
REDDIT_COLLECTION_CONCURRENCY=1
REDDIT_DETAIL_CONCURRENCY=2
REDDIT_COLLECTOR_INTERVAL_SECONDS=300
REDDIT_SHOW_BROWSER=false
REDDIT_BROWSER_CHANNEL=chrome
REDDIT_CRAWLER_POSTS_PER_SOURCE=50
REDDIT_CRAWLER_MAX_SCROLLS=20
REDDIT_CRAWLER_MAX_STALL_ROUNDS=4
REDDIT_CRAWLER_NAVIGATION_TIMEOUT_MS=30000
REDDIT_CRAWLER_USER_AGENT=LeadSignalBackendCollector/1.0
REDDIT_CRAWLER_LOCALE=en-US
REDDIT_CRAWLER_TIMEZONE=Asia/Ho_Chi_Minh
```

`REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are not required.

## Prepare the profile

Set `REDDIT_SHOW_BROWSER=true` on the worker host and start the worker once. The persistent browser uses `REDDIT_BACKEND_PROFILE_DIR`. Complete the required browser setup directly on that host, stop the worker, then switch `REDDIT_SHOW_BROWSER=false` and restart it.

The profile directory must be persisted across restarts. For Docker, mount it as a named volume. Never commit the profile directory to Git.

## Session health

When `REDDIT_REQUIRE_AUTHENTICATED_PROFILE=true`, the worker checks the Reddit home page before collection. When the profile is no longer authenticated, collection fails with `REDDIT_BACKEND_LOGIN_REQUIRED` instead of silently collecting the logged-out view.
