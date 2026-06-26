package server

import (
	"context"
	"log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "nexus/services/nexus-ai-gateway/pkg/pb/gateway"
	"nexus/services/nexus-ai-gateway/internal/providers"
	"nexus/services/nexus-ai-gateway/internal/router"
)

// GatewayServer implements the AIGatewayService gRPC interface.
type GatewayServer struct {
	pb.UnimplementedAIGatewayServiceServer
	router *router.ModelRouter
}

func NewGatewayServer(r *router.ModelRouter) *GatewayServer {
	return &GatewayServer{router: r}
}

// Generate handles unary (non-streaming) completion requests.
func (s *GatewayServer) Generate(ctx context.Context, req *pb.GenerateRequest) (*pb.GenerateResponse, error) {
	if req.Prompt == "" {
		return nil, status.Error(codes.InvalidArgument, "prompt cannot be empty")
	}

	result, err := s.router.Generate(ctx, req.Prompt, req.Context, req.ModelHint, req.TenantId)
	if err != nil {
		log.Printf("[grpc] Generate failed: %v", err)
		return nil, status.Errorf(codes.Internal, "generation failed: %v", err)
	}

	return &pb.GenerateResponse{
		Content:          result.Content,
		ModelUsed:        result.Model,
		PromptTokens:     result.PromptTokens,
		CompletionTokens: result.CompletionTokens,
	}, nil
}

// StreamResponse handles server-streaming completion requests.
func (s *GatewayServer) StreamResponse(req *pb.GenerateRequest, stream pb.AIGatewayService_StreamResponseServer) error {
	if req.Prompt == "" {
		return status.Error(codes.InvalidArgument, "prompt cannot be empty")
	}

	ctx := stream.Context()
	chunkChan := make(chan providers.StreamChunk, 16)

	errChan := make(chan error, 1)
	go func() {
		errChan <- s.router.StreamGenerate(ctx, req.Prompt, req.Context, req.ModelHint, req.TenantId, chunkChan)
	}()

	for chunk := range chunkChan {
		if err := stream.Send(&pb.GenerateChunk{
			Delta:     chunk.Delta,
			IsFinal:   chunk.IsFinal,
			ModelUsed: chunk.Model,
		}); err != nil {
			log.Printf("[grpc] StreamResponse send error: %v", err)
			return err
		}
	}

	if err := <-errChan; err != nil {
		log.Printf("[grpc] StreamResponse generation error: %v", err)
		return status.Errorf(codes.Internal, "stream generation failed: %v", err)
	}

	return nil
}
