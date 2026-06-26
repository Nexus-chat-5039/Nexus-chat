variable "project_id" {}
variable "region" {}
variable "env" {}

resource "google_storage_bucket" "assets" {
  name          = "nexus-assets-${var.project_id}-${var.env}"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}
