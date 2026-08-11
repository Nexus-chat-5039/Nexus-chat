package main

import (
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgtype"
)

func main() {
	var txt pgtype.Text
	txt.Scan("email@example.com")
	b, _ := json.Marshal(txt)
	fmt.Println(string(b))
}
