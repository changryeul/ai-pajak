package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Set required env vars
	os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	os.Setenv("SUPABASE_URL", "https://test.supabase.co")
	os.Setenv("SUPABASE_ANON_KEY", "test-anon-key")
	os.Setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
	os.Setenv("SUPABASE_JWT_SECRET", "test-jwt-secret")
	defer func() {
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("SUPABASE_URL")
		os.Unsetenv("SUPABASE_ANON_KEY")
		os.Unsetenv("SUPABASE_SERVICE_ROLE_KEY")
		os.Unsetenv("SUPABASE_JWT_SECRET")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("expected port 8080, got %s", cfg.Port)
	}
	if cfg.Env != "development" {
		t.Errorf("expected development, got %s", cfg.Env)
	}
	if !cfg.IsDevelopment() {
		t.Error("expected IsDevelopment() to be true")
	}
}
