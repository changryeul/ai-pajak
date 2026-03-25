package handler

import (
	"net/http"
	"strconv"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type AuditHandler struct {
	auditRepo *repository.AuditRepo
}

func NewAuditHandler(auditRepo *repository.AuditRepo) *AuditHandler {
	return &AuditHandler{auditRepo: auditRepo}
}

func (h *AuditHandler) ListByCustomer(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "customerID"))
	if err != nil {
		response.BadRequest(w, "invalid customer ID")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	logs, total, err := h.auditRepo.ListByCustomer(r.Context(), customerID, page, perPage)
	if err != nil {
		response.InternalError(w)
		return
	}

	response.OK(w, model.PaginatedResult[model.TaxActivityLog]{
		Data: logs,
		Pagination: model.Pagination{
			Page:    page,
			PerPage: perPage,
			Total:   total,
		},
	})
}
