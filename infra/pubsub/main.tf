variable "project_id" {}
variable "env" {}

locals {
  topics = [
    "ai.inference",
    "embed.messages",
    "notifications",
    "billing.events"
  ]
}

resource "google_pubsub_topic" "topics" {
  for_each = toset(local.topics)
  name     = "${each.key}-${var.env}"
  project  = var.project_id
}

resource "google_pubsub_topic" "deadletter" {
  name    = "deadletter-${var.env}"
  project = var.project_id
}

resource "google_pubsub_subscription" "subs" {
  for_each = toset(local.topics)
  name     = "${each.key}-sub-${var.env}"
  topic    = google_pubsub_topic.topics[each.key].name

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.deadletter.id
    max_delivery_attempts = 5
  }
}
