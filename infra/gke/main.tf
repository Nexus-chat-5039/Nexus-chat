variable "project_id" {}
variable "region" {}
variable "env" {}
variable "network_id" {}
variable "subnet_id" {}

resource "google_container_cluster" "primary" {
  name     = "nexus-autopilot-${var.env}"
  location = var.region
  network  = var.network_id
  subnetwork = var.subnet_id

  # Enable Autopilot for this cluster
  enable_autopilot = true

  deletion_protection = false
}

output "cluster_name" {
  value = google_container_cluster.primary.name
}
