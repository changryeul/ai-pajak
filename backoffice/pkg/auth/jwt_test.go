package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-jwt-secret-key-for-testing-only"

func createTestToken(t *testing.T, sub string, exp time.Time) string {
	t.Helper()
	claims := &SupabaseClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sub,
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Email: "test@example.com",
		Role:  "authenticated",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func TestVerifyToken_Valid(t *testing.T) {
	tokenStr := createTestToken(t, "550e8400-e29b-41d4-a716-446655440000", time.Now().Add(time.Hour))

	claims, err := VerifyToken(tokenStr, testSecret)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if claims.Subject != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("expected subject 550e8400..., got %s", claims.Subject)
	}
	if claims.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", claims.Email)
	}
}

func TestVerifyToken_Expired(t *testing.T) {
	tokenStr := createTestToken(t, "user-123", time.Now().Add(-time.Hour))

	_, err := VerifyToken(tokenStr, testSecret)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestVerifyToken_WrongSecret(t *testing.T) {
	tokenStr := createTestToken(t, "user-123", time.Now().Add(time.Hour))

	_, err := VerifyToken(tokenStr, "wrong-secret")
	if err == nil {
		t.Fatal("expected error for wrong secret, got nil")
	}
}

func TestVerifyToken_InvalidFormat(t *testing.T) {
	_, err := VerifyToken("not.a.valid.token", testSecret)
	if err == nil {
		t.Fatal("expected error for invalid token, got nil")
	}
}

func TestSupabaseClaims_UserID(t *testing.T) {
	tokenStr := createTestToken(t, "550e8400-e29b-41d4-a716-446655440000", time.Now().Add(time.Hour))
	claims, _ := VerifyToken(tokenStr, testSecret)

	userID, err := claims.UserID()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if userID.String() != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("expected UUID 550e8400..., got %s", userID.String())
	}
}
