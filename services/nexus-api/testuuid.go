package main

import (
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgtype"
)

func main() {
	var id pgtype.UUID
	id.Scan("8a126bfe-21e9-4a36-a8e9-cc4cc7de6658")
	b, _ := json.Marshal(id)
	fmt.Println(string(b))
}
