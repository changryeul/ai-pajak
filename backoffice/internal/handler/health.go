package handler

import (
	"net/http"

	"github.com/anthropics/ai-pajak-backoffice/internal/database"
	"github.com/anthropics/ai-pajak-backoffice/internal/response"
)

type HealthHandler struct {
	db *database.DB
}

func NewHealthHandler(db *database.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Health(r.Context()); err != nil {
		response.JSON(w, http.StatusServiceUnavailable, map[string]any{
			"status":   "unhealthy",
			"database": "disconnected",
		})
		return
	}

	stats := h.db.Stats()
	response.OK(w, map[string]any{
		"status":   "healthy",
		"database": "connected",
		"pool": map[string]any{
			"total":    stats.TotalConns(),
			"idle":     stats.IdleConns(),
			"acquired": stats.AcquiredConns(),
		},
	})
}
