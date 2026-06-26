variable "project_id" {}
variable "env" {}

resource "google_logging_project_sink" "audit_sink" {
  name        = "nexus-audit-sink-${var.env}"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/nexus_audit_${var.env}"
  filter      = "logName:\"cloudaudit.googleapis.com\""
  unique_writer_identity = true
}

resource "google_bigquery_dataset" "audit_dataset" {
  dataset_id = "nexus_audit_${var.env}"
  location   = "US"
}
