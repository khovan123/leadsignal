# Backend-only Reddit crawler

Reddit OAuth is disabled. The worker runs the existing Playwright collector and the frontend only reads LeadSignal API results.

## Runtime flow

1. The worker acquires the `CollectorLease`.
2. `RedditPublicCollectorService.collect()` resolves enabled sources.
3. Playwright navigates, scrolls, parses posts, and enriches details.
4. Posts are upserted into `RedditPost` and `PostDiscovery`.
5. New discoveries are sent to the classification queue.
6. The frontend reads posts, leads, source status, and job status from LeadSignal APIs.

The extension no longer registers a Reddit content script and no longer captures or uploads posts.

## Configuration

```env
REDDIT_CRAWLER_ENABLED=true
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

## Remaining integration point

Authenticated web-session transfer is not implemented in this branch. Do not re-enable the old Reddit OAuth collector. The backend collector is the only collection execution path.
