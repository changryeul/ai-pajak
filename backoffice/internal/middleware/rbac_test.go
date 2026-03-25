package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
)

func setSessionContext(r *http.Request, role model.UserRole) *http.Request {
	ctx := r.Context()
	ctx = context.WithValue(ctx, CtxUserID, [16]byte{})
	ctx = context.WithValue(ctx, CtxUserRole, role)
	return r.WithContext(ctx)
}

func TestRequireRole_Allowed(t *testing.T) {
	handler := RequireRole(model.RoleConsultantJTC, model.RoleTaxAdvisorJTC)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest("GET", "/test", nil)
	req = setSessionContext(req, model.RoleConsultantJTC)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestRequireRole_Denied(t *testing.T) {
	handler := RequireRole(model.RoleConsultantJTC)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest("GET", "/test", nil)
	req = setSessionContext(req, model.RoleCustomer)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestBlockPlatformAdmin_Blocked(t *testing.T) {
	handler := BlockPlatformAdmin(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest("GET", "/api/tax/filings", nil)
	req = setSessionContext(req, model.RolePlatformAdmin)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for PLATFORM_ADMIN, got %d", w.Code)
	}
}

func TestBlockPlatformAdmin_Allowed(t *testing.T) {
	handler := BlockPlatformAdmin(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest("GET", "/api/tax/filings", nil)
	req = setSessionContext(req, model.RoleConsultantJTC)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for CONSULTANT, got %d", w.Code)
	}
}
