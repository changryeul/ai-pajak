package service

import (
	"context"
	"log/slog"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/google/uuid"
)

type BillingService struct {
	billingRepo *repository.BillingRepo
	logger      *slog.Logger
}

func NewBillingService(billingRepo *repository.BillingRepo, logger *slog.Logger) *BillingService {
	return &BillingService{billingRepo: billingRepo, logger: logger}
}

func (s *BillingService) ListInvoices(ctx context.Context, customerID uuid.UUID, page, perPage int) (*model.PaginatedResult[model.BillingTransaction], error) {
	invoices, total, err := s.billingRepo.ListInvoices(ctx, customerID, page, perPage)
	if err != nil {
		return nil, err
	}
	return &model.PaginatedResult[model.BillingTransaction]{
		Data: invoices,
		Pagination: model.Pagination{
			Page:    page,
			PerPage: perPage,
			Total:   total,
		},
	}, nil
}

func (s *BillingService) GetSubscription(ctx context.Context, customerID uuid.UUID) (*model.Subscription, error) {
	return s.billingRepo.GetSubscription(ctx, customerID)
}

func (s *BillingService) GetUsageMetrics(ctx context.Context, customerID uuid.UUID) (*model.UsageMetrics, error) {
	return s.billingRepo.GetUsageMetrics(ctx, customerID)
}
