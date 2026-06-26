variable "project_id" {}
variable "region" {}
variable "env" {}

resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "nexus-repo-${var.env}"
  description   = "Docker repository for Nexus microservices"
  format        = "DOCKER"
}
