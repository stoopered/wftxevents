output "apex_records" {
  value = [for r in cloudflare_dns_record.apex : r.content]
}

output "www_record" {
  value = cloudflare_dns_record.www.content
}
