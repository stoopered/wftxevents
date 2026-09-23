# WARNING: mode = "OVERWRITE" replaces ALL DNS records for the domain with
# exactly what's defined below. If you later add email (MX/TXT/SPF) or other
# records, add them here too -- don't set them by hand in the Namecheap UI,
# they'll get wiped on the next apply.
resource "namecheap_domain_records" "wftxevents" {
  domain = var.domain
  mode   = "OVERWRITE"

  # GitHub Pages apex domain A records (github.com/pages doc-published IPs)
  record {
    hostname = "@"
    type     = "A"
    address  = "185.199.108.153"
    ttl      = 1800
  }
  record {
    hostname = "@"
    type     = "A"
    address  = "185.199.109.153"
    ttl      = 1800
  }
  record {
    hostname = "@"
    type     = "A"
    address  = "185.199.110.153"
    ttl      = 1800
  }
  record {
    hostname = "@"
    type     = "A"
    address  = "185.199.111.153"
    ttl      = 1800
  }

  # www redirects to the apex via GitHub Pages
  record {
    hostname = "www"
    type     = "CNAME"
    address  = "${var.github_username}.github.io."
    ttl      = 1800
  }
}
