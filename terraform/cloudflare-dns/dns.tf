locals {
  # Published GitHub Pages apex IPs
  github_pages_ips = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"]
}

# proxied = false on purpose: GitHub Pages issues its own Let's Encrypt cert
# for the custom domain, which fails when Cloudflare's proxy sits in front.
resource "cloudflare_dns_record" "apex" {
  for_each = toset(local.github_pages_ips)

  zone_id = var.zone_id
  name    = var.domain
  type    = "A"
  content = each.value
  ttl     = 1
  proxied = false
  comment = "GitHub Pages - managed by Terraform"
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.zone_id
  name    = "www.${var.domain}"
  type    = "CNAME"
  content = "${var.github_username}.github.io"
  ttl     = 1
  proxied = false
  comment = "GitHub Pages - managed by Terraform"
}
