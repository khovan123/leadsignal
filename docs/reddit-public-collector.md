# Reddit public collector

LeadSignal collects enabled `RedditSource` records through a Playwright browser running in the worker.

The collector:

- does not require Reddit client credentials;
- runs headless unless `REDDIT_SHOW_BROWSER=true`;
- supports public subreddit, search, popular, news, best and custom Reddit URLs;
- normalizes post identifiers and deduplicates discoveries;
- queues classification only for newly discovered workspace/source pairs;
- falls back once to old Reddit pagination for empty subreddit pages;
- stops the affected source on HTTP 403 or 429;
- does not import browser sessions or private API credentials.

Install Chrome or run `pnpm exec playwright install chromium` on the worker host before enabling collection.
