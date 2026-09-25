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

# Resend: lets the booking Worker send email as bookings@wftxevents.com.
# Values come from the Resend dashboard (Domains > wftxevents.com).
resource "cloudflare_dns_record" "resend_dkim" {
  zone_id = var.zone_id
  name    = "resend._domainkey.${var.domain}"
  type    = "TXT"
  content = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmyyPns3RjfOscySZrFYtJSBumj5f6VK8NkLXKh3OeyXAMR909/+L1VNs8xmgwVhn1DmzNI0vvtQaPucGJfRzRRBUgWbJKri+a+eRwX+nhdfXNuZWtY6UAsPKb/RJYP+MyS7AKIgrVwe0rV3kNMm/M0YE+49XLTGDlUerX72z7jQIDAQAB"
  ttl     = 1
  comment = "Resend DKIM - managed by Terraform"
}

resource "cloudflare_dns_record" "resend_send" {
  for_each = toset(["send", "rsend"])

  zone_id = var.zone_id
  name    = "${each.key}.${var.domain}"
  type    = "CNAME"
  content = "${each.key}.forge.rmta.net"
  ttl     = 1
  proxied = false
  comment = "Resend sending - managed by Terraform"
}

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  content = "v=DMARC1; p=none;"
  ttl     = 1
  comment = "DMARC (monitor only) - managed by Terraform"
}
