package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/anthropics/ai-pajak-backoffice/internal/config"
	"github.com/anthropics/ai-pajak-backoffice/internal/database"
	"github.com/anthropics/ai-pajak-backoffice/internal/handler"
	mw "github.com/anthropics/ai-pajak-backoffice/internal/middleware"
	"github.com/anthropics/ai-pajak-backoffice/internal/model"
	"github.com/anthropics/ai-pajak-backoffice/internal/repository"
	"github.com/anthropics/ai-pajak-backoffice/internal/service"
	"github.com/anthropics/ai-pajak-backoffice/pkg/logger"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log := logger.New(cfg.LogLevel)
	slog.SetDefault(log)

	ctx := context.Background()
	db, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer db.Close()
	log.Info("database connected")

	// Repositories
	customerRepo := repository.NewCustomerRepo(db.Pool)
	consultantRepo := repository.NewConsultantRepo(db.Pool)
	filingRepo := repository.NewTaxFilingRepo(db.Pool)
	poaRepo := repository.NewPOARepo(db.Pool)
	auditRepo := repository.NewAuditRepo(db.Pool)
	billingRepo := repository.NewBillingRepo(db.Pool)

	// Services
	customerSvc := service.NewCustomerService(customerRepo, log)
	filingSvc := service.NewTaxFilingService(filingRepo, poaRepo, auditRepo, consultantRepo, log)
	billingSvc := service.NewBillingService(billingRepo, log)
	adminSvc := service.NewAdminService(db.Pool, log)

	// Handlers
	healthH := handler.NewHealthHandler(db)
	customerH := handler.NewCustomerHandler(customerSvc, consultantRepo)
	filingH := handler.NewTaxFilingHandler(filingSvc)
	auditH := handler.NewAuditHandler(auditRepo)
	billingH := handler.NewBillingHandler(billingSvc, customerRepo)
	adminH := handler.NewAdminHandler(adminSvc)

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(mw.Logging(log))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public
	r.Get("/health", healthH.Check)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(mw.Auth(cfg.SupabaseJWTSecret, db.Pool, log))

		// --- Customer management (consultant + tax advisor) ---
		r.Route("/api/v1/customers", func(r chi.Router) {
			r.Use(mw.BlockPlatformAdmin)
			r.Use(mw.RequireRole(model.RoleConsultantJTC, model.RoleTaxAdvisorJTC))

			r.Get("/", customerH.List)
			r.Get("/{id}", customerH.GetByID)
			r.Post("/{id}/assign", customerH.AssignConsultant)
			r.Delete("/{id}/assign", customerH.UnassignConsultant)
		})

		// --- Tax filings (consultant + tax advisor) ---
		r.Route("/api/v1/filings", func(r chi.Router) {
			r.Use(mw.BlockPlatformAdmin)
			r.Use(mw.RequireRole(model.RoleConsultantJTC, model.RoleTaxAdvisorJTC))

			r.Get("/", filingH.List)
			r.Get("/{id}", filingH.GetByID)
			r.Put("/{id}/status", filingH.UpdateStatus)
		})

		// --- Audit logs ---
		r.Route("/api/v1/audit", func(r chi.Router) {
			r.Use(mw.RequireRole(model.RolePlatformAdmin, model.RoleConsultantJTC, model.RoleTaxAdvisorJTC))
			r.Get("/customers/{customerID}", auditH.ListByCustomer)
		})

		// --- Billing (customer + consultant + admin) ---
		r.Route("/api/v1/billing", func(r chi.Router) {
			r.Use(mw.RequireRole(model.RoleCustomer, model.RoleConsultantJTC, model.RoleTaxAdvisorJTC, model.RolePlatformAdmin))
			r.Get("/invoices", billingH.ListInvoices)
			r.Get("/subscription", billingH.GetSubscription)
			r.Get("/usage", billingH.GetUsage)
		})

		// --- Admin dashboard (platform admin only) ---
		r.Route("/api/v1/admin", func(r chi.Router) {
			r.Use(mw.RequireRole(model.RolePlatformAdmin))
			r.Get("/dashboard", adminH.Dashboard)
		})
	})

	// Server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("server starting", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
		log.Info("shutting down server...")
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown: %w", err)
	}

	log.Info("server stopped")
	return nil
}
