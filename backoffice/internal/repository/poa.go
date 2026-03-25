package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type POARepo struct {
	pool *pgxpool.Pool
}

func NewPOARepo(pool *pgxpool.Pool) *POARepo {
	return &POARepo{pool: pool}
}

// HasActivePOA checks for an active POA covering the specified tax type and date.
// This replaces the validate_tax_filing_poa trigger.
func (r *POARepo) HasActivePOA(ctx context.Context, customerID, taxPartnerID uuid.UUID, taxType model.TaxType, filingDate time.Time) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM power_of_attorney
			WHERE customer_id = $1
			  AND tax_partner_id = $2
			  AND status = 'ACTIVE'
			  AND valid_from <= $3
			  AND valid_to >= $3
			  AND (
				scope = 'ALL_TAX_TYPES'
				OR (scope = 'PPh21_ONLY' AND $4 = 'PPh21')
				OR (scope = 'PPh23_ONLY' AND $4 = 'PPh23')
				OR (scope = 'PPN_ONLY' AND $4 = 'PPN')
				OR (scope = 'SPT_TAHUNAN_ONLY' AND $4 = 'SPT_TAHUNAN')
			  )
		)`,
		customerID, taxPartnerID, filingDate, taxType,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check active POA: %w", err)
	}
	return exists, nil
}

// GeneratePOANumber generates a new POA number using the sequence.
// This replaces the generate_poa_number trigger.
func (r *POARepo) GeneratePOANumber(ctx context.Context) (string, error) {
	var poaNumber string
	err := r.pool.QueryRow(ctx,
		`SELECT 'POA-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('poa_number_seq')::TEXT, 6, '0')`,
	).Scan(&poaNumber)
	if err != nil {
		return "", fmt.Errorf("generate POA number: %w", err)
	}
	return poaNumber, nil
}

func (r *POARepo) GetByID(ctx context.Context, id uuid.UUID) (*model.PowerOfAttorney, error) {
	var poa model.PowerOfAttorney
	err := r.pool.QueryRow(ctx,
		`SELECT id, customer_id, tax_partner_id, poa_number, scope, scope_details,
				valid_from, valid_to, status, created_at, updated_at
		 FROM power_of_attorney WHERE id = $1`, id,
	).Scan(
		&poa.ID, &poa.CustomerID, &poa.TaxPartnerID, &poa.POANumber,
		&poa.Scope, &poa.ScopeDetails, &poa.ValidFrom, &poa.ValidTo,
		&poa.Status, &poa.CreatedAt, &poa.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get POA: %w", err)
	}
	return &poa, nil
}

func (r *POARepo) ListByCustomer(ctx context.Context, customerID uuid.UUID) ([]model.PowerOfAttorney, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, customer_id, tax_partner_id, poa_number, scope, scope_details,
				valid_from, valid_to, status, created_at, updated_at
		 FROM power_of_attorney
		 WHERE customer_id = $1
		 ORDER BY created_at DESC`, customerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var poas []model.PowerOfAttorney
	for rows.Next() {
		var poa model.PowerOfAttorney
		if err := rows.Scan(
			&poa.ID, &poa.CustomerID, &poa.TaxPartnerID, &poa.POANumber,
			&poa.Scope, &poa.ScopeDetails, &poa.ValidFrom, &poa.ValidTo,
			&poa.Status, &poa.CreatedAt, &poa.UpdatedAt,
		); err != nil {
			return nil, err
		}
		poas = append(poas, poa)
	}
	return poas, nil
}
