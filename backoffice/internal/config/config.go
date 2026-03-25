package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// Supabase
	SupabaseURL        string
	SupabaseAnonKey    string
	SupabaseServiceKey string
	SupabaseJWTSecret  string

	// CORS
	AllowedOrigins []string

	// DJP Integration
	DJPApiURL    string
	DJPApiKey    string
	DJPApiSecret string

	// Midtrans
	MidtransServerKey string

	// Email
	ResendAPIKey string
	EmailFrom    string

	// Logging
	LogLevel string
}

func Load() (*Config, error) {
	// Load .env file (ignore error if not found — production uses real env vars)
	_ = godotenv.Load()

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		Env:                getEnv("APP_ENV", "development"),
		DatabaseURL:        mustGetEnv("DATABASE_URL"),
		SupabaseURL:        mustGetEnv("SUPABASE_URL"),
		SupabaseAnonKey:    mustGetEnv("SUPABASE_ANON_KEY"),
		SupabaseServiceKey: mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTSecret:  mustGetEnv("SUPABASE_JWT_SECRET"),
		AllowedOrigins:     []string{getEnv("CORS_ORIGIN", "http://localhost:3000")},
		DJPApiURL:          getEnv("DJP_API_URL", ""),
		DJPApiKey:          getEnv("DJP_API_KEY", ""),
		DJPApiSecret:       getEnv("DJP_API_SECRET", ""),
		MidtransServerKey:  getEnv("MIDTRANS_SERVER_KEY", ""),
		ResendAPIKey:       getEnv("RESEND_API_KEY", ""),
		EmailFrom:          getEnv("EMAIL_FROM", "AI Pajak <noreply@aipajak.com>"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) PortInt() int {
	p, _ := strconv.Atoi(c.Port)
	if p == 0 {
		return 8080
	}
	return p
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %s is not set", key))
	}
	return v
}
