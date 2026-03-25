package middleware

import (
	"net/http"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
)

// RequireRole restricts access to specified roles.
func RequireRole(roles ...model.UserRole) func(http.Handler) http.Handler {
	allowed := make(map[model.UserRole]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session := GetSession(r.Context())
			if !allowed[session.Role] {
				response.Forbidden(w, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// BlockPlatformAdmin enforces Hard Rule #1: PLATFORM_ADMIN cannot access customer tax data.
func BlockPlatformAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session := GetSession(r.Context())
		if session.Role == model.RolePlatformAdmin {
			response.ErrorWithCode(w, http.StatusForbidden,
				"platform admin cannot access customer tax data",
				"PLATFORM_ADMIN_BLOCKED",
			)
			return
		}
		next.ServeHTTP(w, r)
	})
}
