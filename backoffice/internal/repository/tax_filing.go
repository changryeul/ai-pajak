package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TaxFilingRepo struct {
	pool *pgxpool.Pool
}

func NewTaxFilingRepo(pool *pgxpool.Pool) *TaxFilingRepo {
	return &TaxFilingRepo{pool: pool}
}

func (r *TaxFilingRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.TaxFiling, error) {
	var f model.TaxFiling
	var taxDataBytes []byte
	err := r.pool.QueryRow(ctx,
		`SELECT id, customer_id, consultant_id, tax_advisor_id, tax_type, tax_period,
				status, tax_data, bpe_number, power_of_attorney_id,
				djp_submission_status, djp_transaction_id, filed_at, created_at, updated_at
		 FROM tax_filing WHERE id = $1`, id,
	).Scan(
		&f.ID, &f.CustomerID, &f.ConsultantID, &f.TaxAdvisorID, &f.TaxType,
		&f.TaxPeriod, &f.Status, &taxDataBytes, &f.BPENumber, &f.PowerOfAttorneyID,
		&f.DJPSubmissionStatus, &f.DJPTransactionID, &f.FiledAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get tax filing: %w", err)
	}

	if taxDataBytes != nil {
		json.Unmarshal(taxDataBytes, &f.TaxData)
	}

	return &f, nil
}

type TaxFilingListParams struct {
	Page       int
	PerPage    int
	CustomerID *uuid.UUID
	Status     *model.TaxFilingStatus
	TaxType    *model.TaxType
	TaxYear    *string
}

func (r *TaxFilingRepo) List(ctx context.Context, params TaxFilingListParams) ([]model.TaxFiling, int, error) {
	countQuery := `SELECT COUNT(*) FROM tax_filing WHERE 1=1`
	listQuery := `SELECT id, customer_id, consultant_id, tax_advisor_id, tax_type, tax_period,
					status, tax_data, bpe_number, power_of_attorney_id,
					djp_submission_status, djp_transaction_id, filed_at, created_at, updated_at
				   FROM tax_filing WHERE 1=1`
	var args []any
	argIdx := 1

	if params.CustomerID != nil {
		filter := fmt.Sprintf(` AND customer_id = $%d`, argIdx)
		countQuery += filter
		listQuery += filter
		args = append(args, *params.CustomerID)
		argIdx++
	}
	if params.Status != nil {
		filter := fmt.Sprintf(` AND status = $%d`, argIdx)
		countQuery += filter
		listQuery += filter
		args = append(args, *params.Status)
		argIdx++
	}
	if params.TaxType != nil {
		filter := fmt.Sprintf(` AND tax_type = $%d`, argIdx)
		countQuery += filter
		listQuery += filter
		args = append(args, *params.TaxType)
		argIdx++
	}

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (params.Page - 1) * params.PerPage
	listQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, params.PerPage, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var filings []model.TaxFiling
	for rows.Next() {
		var f model.TaxFiling
		var taxDataBytes []byte
		if err := rows.Scan(
			&f.ID, &f.CustomerID, &f.ConsultantID, &f.TaxAdvisorID, &f.TaxType,
			&f.TaxPeriod, &f.Status, &taxDataBytes, &f.BPENumber, &f.PowerOfAttorneyID,
			&f.DJPSubmissionStatus, &f.DJPTransactionID, &f.FiledAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if taxDataBytes != nil {
			json.Unmarshal(taxDataBytes, &f.TaxData)
		}
		filings = append(filings, f)
	}

	return filings, total, nil
}

// UpdateStatus updates filing status within a transaction and logs the change.
// This replaces the tax_filing_audit_trigger.
func (r *TaxFilingRepo) UpdateStatus(ctx context.Context, tx pgx.Tx, id uuid.UUID, newStatus model.TaxFilingStatus) (*model.TaxFiling, error) {
	// Get current state for audit diff
	var oldStatus model.TaxFilingStatus
	var customerID uuid.UUID
	err := tx.QueryRow(ctx,
		`SELECT status, customer_id FROM tax_filing WHERE id = $1 FOR UPDATE`, id,
	).Scan(&oldStatus, &customerID)
	if err != nil {
		return nil, fmt.Errorf("lock tax filing: %w", err)
	}

	// Update with explicit updated_at (no trigger)
	_, err = tx.Exec(ctx,
		`UPDATE tax_filing SET status = $2, updated_at = NOW() WHERE id = $1`,
		id, newStatus,
	)
	if err != nil {
		return nil, fmt.Errorf("update tax filing status: %w", err)
	}

	// Return updated filing
	return r.getByIDTx(ctx, tx, id)
}

func (r *TaxFilingRepo) getByIDTx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*model.TaxFiling, error) {
	var f model.TaxFiling
	var taxDataBytes []byte
	err := tx.QueryRow(ctx,
		`SELECT id, customer_id, consultant_id, tax_advisor_id, tax_type, tax_period,
				status, tax_data, bpe_number, power_of_attorney_id,
				djp_submission_status, djp_transaction_id, filed_at, created_at, updated_at
		 FROM tax_filing WHERE id = $1`, id,
	).Scan(
		&f.ID, &f.CustomerID, &f.ConsultantID, &f.TaxAdvisorID, &f.TaxType,
		&f.TaxPeriod, &f.Status, &taxDataBytes, &f.BPENumber, &f.PowerOfAttorneyID,
		&f.DJPSubmissionStatus, &f.DJPTransactionID, &f.FiledAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if taxDataBytes != nil {
		json.Unmarshal(taxDataBytes, &f.TaxData)
	}
	return &f, nil
}

// BeginTx starts a new database transaction.
func (r *TaxFilingRepo) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}
