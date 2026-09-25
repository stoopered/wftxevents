# wftxevents.com -- Zombie Maze

Halloween attraction site for Wichita Falls, TX. Static front end on GitHub Pages, DNS on Cloudflare
(Terraform), Sunday appointment booking on a Cloudflare Worker + D1. Everything runs on free tiers.

## Stack

| Piece | Where | How it deploys |
|---|---|---|
| Site (`index.html`, `css/`, `js/`) | GitHub Pages | `.github/workflows/deploy.yml` on push to `main` |
| DNS for wftxevents.com | Cloudflare (zone `74372e72…`) | `terraform/cloudflare-dns`, via `.github/workflows/terraform-cloudflare-dns.yml`; state in R2 bucket `wftxevents-tfstate` |
| Booking API (`worker/`) | Cloudflare Worker `wftxevents-booking` + D1 `wftxevents-bookings` | `.github/workflows/deploy-worker.yml` on push to `worker/**` |
| Admin view (`admin.html`) | GitHub Pages (`/admin.html`, noindex) | with the site |
| AWS S3 + CloudFront backup (`terraform/aws-backup`) | not applied | manual `terraform apply` if ever wanted |

Domain registration stays at Namecheap; only the nameservers point at Cloudflare
(`morgan.ns.cloudflare.com`, `nancy.ns.cloudflare.com`).

## Secrets (GitHub Actions repo secrets)

| Secret | Scope | Used by |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | DNS edit on wftxevents.com only | terraform-cloudflare-dns.yml |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Object read/write on `wftxevents-tfstate` only | terraform-cloudflare-dns.yml (state backend) |
| `CLOUDFLARE_WORKERS_TOKEN` | Workers Scripts + D1 edit | deploy-worker.yml |
| `BOOKING_ADMIN_TOKEN` | Random string, also in your macOS Keychain (`security find-generic-password -s wftxevents-booking-admin -w`); pushed into the Worker as `ADMIN_TOKEN` | deploy-worker.yml; paste into `/admin.html` to view bookings |
| `RESEND_API_KEY` | Resend sending key | deploy-worker.yml; booking emails |
| `BOOKING_NOTIFY_EMAILS` | Comma-separated addresses that get an email per booking request | deploy-worker.yml |
| `NTFY_TOPIC` | Private ntfy topic name (also in Keychain: `security find-generic-password -s wftxevents-ntfy-topic -w`) | deploy-worker.yml; phone push per request |

No secret is ever written to a file in this repo. Set them with `gh secret set NAME --repo stoopered/wftxevents`
and paste the value at the prompt.

## Booking

Sundays are appointment only, and every request needs approval. A new request is `pending`: it does not
hold the slot. Staff get a phone push (ntfy) and an email, then Approve or Decline on `/admin.html`.
Approval is atomic -- it only succeeds if the slot still has room among confirmed bookings -- so two
approvals can't overbook. The guest is emailed at each step: request received, confirmed, declined,
or cancelled.

Phone push: install the ntfy app (iOS/Android), tap +, and subscribe to the topic name from
`NTFY_TOPIC`. Anyone subscribed gets every request; the topic name is the only protection, so share it
only with staff. Rotate it by setting a new `NTFY_TOPIC` secret and re-running deploy-worker.

API:

- `GET /api/dates` -- bookable Sundays in season with remaining capacity
- `GET /api/slots?date=YYYY-MM-DD` -- time slots for a date with remaining capacity
- `POST /api/bookings` -- creates a booking; capacity check and insert are one atomic SQL statement
- `GET /api/admin/bookings`, `POST /api/admin/bookings/:id/approve`, `POST /api/admin/bookings/:id/decline`,
  `DELETE /api/admin/bookings/:id` (cancel) -- Bearer `ADMIN_TOKEN`

Tune season dates, slot times, capacity per slot, and max group size in the `CONFIG` block at the
top of `worker/src/index.js`. Thursday-Saturday walk-up hours are plain text in `index.html`.

Spam controls: honeypot field, per-IP hourly cap (IP stored as a SHA-256 hash), server-side
validation.

Email goes through Resend from `bookings@wftxevents.com`, after the database write, so a mail or push
failure never blocks a booking. Guest emails reply-to the staff addresses; staff alerts reply-to the guest. To change who's notified:
`gh secret set BOOKING_NOTIFY_EMAILS --body "a@x.com,b@y.com"` then re-run the deploy-worker workflow.

## Before this goes live

- Replace the remaining `data-fill` placeholder in `index.html`: ticket price.
- Confirm the season/slots in `worker/src/index.js` `CONFIG`.
- Turn on "Enforce HTTPS" in GitHub Settings > Pages once GitHub shows the domain verified.

## Local preview

```bash
python3 -m http.server 8000
cd worker && echo 'ADMIN_TOKEN=local-test-token' > .dev.vars \
  && npx wrangler d1 migrations apply wftxevents-bookings --local \
  && npx wrangler dev --local --port 8787
```
Served from localhost, the site and `admin.html` talk to the local Worker on :8787 instead of production.

## DNS changes

Edit `terraform/cloudflare-dns/dns.tf`, push -- the workflow plans automatically. Apply with:
```bash
gh workflow run terraform-cloudflare-dns.yml -f apply=true
```
Records are `proxied = false` on purpose: GitHub Pages issues its own TLS cert for the domain and
can't do that behind Cloudflare's proxy.

## AWS backup (optional, not applied)

`terraform/aws-backup` provisions a private S3 bucket behind CloudFront with a GitHub OIDC role
(no stored AWS keys). It has never been applied; Cloudflare Pages would be the simpler backup if
one is ever needed. See the file comments if you do want to stand it up.
