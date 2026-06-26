package server

import (
	"context"
	"log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"nexus/services/nexus-billing/internal/metering"
	pb "nexus/services/nexus-billing/pkg/pb/billing"
)

type BillingServer struct {
	pb.UnimplementedBillingServiceServer
	bqClient *metering.BigQueryClient
}

func NewBillingServer(bqClient *metering.BigQueryClient) *BillingServer {
	return &BillingServer{bqClient: bqClient}
}

func (s *BillingServer) ReportUsage(ctx context.Context, req *pb.ReportRequest) (*pb.ReportResponse, error) {
	if req.TenantId == "" {
		return nil, status.Error(codes.InvalidArgument, "tenant_id cannot be empty")
	}

	if req.Tokens <= 0 {
		return &pb.ReportResponse{Success: true}, nil // Nothing to report
	}

	// In a production scenario, you might want to batch these writes or use a pub/sub queue
	// if the volume is extremely high. For now, direct streaming inserts.
	if s.bqClient != nil {
		if err := s.bqClient.RecordUsage(ctx, req.TenantId, req.Tokens); err != nil {
			log.Printf("[billing] Failed to record usage for tenant %s: %v", req.TenantId, err)
			return nil, status.Errorf(codes.Internal, "failed to record usage: %v", err)
		}
	} else {
		// Log-only mode if BQ is not configured
		log.Printf("[billing-dryrun] Tenant: %s | Tokens: %d", req.TenantId, req.Tokens)
	}

	return &pb.ReportResponse{Success: true}, nil
}
