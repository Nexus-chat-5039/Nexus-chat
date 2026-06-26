variable "env" {}
variable "region" {}

resource "google_compute_network" "vpc" {
  name                    = "nexus-vpc-${var.env}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "nexus-subnet-${var.env}"
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/16"
}

resource "google_compute_router" "router" {
  name    = "nexus-router-${var.env}"
  region  = google_compute_subnetwork.subnet.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "nexus-nat-${var.env}"
  router                             = google_compute_router.router.name
  region                             = google_compute_router.router.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

output "network_id" {
  value = google_compute_network.vpc.id
}

output "subnet_id" {
  value = google_compute_subnetwork.subnet.id
}
