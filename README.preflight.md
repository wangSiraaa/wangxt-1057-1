# Trae Preflight

This folder is prepared for `wangxt-1057-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18357
- API_PORT: 19357
- WEB_PORT: 20357
- DB_PORT: 21357
- REDIS_PORT: 22357

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
