package orchestrator

import (
	"context"
	"fmt"
	"io"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"nexus/services/nexus-ai-worker/internal/db/postgres"
	"nexus/services/nexus-ai-worker/internal/db/redis"
	pb_billing "nexus/services/nexus-ai-worker/pkg/pb/billing"
	pb_gateway "nexus/services/nexus-ai-worker/pkg/pb/gateway"
	pb_rag "nexus/services/nexus-ai-worker/pkg/pb/rag"
)

type InferenceJob struct {
	Query       string `json:"query"`
	TenantID    string `json:"tenant_id"`
	WorkspaceID string `json:"workspace_id"`
	GroupID     string `json:"group_id"`
	ChatID      string `json:"chat_id"`
	UserID      string `json:"user_id"`
}

type Orchestrator struct {
	ragClient      pb_rag.RAGServiceClient
	gatewayClient  pb_gateway.AIGatewayServiceClient
	billingClient  pb_billing.BillingServiceClient
	db             *postgres.Client
	redis          *redis.Client
	ragConn        *grpc.ClientConn
	gwConn         *grpc.ClientConn
	billingConn    *grpc.ClientConn
}

func NewOrchestrator(ragAddr, gatewayAddr, billingAddr string, db *postgres.Client, rdb *redis.Client) (*Orchestrator, error) {
	ragConn, err := grpc.NewClient(ragAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to rag service: %w", err)
	}

	gwConn, err := grpc.NewClient(gatewayAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		ragConn.Close()
		return nil, fmt.Errorf("failed to connect to gateway service: %w", err)
	}

	var billingClient pb_billing.BillingServiceClient
	billingConn, err := grpc.NewClient(billingAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("Warning: failed to connect to billing service: %v. Proceeding without billing.", err)
	} else {
		billingClient = pb_billing.NewBillingServiceClient(billingConn)
	}

	return &Orchestrator{
		ragClient:      pb_rag.NewRAGServiceClient(ragConn),
		gatewayClient:  pb_gateway.NewAIGatewayServiceClient(gwConn),
		billingClient:  billingClient,
		db:             db,
		redis:          rdb,
		ragConn:        ragConn,
		gwConn:         gwConn,
		billingConn:    billingConn,
	}, nil
}

// Close gracefully closes gRPC client connections.
func (o *Orchestrator) Close() {
	if o.ragConn != nil {
		o.ragConn.Close()
	}
	if o.gwConn != nil {
		o.gwConn.Close()
	}
	if o.billingConn != nil {
		o.billingConn.Close()
	}
}

type EmbedJob struct {
	Content     string `json:"content"`
	TenantID    string `json:"tenant_id"`
	WorkspaceID string `json:"workspace_id"`
	GroupID     string `json:"group_id"`
	ChatID      string `json:"chat_id"`
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
	CreatedAt   int64  `json:"created_at"`
}

func (o *Orchestrator) ProcessEmbed(ctx context.Context, job EmbedJob) error {
	_, err := o.ragClient.EmbedAndStore(ctx, &pb_rag.EmbedRequest{
		Content:     job.Content,
		TenantId:    job.TenantID,
		WorkspaceId: job.WorkspaceID,
		GroupId:     job.GroupID,
		ChatId:      job.ChatID,
		UserId:      job.UserID,
		Role:        job.Role,
		CreatedAt:   job.CreatedAt,
	})
	return err
}

