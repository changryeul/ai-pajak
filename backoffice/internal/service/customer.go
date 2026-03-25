package service

import (
	"context"
	"log/slog"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/google/uuid"
)

type CustomerService struct {
	customerRepo *repository.CustomerRepo
	logger       *slog.Logger
}

func NewCustomerService(customerRepo *repository.CustomerRepo, logger *slog.Logger) *CustomerService {
	return &CustomerService{
		customerRepo: customerRepo,
		logger:       logger,
	}
}

func (s *CustomerService) GetByID(ctx context.Context, id uuid.UUID) (*model.Customer, error) {
	return s.customerRepo.GetByID(ctx, id)
}

func (s *CustomerService) List(ctx context.Context, params repository.CustomerListParams) (*model.PaginatedResult[model.Customer], error) {
	customers, total, err := s.customerRepo.List(ctx, params)
	if err != nil {
		return nil, err
	}

	return &model.PaginatedResult[model.Customer]{
		Data: customers,
		Pagination: model.Pagination{
			Page:    params.Page,
			PerPage: params.PerPage,
			Total:   total,
		},
	}, nil
}
