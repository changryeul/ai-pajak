package repository

import (
	"context"
	"encoding/json"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditRepo handles explicit audit logging (replaces DB triggers).
type AuditRepo struct {
	pool *pgxpool.Pool
}

func NewAuditRepo(pool *pgxpool.Pool) *AuditRepo {
	return &AuditRepo{pool: pool}
}

type AuditEntry struct {
	CustomerID      uuid.UUID
	TaxFilingID     *uuid.UUID
	ActorUserID     uuid.UUID
	ActorOrgID      *uuid.UUID
	ActorRole       model.UserRole
	ActivityType    model.ActivityType
	TaxType         *model.TaxType
	TaxPeriod       *string
	ActivityDetails any
	IPAddress       *string
	UserAgent       *string
}

// Log inserts an audit log entry. Can use an existing transaction or standalone.
func (r *AuditRepo) Log(ctx context.Context, tx pgx.Tx, entry AuditEntry) error {
	detailsJSON, err := json.Marshal(entry.ActivityDetails)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	const query = `
		INSERT INTO tax_activity_log (
			id, customer_id, tax_filing_id, actor_user_id, actor_organization_id,
			actor_role, activity_type, tax_type, tax_period, activity_details,
			ip_address, user_agent, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
		)`

	if tx != nil {
		_, err = tx.Exec(ctx, query,
			entry.CustomerID, entry.TaxFilingID, entry.ActorUserID, entry.ActorOrgID,
			entry.ActorRole, entry.ActivityType, entry.TaxType, entry.TaxPeriod,
			detailsJSON, entry.IPAddress, entry.UserAgent,
		)
	} else {
		_, err = r.pool.Exec(ctx, query,
			entry.CustomerID, entry.TaxFilingID, entry.ActorUserID, entry.ActorOrgID,
			entry.ActorRole, entry.ActivityType, entry.TaxType, entry.TaxPeriod,
			detailsJSON, entry.IPAddress, entry.UserAgent,
		)
	}

	return err
}

// ListByCustomer returns audit logs for a customer with pagination.
func (r *AuditRepo) ListByCustomer(ctx context.Context, customerID uuid.UUID, page, perPage int) ([]model.TaxActivityLog, int, error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tax_activity_log WHERE customer_id = $1`, customerID,
	).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx,
		`SELECT id, customer_id, tax_filing_id, actor_user_id, actor_organization_id,
				actor_role, activity_type, tax_type, tax_period, activity_details,
				ip_address, user_agent, created_at
		 FROM tax_activity_log
		 WHERE customer_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		customerID, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []model.TaxActivityLog
	for rows.Next() {
		var log model.TaxActivityLog
		if err := rows.Scan(
			&log.ID, &log.CustomerID, &log.TaxFilingID, &log.ActorUserID,
			&log.ActorOrganizationID, &log.ActorRole, &log.ActivityType,
			&log.TaxType, &log.TaxPeriod, &log.ActivityDetails,
			&log.IPAddress, &log.UserAgent, &log.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	return logs, total, nil
}
