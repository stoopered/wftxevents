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
| `BOOKING_ADMIN_TOKEN` | Random string you generate; pushed into the Worker as `ADMIN_TOKEN` | deploy-worker.yml; you paste it into `/admin.html` to view bookings |

No secret is ever written to a file in this repo. Set them with `gh secret set NAME --repo stoopered/wftxevents`
and paste the value at the prompt.

## Booking

Sundays are appointment only. The form on the site calls the Worker:

- `GET /api/dates` -- bookable Sundays in season with remaining capacity
- `GET /api/slots?date=YYYY-MM-DD` -- time slots for a date with remaining capacity
- `POST /api/bookings` -- creates a booking; capacity check and insert are one atomic SQL statement
- `GET /api/admin/bookings`, `DELETE /api/admin/bookings/:id` -- Bearer `ADMIN_TOKEN`

Tune season dates, slot times, capacity per slot, and max group size in the `CONFIG` block at the
top of `worker/src/index.js`. Thursday-Saturday walk-up hours are plain text in `index.html`.

Spam controls: honeypot field, per-IP hourly cap (IP stored as a SHA-256 hash), server-side
validation. No confirmation email is sent -- the guest gets a confirmation code on screen and the
admin page shows their phone/email.

## Before this goes live

- Replace the `data-fill` placeholders in `index.html`: address, price, contact email.
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
