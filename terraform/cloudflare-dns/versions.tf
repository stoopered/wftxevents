terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.25"
    }
  }

  # State lives in Cloudflare R2 (S3-compatible, free tier). Credentials come
  # from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, set to an R2 API token's
  # key pair -- never hardcoded here.
  backend "s3" {
    bucket                      = "wftxevents-tfstate"
    key                         = "cloudflare-dns/terraform.tfstate"
    region                      = "auto"
    endpoints                   = { s3 = "https://5d3e356815fa558bc52164ed77897f54.r2.cloudflarestorage.com" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}

# Authenticates via the CLOUDFLARE_API_TOKEN env var.
provider "cloudflare" {}
