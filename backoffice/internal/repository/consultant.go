package repository

import (
	"context"
	"fmt"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ConsultantRepo struct {
	pool *pgxpool.Pool
}

func NewConsultantRepo(pool *pgxpool.Pool) *ConsultantRepo {
	return &ConsultantRepo{pool: pool}
}

func (r *ConsultantRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.Consultant, error) {
	var c model.Consultant
	err := r.pool.QueryRow(ctx,
		`SELECT id, tax_partner_id, user_id, employee_id, full_name, email, phone,
				is_active, employment_start_date, created_at, updated_at
		 FROM consultant WHERE user_id = $1 AND is_active = true`, userID,
	).Scan(
		&c.ID, &c.TaxPartnerID, &c.UserID, &c.EmployeeID, &c.FullName,
		&c.Email, &c.Phone, &c.IsActive, &c.EmploymentStartDate,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get consultant by user_id: %w", err)
	}
	return &c, nil
}

func (r *ConsultantRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Consultant, error) {
	var c model.Consultant
	err := r.pool.QueryRow(ctx,
		`SELECT id, tax_partner_id, user_id, employee_id, full_name, email, phone,
				is_active, employment_start_date, created_at, updated_at
		 FROM consultant WHERE id = $1`, id,
	).Scan(
		&c.ID, &c.TaxPartnerID, &c.UserID, &c.EmployeeID, &c.FullName,
		&c.Email, &c.Phone, &c.IsActive, &c.EmploymentStartDate,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get consultant by id: %w", err)
	}
	return &c, nil
}

// GetTaxPartnerID returns the tax_partner_id for a consultant (used for POA validation).
func (r *ConsultantRepo) GetTaxPartnerID(ctx context.Context, consultantID uuid.UUID) (uuid.UUID, error) {
	var taxPartnerID uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT tax_partner_id FROM consultant WHERE id = $1`, consultantID,
	).Scan(&taxPartnerID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("get tax_partner_id: %w", err)
	}
	return taxPartnerID, nil
}

func (r *ConsultantRepo) AssignCustomer(ctx context.Context, customerID, consultantID, assignedByUserID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO customer_consultant (id, customer_id, consultant_id, assigned_by_user_id, is_active, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
		 ON CONFLICT (customer_id, consultant_id) WHERE is_active = true DO NOTHING`,
		customerID, consultantID, assignedByUserID,
	)
	return err
}

func (r *ConsultantRepo) UnassignCustomer(ctx context.Context, customerID, consultantID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE customer_consultant
		 SET is_active = false, updated_at = NOW()
		 WHERE customer_id = $1 AND consultant_id = $2 AND is_active = true`,
		customerID, consultantID,
	)
	return err
}

func (r *ConsultantRepo) ListAssignedCustomerIDs(ctx context.Context, consultantID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT customer_id FROM customer_consultant
		 WHERE consultant_id = $1 AND is_active = true`,
		consultantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}
