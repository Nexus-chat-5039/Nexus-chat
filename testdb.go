package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := "postgres://nexus:nexus@localhost:5432/nexus"
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		fmt.Println("Error connecting to database:", err)
		os.Exit(1)
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(), "SELECT * FROM messages WHERE chat_id = '0d137b7a-0ada-4907-99ef-a070309fbb19'")
	if err != nil {
		fmt.Println("Error querying database:", err)
		os.Exit(1)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}
	fmt.Printf("Found %d messages\n", count)
}
