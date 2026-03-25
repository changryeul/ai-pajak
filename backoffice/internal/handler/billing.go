package handler

import (
	"net/http"
	"strconv"

	"github.com/anthropics/ai-pajak-backoffice/internal/middleware"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/anthropics/ai-pajak-backoffice/internal/service"
	"github.com/google/uuid"
)

type BillingHandler struct {
	billingSvc     *service.BillingService
	customerRepo   *repository.CustomerRepo
}

func NewBillingHandler(billingSvc *service.BillingService, customerRepo *repository.CustomerRepo) *BillingHandler {
	return &BillingHandler{billingSvc: billingSvc, customerRepo: customerRepo}
}

func (h *BillingHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	customerID, err := h.resolveCustomerID(r)
	if err != nil {
		response.BadRequest(w, "cannot resolve customer")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	result, err := h.billingSvc.ListInvoices(r.Context(), customerID, page, perPage)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, result)
}

func (h *BillingHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	customerID, err := h.resolveCustomerID(r)
	if err != nil {
		response.BadRequest(w, "cannot resolve customer")
		return
	}

	sub, err := h.billingSvc.GetSubscription(r.Context(), customerID)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.OK(w, sub)
}

func (h *BillingHandler) GetUsage(w http.ResponseWriter, r *http.Request) {
	customerID, err := h.resolveCustomerID(r)
	if err != nil {
		response.BadRequest(w, "cannot resolve customer")
		return
	}

	metrics, err := h.billingSvc.GetUsageMetrics(r.Context(), customerID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, metrics)
}

// resolveCustomerID gets customer_id from query param or from the authenticated user's customer record.
func (h *BillingHandler) resolveCustomerID(r *http.Request) (uuid.UUID, error) {
	// If customer_id is provided as query param (for admin/consultant)
	if cidStr := r.URL.Query().Get("customer_id"); cidStr != "" {
		return uuid.Parse(cidStr)
	}

	// Otherwise resolve from authenticated user
	session := middleware.GetSession(r.Context())
	customer, err := h.customerRepo.GetByUserID(r.Context(), session.UserID)
	if err != nil {
		return uuid.Nil, err
	}
	return customer.ID, nil
}
