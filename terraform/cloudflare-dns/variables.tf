variable "zone_id" {
  description = "Cloudflare zone ID for wftxevents.com (not a secret)"
  type        = string
  default     = "74372e72094e294254ecb5dd1084e510"
}

variable "domain" {
  type    = string
  default = "wftxevents.com"
}

variable "github_username" {
  description = "Owner of the GitHub Pages site (target for the www CNAME)"
  type        = string
  default     = "stoopered"
}
