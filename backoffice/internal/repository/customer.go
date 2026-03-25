package repository

import (
	"context"
	"fmt"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomerRepo struct {
	pool *pgxpool.Pool
}

func NewCustomerRepo(pool *pgxpool.Pool) *CustomerRepo {
	return &CustomerRepo{pool: pool}
}

func (r *CustomerRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Customer, error) {
	var c model.Customer
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, customer_type, npwp, nik, full_name, company_name,
				email, phone, address, created_at, updated_at
		 FROM customer WHERE id = $1`, id,
	).Scan(
		&c.ID, &c.UserID, &c.CustomerType, &c.NPWP, &c.NIK, &c.FullName,
		&c.CompanyName, &c.Email, &c.Phone, &c.Address, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get customer by id: %w", err)
	}
	return &c, nil
}

type CustomerListParams struct {
	Page         int
	PerPage      int
	Search       string
	CustomerType *model.CustomerType
}

func (r *CustomerRepo) List(ctx context.Context, params CustomerListParams) ([]model.Customer, int, error) {
	// Count query
	countQuery := `SELECT COUNT(*) FROM customer WHERE 1=1`
	listQuery := `SELECT id, user_id, customer_type, npwp, nik, full_name, company_name,
					email, phone, address, created_at, updated_at
				   FROM customer WHERE 1=1`
	var args []any
	argIdx := 1

	if params.Search != "" {
		filter := fmt.Sprintf(` AND (full_name ILIKE $%d OR email ILIKE $%d OR npwp ILIKE $%d)`, argIdx, argIdx, argIdx)
		countQuery += filter
		listQuery += filter
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}

	if params.CustomerType != nil {
		filter := fmt.Sprintf(` AND customer_type = $%d`, argIdx)
		countQuery += filter
		listQuery += filter
		args = append(args, *params.CustomerType)
		argIdx++
	}

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count customers: %w", err)
	}

	offset := (params.Page - 1) * params.PerPage
	listQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, params.PerPage, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list customers: %w", err)
	}
	defer rows.Close()

	var customers []model.Customer
	for rows.Next() {
		var c model.Customer
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.CustomerType, &c.NPWP, &c.NIK, &c.FullName,
			&c.CompanyName, &c.Email, &c.Phone, &c.Address, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan customer: %w", err)
		}
		customers = append(customers, c)
	}

	return customers, total, nil
}

func (r *CustomerRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.Customer, error) {
	var c model.Customer
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, customer_type, npwp, nik, full_name, company_name,
				email, phone, address, created_at, updated_at
		 FROM customer WHERE user_id = $1`, userID,
	).Scan(
		&c.ID, &c.UserID, &c.CustomerType, &c.NPWP, &c.NIK, &c.FullName,
		&c.CompanyName, &c.Email, &c.Phone, &c.Address, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get customer by user_id: %w", err)
	}
	return &c, nil
}

// Update updates customer fields and explicitly sets updated_at (no trigger).
func (r *CustomerRepo) Update(ctx context.Context, id uuid.UUID, fullName, email string, phone, address *string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE customer
		 SET full_name = $2, email = $3, phone = $4, address = $5, updated_at = NOW()
		 WHERE id = $1`,
		id, fullName, email, phone, address,
	)
	return err
}
