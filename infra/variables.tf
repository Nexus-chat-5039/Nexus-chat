variable "project_id" {
  description = "The GCP Project ID"
  type        = string
  default     = "nexus-prod-12345"
}

variable "region" {
  description = "The default GCP region"
  type        = string
  default     = "us-central1"
}

variable "env" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}
