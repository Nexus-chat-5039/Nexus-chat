docker exec nexus-chat-postgres-1 psql -U root -d nexus -c "SELECT * FROM workspace_members;"
docker exec nexus-chat-postgres-1 psql -U root -d nexus -c "SELECT * FROM messages;"
