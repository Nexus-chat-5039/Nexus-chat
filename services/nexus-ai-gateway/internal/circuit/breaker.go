package circuit

import (
	"log"
	"time"

	"github.com/sony/gobreaker/v2"
)

// NewBreaker creates a circuit breaker configured for an LLM provider.
// - Opens after `maxFailures` consecutive failures.
// - Stays open for `timeout` seconds before transitioning to half-open.
// - In half-open, allows 1 request through to test recovery.
func NewBreaker(providerName string, maxFailures uint32, timeoutSec int) *gobreaker.CircuitBreaker[any] {
	settings := gobreaker.Settings{
		Name:        providerName,
		MaxRequests: 1,                                           // Half-open: allow 1 probe request
		Interval:    0,                                           // Don't reset failure count on a timer
		Timeout:     time.Duration(timeoutSec) * time.Second,     // Open → half-open cooldown
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= maxFailures
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[circuit-breaker] %s: %s → %s", name, from.String(), to.String())
		},
	}

	return gobreaker.NewCircuitBreaker[any](settings)
}
