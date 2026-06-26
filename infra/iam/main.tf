variable "project_id" {}
variable "api_sa_email" {}
variable "worker_sa_email" {}

resource "google_project_iam_binding" "api_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  members = ["serviceAccount:${var.api_sa_email}"]
}

resource "google_project_iam_binding" "worker_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  members = ["serviceAccount:${var.worker_sa_email}"]
}
