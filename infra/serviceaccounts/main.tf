variable "project_id" {}
variable "env" {}

resource "google_service_account" "api_sa" {
  account_id   = "nexus-api-sa-${var.env}"
  display_name = "Nexus API Service Account"
}

resource "google_service_account" "worker_sa" {
  account_id   = "nexus-worker-sa-${var.env}"
  display_name = "Nexus Worker Service Account"
}

output "api_sa_email" {
  value = google_service_account.api_sa.email
}

output "worker_sa_email" {
  value = google_service_account.worker_sa.email
}
