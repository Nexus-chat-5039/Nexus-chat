variable "project_id" {}
variable "region" {}
variable "env" {}
variable "network_id" {}

data "google_secret_manager_secret_version" "alloydb_password" {
  secret  = "alloydb-password-${var.env}"
  project = var.project_id
}

resource "google_alloydb_cluster" "primary" {
  cluster_id = "nexus-alloydb-${var.env}"
  location   = var.region
  network_config {
    network = var.network_id
  }

  automated_backup_policy {
    location      = var.region
    backup_window = "1800s"
    enabled       = true

    weekly_schedule {
      days_of_week = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
      start_times {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }

    quantity_based_retention {
      count = 14
    }
  }

  continuous_backup_config {
    enabled              = true
    recovery_window_days = 14
  }

  initial_user {
    password = data.google_secret_manager_secret_version.alloydb_password.secret_data
  }
}

resource "google_alloydb_instance" "primary" {
  cluster       = google_alloydb_cluster.primary.name
  instance_id   = "primary-instance"
  instance_type = "PRIMARY"
  
  availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"

  machine_config {
    cpu_count = 2
  }
}

