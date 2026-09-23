output "records" {
  description = "DNS records applied to the domain"
  value       = namecheap_domain_records.wftxevents.record
}
