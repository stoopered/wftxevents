# wftxevents.com -- Zombie Maze

Static Halloween attraction site. GitHub Pages is the live site; an AWS
S3 + CloudFront stack exists as a cold-standby backup.

## Stack

- **Site**: plain HTML/CSS/JS, no build step. `index.html`, `css/style.css`, `js/main.js`.
- **Booking**: Sunday-only tours via an embedded Calendly widget (`#book` section in `index.html`).
  Restrict availability to Sundays inside your Calendly event type settings -- the embed itself
  doesn't filter by day.
- **CI/CD**: `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
- **DNS**: `terraform/dns` manages wftxevents.com's records at Namecheap (Terraform, not manual).
- **Backup hosting**: `terraform/aws-backup` provisions a private S3 bucket behind CloudFront (OAC),
  dormant until you need it. `.github/workflows/sync-aws-backup.yml` pushes content to it manually.

## Before this goes live

Replace every `[PLACEHOLDER]` in `index.html` (search for `data-fill`): event dates, hours,
address, pricing, FAQ answers, contact email. Replace the Calendly `data-url` with your real
event link.

## First-time setup

### 1. GitHub Pages
Already enabled on the repo (Settings > Pages, source = GitHub Actions). Push to `main` and the
workflow deploys automatically.

### 2. DNS (Terraform + Namecheap)
Namecheap's API requires your account to be API-eligible (20+ domains, or $50+ spent in the last
2 years, or a whitelisted IP + manual approval on a new account) -- check Profile > Tools > API
Access in the Namecheap dashboard first.

```bash
cd terraform/dns
cp terraform.tfvars.example terraform.tfvars   # fill in real values, never commit this file
terraform init
terraform plan
terraform apply
```

This sets 4 apex A records to GitHub Pages' IPs and a `www` CNAME. `mode = "OVERWRITE"` replaces
*all* DNS records on the domain -- if you add email later, add those records to `dns.tf`, don't
add them by hand in the UI (next apply wipes them).

After DNS propagates, turn on "Enforce HTTPS" in GitHub Settings > Pages once GitHub shows the
domain as verified.

### 3. AWS backup stack (optional, off by default)
```bash
cd terraform/aws-backup
# authenticate first, don't paste keys into chat -- run in your own terminal:
#   aws configure    (or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN)
terraform init
terraform apply
```
This creates a CloudFront distribution reachable immediately at its `*.cloudfront.net` URL --
no DNS or cert validation needed to confirm it works. To actually attach wftxevents.com to it:

1. `terraform apply` once to get the `acm_validation_records` output.
2. Add those as CNAME records at Namecheap (alongside, not instead of, the live GitHub Pages records).
3. Wait for ACM to show the cert as issued.
4. Set `enable_custom_domain = true` and `terraform apply` again.
5. Only repoint the live A/CNAME records at CloudFront if GitHub Pages is actually down.

Add repo secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BACKUP_BUCKET`,
`AWS_CLOUDFRONT_DISTRIBUTION_ID` (from the `terraform output`) to enable the manual
`sync-aws-backup.yml` workflow.

Cost: low single-digit dollars/month at most for a low-traffic seasonal site (S3 storage pennies,
CloudFront's free tier covers 1TB/month transfer for the first 12 months on a new AWS account).

## Local preview
No build step -- just open `index.html` in a browser, or:
```bash
python3 -m http.server 8000
```
