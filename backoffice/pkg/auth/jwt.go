package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// SupabaseClaims represents the JWT claims from Supabase Auth.
type SupabaseClaims struct {
	jwt.RegisteredClaims
	Email         string                 `json:"email"`
	Role          string                 `json:"role"`
	AppMetadata   map[string]any         `json:"app_metadata"`
	UserMetadata  map[string]any         `json:"user_metadata"`
}

// UserID returns the subject (user ID) as a UUID.
func (c *SupabaseClaims) UserID() (uuid.UUID, error) {
	return uuid.Parse(c.Subject)
}

// VerifyToken parses and validates a Supabase JWT token.
func VerifyToken(tokenString, jwtSecret string) (*SupabaseClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &SupabaseClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*SupabaseClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Check expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, fmt.Errorf("token expired")
	}

	return claims, nil
}
