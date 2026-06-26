module "networking" {
  source = "./networking"
  env    = var.env
  region = var.region
}

module "serviceaccounts" {
  source     = "./serviceaccounts"
  project_id = var.project_id
  env        = var.env
}

module "iam" {
  source          = "./iam"
  project_id      = var.project_id
  api_sa_email    = module.serviceaccounts.api_sa_email
  worker_sa_email = module.serviceaccounts.worker_sa_email
}

module "gke" {
  source     = "./gke"
  project_id = var.project_id
  region     = var.region
  env        = var.env
  network_id = module.networking.network_id
  subnet_id  = module.networking.subnet_id
}

module "pubsub" {
  source     = "./pubsub"
  project_id = var.project_id
  env        = var.env
}

module "memorystore" {
  source     = "./memorystore"
  region     = var.region
  env        = var.env
  network_id = module.networking.network_id
}

module "cloudstorage" {
  source     = "./cloudstorage"
  project_id = var.project_id
  region     = var.region
  env        = var.env
}

module "alloydb" {
  source     = "./alloydb"
  project_id = var.project_id
  region     = var.region
  env        = var.env
  network_id = module.networking.network_id
}

module "bigquery" {
  source     = "./bigquery"
  project_id = var.project_id
  region     = var.region
  env        = var.env
}

module "artifactregistry" {
  source     = "./artifactregistry"
  project_id = var.project_id
  region     = var.region
  env        = var.env
}

module "secretmanager" {
  source     = "./secretmanager"
  project_id = var.project_id
  env        = var.env
}

module "cloudarmor" {
  source = "./cloudarmor"
  env    = var.env
}

module "loadbalancer" {
  source = "./loadbalancer"
  env    = var.env
}

module "logging" {
  source     = "./logging"
  project_id = var.project_id
  env        = var.env
}

module "monitoring" {
  source     = "./monitoring"
  project_id = var.project_id
  env        = var.env
}
