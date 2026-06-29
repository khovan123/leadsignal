# Reddit source configuration

LeadSignal supports workspace-scoped Reddit sources from the web dashboard at `/{locale}/sources`.

Supported source types:

- `HOME`, `POPULAR`, `NEWS`, `BEST`
- `FOLLOWING` (browser extension only)
- `SUBREDDIT`
- `SEARCH`
- `CUSTOM_URL` restricted to `reddit.com`

Each source stores its own sort, time range, target post count, scroll/stall limits, promoted/pinned/NSFW filters, detail mode, top-comment count, collection mode and latest run status.

`PUBLIC` sources are collected by the Playwright worker. `EXTENSION` sources are captured from the user's active Reddit tab and never transfer Reddit cookies, localStorage or session tokens to LeadSignal. `FOLLOWING` is always forced to `EXTENSION` mode because it is personalized.

Manual runs use the `reddit-collection` BullMQ queue. Periodic runs reuse the same collector and source settings. Detail enrichment runs with bounded concurrency and stores media URLs plus top comments on the post record.
