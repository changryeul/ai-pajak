package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/anthropics/ai-pajak-backoffice/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type TaxFilingHandler struct {
	svc *service.TaxFilingService
}

func NewTaxFilingHandler(svc *service.TaxFilingService) *TaxFilingHandler {
	return &TaxFilingHandler{svc: svc}
}

func (h *TaxFilingHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	params := repository.TaxFilingListParams{
		Page:    page,
		PerPage: perPage,
	}

	if customerID := r.URL.Query().Get("customer_id"); customerID != "" {
		id, err := uuid.Parse(customerID)
		if err == nil {
			params.CustomerID = &id
		}
	}
	if status := r.URL.Query().Get("status"); status != "" {
		s := model.TaxFilingStatus(status)
		params.Status = &s
	}
	if taxType := r.URL.Query().Get("tax_type"); taxType != "" {
		t := model.TaxType(taxType)
		params.TaxType = &t
	}

	filings, total, err := h.svc.List(r.Context(), params)
	if err != nil {
		response.InternalError(w)
		return
	}

	response.OK(w, model.PaginatedResult[model.TaxFiling]{
		Data: filings,
		Pagination: model.Pagination{
			Page:    page,
			PerPage: perPage,
			Total:   total,
		},
	})
}

func (h *TaxFilingHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid filing ID")
		return
	}

	filing, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}

	response.OK(w, filing)
}

type updateStatusRequest struct {
	Status model.TaxFilingStatus `json:"status"`
}

func (h *TaxFilingHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid filing ID")
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	// Validate status value
	switch req.Status {
	case model.FilingDraft, model.FilingUnderReview, model.FilingFiled, model.FilingRejected:
		// valid
	default:
		response.BadRequest(w, "invalid status")
		return
	}

	filing, err := h.svc.UpdateStatus(r.Context(), id, req.Status)
	if err != nil {
		response.ErrorWithCode(w, http.StatusUnprocessableEntity, err.Error(), "VALIDATION_ERROR")
		return
	}

	response.OK(w, filing)
}
