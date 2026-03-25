package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/anthropics/ai-pajak-backoffice/internal/middleware"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/anthropics/ai-pajak-backoffice/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CustomerHandler struct {
	svc            *service.CustomerService
	consultantRepo *repository.ConsultantRepo
}

func NewCustomerHandler(svc *service.CustomerService, consultantRepo *repository.ConsultantRepo) *CustomerHandler {
	return &CustomerHandler{svc: svc, consultantRepo: consultantRepo}
}

func (h *CustomerHandler) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	params := repository.CustomerListParams{
		Page:    page,
		PerPage: perPage,
		Search:  r.URL.Query().Get("search"),
	}

	result, err := h.svc.List(r.Context(), params)
	if err != nil {
		response.InternalError(w)
		return
	}

	response.OK(w, result)
}

func (h *CustomerHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid customer ID")
		return
	}

	customer, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}

	response.OK(w, customer)
}

type assignRequest struct {
	ConsultantID uuid.UUID `json:"consultant_id"`
}

func (h *CustomerHandler) AssignConsultant(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid customer ID")
		return
	}

	var req assignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	session := middleware.GetSession(r.Context())
	err = h.consultantRepo.AssignCustomer(r.Context(), customerID, req.ConsultantID, session.UserID)
	if err != nil {
		response.ErrorWithCode(w, http.StatusUnprocessableEntity, err.Error(), "ASSIGN_FAILED")
		return
	}

	response.Created(w, map[string]string{"status": "assigned"})
}

func (h *CustomerHandler) UnassignConsultant(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid customer ID")
		return
	}

	var req assignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	err = h.consultantRepo.UnassignCustomer(r.Context(), customerID, req.ConsultantID)
	if err != nil {
		response.ErrorWithCode(w, http.StatusUnprocessableEntity, err.Error(), "UNASSIGN_FAILED")
		return
	}

	response.NoContent(w)
}
