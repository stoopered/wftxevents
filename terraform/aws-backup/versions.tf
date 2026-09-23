terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront + ACM-for-CloudFront both require us-east-1, so this whole
# stack lives there regardless of where you are.
provider "aws" {
  region = "us-east-1"
}
