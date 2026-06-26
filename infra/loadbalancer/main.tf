variable "env" {}

resource "google_compute_global_forwarding_rule" "default" {
  name       = "nexus-lb-forwarding-rule-${var.env}"
  target     = google_compute_target_http_proxy.default.id
  port_range = "80"
}

resource "google_compute_target_http_proxy" "default" {
  name    = "nexus-lb-target-proxy-${var.env}"
  url_map = google_compute_url_map.default.id
}

resource "google_compute_url_map" "default" {
  name            = "nexus-lb-url-map-${var.env}"
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_backend_service" "default" {
  name                  = "nexus-lb-backend-${var.env}"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL"
  # Security policy will be attached here
}
