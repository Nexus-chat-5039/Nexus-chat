variable "project_id" {}
variable "env" {}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "alloydb-password-${var.env}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret-${var.env}"
  replication {
    auto {}
  }
}
