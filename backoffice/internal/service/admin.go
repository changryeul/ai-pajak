package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminService struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

func NewAdminService(pool *pgxpool.Pool, logger *slog.Logger) *AdminService {
	return &AdminService{pool: pool, logger: logger}
}

type DashboardStats struct {
	TotalCustomers      int            `json:"total_customers"`
	TotalConsultants    int            `json:"total_consultants"`
	TotalFilings        int            `json:"total_filings"`
	FilingsByStatus     map[string]int `json:"filings_by_status"`
	FilingsByType       map[string]int `json:"filings_by_type"`
	RevenueThisMonth    int64          `json:"revenue_this_month"`
	ActiveSubscriptions int            `json:"active_subscriptions"`
	PendingPOAs         int            `json:"pending_poas"`
}

func (s *AdminService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{
		FilingsByStatus: make(map[string]int),
		FilingsByType:   make(map[string]int),
	}

	// Total counts
	queries := []struct {
		query string
		dest  *int
	}{
		{`SELECT COUNT(*) FROM customer`, &stats.TotalCustomers},
		{`SELECT COUNT(*) FROM consultant WHERE is_active = true`, &stats.TotalConsultants},
		{`SELECT COUNT(*) FROM tax_filing`, &stats.TotalFilings},
		{`SELECT COUNT(*) FROM subscription WHERE is_active = true`, &stats.ActiveSubscriptions},
		{`SELECT COUNT(*) FROM power_of_attorney WHERE status = 'PENDING_SIGNATURE'`, &stats.PendingPOAs},
	}

	for _, q := range queries {
		if err := s.pool.QueryRow(ctx, q.query).Scan(q.dest); err != nil {
			return nil, fmt.Errorf("query %s: %w", q.query, err)
		}
	}

	// Revenue this month
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_total), 0)::bigint FROM billing_transaction
		 WHERE payment_status = 'PAID' AND created_at >= date_trunc('month', NOW())`,
	).Scan(&stats.RevenueThisMonth)
	if err != nil {
		return nil, fmt.Errorf("revenue query: %w", err)
	}

	// Filings by status
	rows, err := s.pool.Query(ctx,
		`SELECT status::text, COUNT(*) FROM tax_filing GROUP BY status`)
	if err != nil {
		return nil, fmt.Errorf("filings by status: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.FilingsByStatus[status] = count
	}

	// Filings by type
	rows2, err := s.pool.Query(ctx,
		`SELECT tax_type::text, COUNT(*) FROM tax_filing GROUP BY tax_type`)
	if err != nil {
		return nil, fmt.Errorf("filings by type: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var taxType string
		var count int
		if err := rows2.Scan(&taxType, &count); err != nil {
			return nil, err
		}
		stats.FilingsByType[taxType] = count
	}

	return stats, nil
}
