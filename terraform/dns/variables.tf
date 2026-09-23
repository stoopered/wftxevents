variable "namecheap_username" {
  description = "Namecheap account username"
  type        = string
}

variable "namecheap_api_user" {
  description = "Namecheap API username (usually same as namecheap_username)"
  type        = string
}

variable "namecheap_api_key" {
  description = "Namecheap API key, generated under Profile > Tools > API Access"
  type        = string
  sensitive   = true
}

variable "namecheap_client_ip" {
  description = "Public IP whitelisted for Namecheap API access"
  type        = string
}

variable "domain" {
  description = "Apex domain managed by this stack"
  type        = string
  default     = "wftxevents.com"
}

variable "github_username" {
  description = "GitHub username/org that owns the Pages site (target for the www CNAME)"
  type        = string
  default     = "stoopered"
}
