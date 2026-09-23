output "bucket_name" {
  value = aws_s3_bucket.site.id
}

output "cloudfront_domain_name" {
  description = "Backup site URL -- works immediately, no DNS changes needed"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "acm_validation_records" {
  description = "Add these as CNAME records at your DNS provider to validate the cert, then set enable_custom_domain = true"
  value = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
