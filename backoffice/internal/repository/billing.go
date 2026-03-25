package repository

import (
	"context"
	"fmt"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingRepo struct {
	pool *pgxpool.Pool
}

func NewBillingRepo(pool *pgxpool.Pool) *BillingRepo {
	return &BillingRepo{pool: pool}
}

func (r *BillingRepo) ListInvoices(ctx context.Context, customerID uuid.UUID, page, perPage int) ([]model.BillingTransaction, int, error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM billing_transaction WHERE customer_id = $1`, customerID,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count invoices: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT id, customer_id, transaction_type, amount_total, amount_base, amount_tax,
				currency, payment_status, payment_method, invoice_number, service_type,
				description, billing_period, due_date, paid_at, created_at, updated_at
		 FROM billing_transaction
		 WHERE customer_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		customerID, perPage, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list invoices: %w", err)
	}
	defer rows.Close()

	var invoices []model.BillingTransaction
	for rows.Next() {
		var inv model.BillingTransaction
		if err := rows.Scan(
			&inv.ID, &inv.CustomerID, &inv.TransactionType, &inv.AmountTotal,
			&inv.AmountBase, &inv.AmountTax, &inv.Currency, &inv.PaymentStatus,
			&inv.PaymentMethod, &inv.InvoiceNumber, &inv.ServiceType,
			&inv.Description, &inv.BillingPeriod, &inv.DueDate, &inv.PaidAt,
			&inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan invoice: %w", err)
		}
		invoices = append(invoices, inv)
	}

	return invoices, total, nil
}

func (r *BillingRepo) GetSubscription(ctx context.Context, customerID uuid.UUID) (*model.Subscription, error) {
	var s model.Subscription
	err := r.pool.QueryRow(ctx,
		`SELECT id, customer_id, plan_type, billing_cycle, price,
				current_period_start, current_period_end, is_active,
				cancelled_at, created_at, updated_at
		 FROM subscription
		 WHERE customer_id = $1 AND is_active = true`, customerID,
	).Scan(
		&s.ID, &s.CustomerID, &s.PlanType, &s.BillingCycle, &s.Price,
		&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.IsActive,
		&s.CancelledAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
	}
	return &s, nil
}

func (r *BillingRepo) GetUsageMetrics(ctx context.Context, customerID uuid.UUID) (*model.UsageMetrics, error) {
	var m model.UsageMetrics

	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tax_filing WHERE customer_id = $1`, customerID,
	).Scan(&m.TaxFilingsCount)
	if err != nil {
		return nil, fmt.Errorf("count filings: %w", err)
	}

	err = r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tax_document td
		 JOIN tax_filing tf ON tf.id = td.tax_filing_id
		 WHERE tf.customer_id = $1`, customerID,
	).Scan(&m.DocumentsCount)
	if err != nil {
		return nil, fmt.Errorf("count documents: %w", err)
	}

	err = r.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(td.file_size_bytes), 0) FROM tax_document td
		 JOIN tax_filing tf ON tf.id = td.tax_filing_id
		 WHERE tf.customer_id = $1`, customerID,
	).Scan(&m.StorageBytes)
	if err != nil {
		return nil, fmt.Errorf("sum storage: %w", err)
	}

	return &m, nil
}
