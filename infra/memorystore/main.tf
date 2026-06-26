variable "region" {}
variable "env" {}
variable "network_id" {}

resource "google_redis_instance" "cache" {
  name           = "nexus-redis-${var.env}"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region
  redis_version  = "REDIS_7_0"

  authorized_network = var.network_id
}