func (o *Orchestrator) ProcessInference(ctx context.Context, job InferenceJob) error {
	log.Printf("Starting inference for chat %s", job.ChatID)

	// 1. Retrieve Recent Chat History from Database (PostgreSQL)
	var historyStr string
	rows, err := o.db.Pool.Query(ctx, `
		SELECT m.role, m.content, COALESCE(u.display_name, u.email, 'User') as sender_name
		FROM messages m
		LEFT JOIN users u ON m.user_id = u.id
		WHERE m.chat_id = $1 AND m.is_deleted = false
		ORDER BY m.created_at DESC
		LIMIT 25
	`, job.ChatID)
	if err != nil {
		log.Printf("[orchestrator] Warning: failed to fetch chat history: %v", err)
	} else {
		type histMsg struct {
			role    string
			content string
			sender  string
		}
		var history []histMsg
		for rows.Next() {
			var h histMsg
			if scanErr := rows.Scan(&h.role, &h.content, &h.sender); scanErr == nil {
				history = append(history, h)
			}
		}
		rows.Close()

		// Reverse to chronological order (oldest to newest)
		for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
			history[i], history[j] = history[j], history[i]
		}

		if len(history) > 0 {
			historyStr = "### Recent Conversation History:\n"
			for _, h := range history {
				if h.role == "assistant" {
					historyStr += fmt.Sprintf("- [Nexus AI]: %s\n", h.content)
				} else {
					historyStr += fmt.Sprintf("- [%s]: %s\n", h.sender, h.content)
				}
			}
		}
	}

	// 2. Retrieve Semantic Context from RAG (Qdrant)
	var ragContextStr string
	ragReq := &pb_rag.RetrieveRequest{
		Query:       job.Query,
		TenantId:    job.TenantID,
		GroupId:     job.GroupID,
		ChatId:      job.ChatID,
		WorkspaceId: job.WorkspaceID,
		TopK:        5,
	}

	ragRes, err := o.ragClient.RetrieveContext(ctx, ragReq)
	if err != nil {
		log.Printf("[orchestrator] Warning: RAG retrieval failed (%v). Continuing inference without semantic context.", err)
	} else if ragRes != nil && len(ragRes.Chunks) > 0 {
		ragContextStr = "### Relevant Semantic Knowledge Context:\n"
		for i, chunk := range ragRes.Chunks {
			ragContextStr += fmt.Sprintf("Context %d: %s\n", i+1, chunk.Content)
		}
	}

	// Combine conversation history and semantic knowledge
	var combinedContext string
	if historyStr != "" {
		combinedContext += historyStr + "\n"
	}
	if ragContextStr != "" {
		combinedContext += ragContextStr + "\n"
	}

	// 3. Request Streaming Generation from AI Gateway
	gwReq := &pb_gateway.GenerateRequest{
		Prompt:   job.Query,
		Context:  combinedContext,
		TenantId: job.TenantID,
	}


	stream, err := o.gatewayClient.StreamResponse(ctx, gwReq)
	if err != nil {
		return fmt.Errorf("gateway stream request failed: %w", err)
	}

	// 3. Process Stream and publish to Redis
	var fullResponse string
	messageID := uuid.New().String()

	for {
		chunk, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("Stream read error: %v", err)
			break
		}

		fullResponse += chunk.Delta

		rChunk := redis.AIStreamChunk{
			Delta:     chunk.Delta,
			IsFinal:   chunk.IsFinal,
			MessageID: messageID,
		}

		if pubErr := o.redis.PublishStreamChunk(ctx, job.ChatID, rChunk); pubErr != nil {
			log.Printf("Failed to publish chunk to redis: %v", pubErr)
		}

		if chunk.IsFinal {
			break
		}
	}

	// 4. Save to Database
	var pgMsgID, pgTenant, pgWorkspace, pgGroup, pgChat, pgUser pgtype.UUID
	_ = pgMsgID.Scan(messageID)
	_ = pgTenant.Scan(job.TenantID)
	_ = pgWorkspace.Scan(job.WorkspaceID)
	_ = pgGroup.Scan(job.GroupID)
	_ = pgChat.Scan(job.ChatID)
	if job.UserID != "" && job.UserID != "system" {
		_ = pgUser.Scan(job.UserID)
	}

	_, dbErr := o.db.Queries.InsertMessage(ctx, postgres.InsertMessageParams{
		ID:          pgMsgID,
		TenantID:    pgTenant,
		WorkspaceID: pgWorkspace,
		GroupID:     pgGroup,
		ChatID:      pgChat,
		UserID:      pgUser,
		Role:        "assistant",
		Content:     fullResponse,
	})


	if dbErr != nil {
		return fmt.Errorf("failed to save AI message to database: %w", dbErr)
	}

	// 5. Report token usage to billing service (non-blocking)
	if o.billingClient != nil {
		go func() {
			// Estimate tokens: prompt (~len(query)/4) + completion (~len(fullResponse)/4)
			totalTokens := int32(len(job.Query)/4 + len(fullResponse)/4)
			if totalTokens <= 0 {
				totalTokens = 1
			}
			_, billingErr := o.billingClient.ReportUsage(context.Background(), &pb_billing.ReportRequest{
				TenantId: job.TenantID,
				Tokens:   totalTokens,
			})
			if billingErr != nil {
				log.Printf("[billing] Failed to report usage for tenant %s: %v", job.TenantID, billingErr)
			}
		}()
	}

	log.Printf("Inference completed for chat %s", job.ChatID)
	return nil
}
