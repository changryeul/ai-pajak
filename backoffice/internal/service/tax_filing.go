package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/anthropics/ai-pajak-backoffice/internal/middleware"
	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/google/uuid"
)

type TaxFilingService struct {
	filingRepo     *repository.TaxFilingRepo
	poaRepo        *repository.POARepo
	auditRepo      *repository.AuditRepo
	consultantRepo *repository.ConsultantRepo
	logger         *slog.Logger
}

func NewTaxFilingService(
	filingRepo *repository.TaxFilingRepo,
	poaRepo *repository.POARepo,
	auditRepo *repository.AuditRepo,
	consultantRepo *repository.ConsultantRepo,
	logger *slog.Logger,
) *TaxFilingService {
	return &TaxFilingService{
		filingRepo:     filingRepo,
		poaRepo:        poaRepo,
		auditRepo:      auditRepo,
		consultantRepo: consultantRepo,
		logger:         logger,
	}
}

func (s *TaxFilingService) GetByID(ctx context.Context, id uuid.UUID) (*model.TaxFiling, error) {
	return s.filingRepo.GetByID(ctx, id)
}

func (s *TaxFilingService) List(ctx context.Context, params repository.TaxFilingListParams) ([]model.TaxFiling, int, error) {
	return s.filingRepo.List(ctx, params)
}

// UpdateStatus changes filing status with POA validation and audit logging.
// Replaces: validate_tax_filing_poa trigger + tax_filing_audit trigger.
func (s *TaxFilingService) UpdateStatus(ctx context.Context, filingID uuid.UUID, newStatus model.TaxFilingStatus) (*model.TaxFiling, error) {
	session := middleware.GetSession(ctx)

	filing, err := s.filingRepo.GetByID(ctx, filingID)
	if err != nil {
		return nil, fmt.Errorf("get filing: %w", err)
	}

	oldStatus := filing.Status

	// HARD RULE #3: Only TAX_ADVISOR_JTC can submit filings
	if newStatus == model.FilingFiled && session.Role != model.RoleTaxAdvisorJTC {
		return nil, fmt.Errorf("only tax advisors can submit filings")
	}

	// POA validation (replaces validate_tax_filing_poa trigger)
	if newStatus == model.FilingFiled {
		if filing.ConsultantID == nil {
			return nil, fmt.Errorf("consultant is required for filing submission")
		}

		// Look up tax_partner_id from consultant (fixes hardcoded JTC ID)
		taxPartnerID, err := s.consultantRepo.GetTaxPartnerID(ctx, *filing.ConsultantID)
		if err != nil {
			return nil, fmt.Errorf("get tax partner: %w", err)
		}

		hasActivePOA, err := s.poaRepo.HasActivePOA(ctx,
			filing.CustomerID,
			taxPartnerID,
			filing.TaxType,
			time.Now(),
		)
		if err != nil {
			return nil, fmt.Errorf("check POA: %w", err)
		}
		if !hasActivePOA {
			return nil, fmt.Errorf("active power of attorney is required for filing")
		}
	}

	// Execute in transaction
	tx, err := s.filingRepo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	updated, err := s.filingRepo.UpdateStatus(ctx, tx, filingID, newStatus)
	if err != nil {
		return nil, fmt.Errorf("update status: %w", err)
	}

	// Audit log (replaces tax_filing_audit trigger)
	activityType := model.ActivityTaxFilingStatusChange
	if newStatus == model.FilingFiled {
		activityType = model.ActivityTaxFilingSubmit
	}

	err = s.auditRepo.Log(ctx, tx, repository.AuditEntry{
		CustomerID:  filing.CustomerID,
		TaxFilingID: &filingID,
		ActorUserID: session.UserID,
		ActorOrgID:  session.OrganizationID,
		ActorRole:   session.Role,
		ActivityType: activityType,
		TaxType:     &filing.TaxType,
		TaxPeriod:   &filing.TaxPeriod,
		ActivityDetails: map[string]any{
			"old_status": oldStatus,
			"new_status": newStatus,
		},
		IPAddress: &session.IPAddress,
		UserAgent: &session.UserAgent,
	})
	if err != nil {
		s.logger.Error("failed to write audit log", "error", err, "filing_id", filingID)
		return nil, fmt.Errorf("write audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	s.logger.Info("tax filing status updated",
		"filing_id", filingID,
		"old_status", oldStatus,
		"new_status", newStatus,
		"actor", session.UserID,
	)

	return updated, nil
}
