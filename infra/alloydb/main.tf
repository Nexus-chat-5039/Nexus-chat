variable "project_id" {}
variable "region" {}
variable "env" {}
variable "network_id" {}

resource "google_alloydb_cluster" "primary" {
  cluster_id = "nexus-alloydb-${var.env}"
  location   = var.region
  network_config {
    network = var.network_id
  }
  initial_user {
    password = "supersecretpassword123!" # In production, pull from Secret Manager
  }
}

resource "google_alloydb_instance" "primary" {
  cluster       = google_alloydb_cluster.primary.name
  instance_id   = "primary-instance"
  instance_type = "PRIMARY"
  
  machine_config {
    cpu_count = 2
  }
}
