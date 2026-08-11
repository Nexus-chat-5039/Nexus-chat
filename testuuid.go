package main

import (
	"fmt"
	"github.com/jackc/pgx/v5/pgtype"
)

func main() {
	u := pgtype.UUID{Bytes: [16]byte{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16}, Valid: true}
	fmt.Printf("%T %v\n", u.String(), u.String())
}
