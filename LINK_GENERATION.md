# Temporary Report Link Generation

This guide explains how to generate temporary signed links for client reports.

## Prerequisites
- `ADMIN_API_KEY` set locally and on Vercel.
- `STORAGE_LINK_SECRET` set locally and on Vercel.

## Generate A Link (Admin Endpoint)
Send a POST request to the admin endpoint with a bearer token.

```bash
curl -X POST "https://menata.fr/api/admin/storage-link" \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"slug":"emoi_naturopathie","days":14}'
```

Response example:
```json
{
  "slug": "emoi_naturopathie",
  "expiresAt": 1730000000,
  "url": "https://menata.fr/storage/emoi_naturopathie?token=1730000000.abc123...",
  "legacyUrl": "https://menata.fr/storage/emoi_naturopathie?exp=1730000000&sig=abc123..."
}
```

## Notes
- `days` is clamped between 1 and 30.
- `expiresAt` is a Unix timestamp in seconds (UTC).
- **Use `url`** (single `?token=` param) — safe for all email providers (avoids `&` being mangled by IONOS, etc.).
- `legacyUrl` uses the old `?exp=&sig=` format for backward compatibility.
- If the link is expired or tampered with, the page returns 404.
