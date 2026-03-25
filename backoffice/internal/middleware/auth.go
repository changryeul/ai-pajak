package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/anthropics/ai-pajak-backoffice/pkg/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const (
	CtxUserID           contextKey = "user_id"
	CtxUserRole         contextKey = "user_role"
	CtxOrganizationID   contextKey = "organization_id"
	CtxOrganizationType contextKey = "organization_type"
	CtxIPAddress        contextKey = "ip_address"
	CtxUserAgent        contextKey = "user_agent"
)

// SessionContext holds extracted auth context.
type SessionContext struct {
	UserID           uuid.UUID
	Role             model.UserRole
	OrganizationID   *uuid.UUID
	OrganizationType *string
	IPAddress        string
	UserAgent        string
}

// GetSession extracts SessionContext from the request context.
func GetSession(ctx context.Context) *SessionContext {
	userID, _ := ctx.Value(CtxUserID).(uuid.UUID)
	role, _ := ctx.Value(CtxUserRole).(model.UserRole)
	orgID, _ := ctx.Value(CtxOrganizationID).(*uuid.UUID)
	orgType, _ := ctx.Value(CtxOrganizationType).(*string)
	ip, _ := ctx.Value(CtxIPAddress).(string)
	ua, _ := ctx.Value(CtxUserAgent).(string)

	return &SessionContext{
		UserID:           userID,
		Role:             role,
		OrganizationID:   orgID,
		OrganizationType: orgType,
		IPAddress:        ip,
		UserAgent:        ua,
	}
}

// Auth verifies the Supabase JWT and loads user role from the database.
func Auth(jwtSecret string, pool *pgxpool.Pool, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Unauthorized(w)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				response.Unauthorized(w)
				return
			}

			// Verify JWT
			claims, err := auth.VerifyToken(tokenString, jwtSecret)
			if err != nil {
				logger.Warn("invalid token", "error", err)
				response.Unauthorized(w)
				return
			}

			userID, err := claims.UserID()
			if err != nil {
				logger.Warn("invalid user ID in token", "error", err)
				response.Unauthorized(w)
				return
			}

			// Load user role from database
			var roleRecord model.UserRoleRecord
			err = pool.QueryRow(r.Context(),
				`SELECT id, user_id, role, organization_id, organization_type, is_active
				 FROM user_roles
				 WHERE user_id = $1 AND is_active = true
				 LIMIT 1`,
				userID,
			).Scan(
				&roleRecord.ID,
				&roleRecord.UserID,
				&roleRecord.Role,
				&roleRecord.OrganizationID,
				&roleRecord.OrganizationType,
				&roleRecord.IsActive,
			)
			if err != nil {
				logger.Warn("user role not found", "user_id", userID, "error", err)
				response.Forbidden(w, "no active role found")
				return
			}

			// Extract client info
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}

			// Set context values
			ctx := r.Context()
			ctx = context.WithValue(ctx, CtxUserID, userID)
			ctx = context.WithValue(ctx, CtxUserRole, roleRecord.Role)
			ctx = context.WithValue(ctx, CtxOrganizationID, roleRecord.OrganizationID)
			ctx = context.WithValue(ctx, CtxOrganizationType, roleRecord.OrganizationType)
			ctx = context.WithValue(ctx, CtxIPAddress, ip)
			ctx = context.WithValue(ctx, CtxUserAgent, r.UserAgent())

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
