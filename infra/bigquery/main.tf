variable "project_id" {}
variable "region" {}
variable "env" {}

resource "google_bigquery_dataset" "billing_dataset" {
  dataset_id                  = "nexus_billing_${var.env}"
  friendly_name               = "Nexus Billing Dataset"
  description                 = "Dataset for storing usage metrics"
  location                    = var.region
  default_table_expiration_ms = 31536000000 # 365 days
}

resource "google_bigquery_table" "events" {
  dataset_id = google_bigquery_dataset.billing_dataset.dataset_id
  table_id   = "usage_events"

  schema = <<EOF
[
  {"name": "event_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "tenant_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "service_name", "type": "STRING", "mode": "REQUIRED"},
  {"name": "tokens", "type": "INTEGER", "mode": "NULLABLE"},
  {"name": "timestamp", "type": "TIMESTAMP", "mode": "REQUIRED"}
]
EOF
}
