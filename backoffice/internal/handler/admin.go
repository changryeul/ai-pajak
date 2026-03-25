package handler

import (
	"net/http"

	"github.com/anthropics/ai-pajak-backoffice/internal/response"
	"github.com/anthropics/ai-pajak-backoffice/internal/service"
)

type AdminHandler struct {
	svc *service.AdminService
}

func NewAdminHandler(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

func (h *AdminHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetDashboardStats(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.OK(w, stats)
}
