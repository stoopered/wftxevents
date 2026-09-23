variable "domain" {
  description = "Apex domain for the backup site"
  type        = string
  default     = "wftxevents.com"
}

variable "enable_custom_domain" {
  description = <<-EOT
    False (default): CloudFront serves on its own *.cloudfront.net domain only,
    no DNS or cert validation required -- apply and go, good enough to confirm
    the backup stack works.
    True: attaches wftxevents.com / www.wftxevents.com to the distribution using
    the validated ACM cert below. Only flip this once you've added the ACM
    validation CNAME (see output "acm_validation_records") to DNS and it has
    validated, and once you're actually ready to cut DNS over from GitHub Pages.
  EOT
  type        = bool
  default     = false
}
