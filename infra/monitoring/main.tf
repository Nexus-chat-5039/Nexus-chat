variable "project_id" {}
variable "env" {}

resource "google_monitoring_uptime_check_config" "api_check" {
  display_name = "nexus-api-uptime-${var.env}"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = "/ready"
    port           = "80"
    use_ssl        = false
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "api.nexus.local"
    }
  }
}
