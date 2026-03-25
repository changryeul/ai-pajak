package response

import (
	"encoding/json"
	"net/http"
)

type ErrorBody struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details any    `json:"details,omitempty"`
}

type SuccessBody struct {
	Data    any    `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
}

func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func OK(w http.ResponseWriter, data any) {
	JSON(w, http.StatusOK, SuccessBody{Data: data})
}

func Created(w http.ResponseWriter, data any) {
	JSON(w, http.StatusCreated, SuccessBody{Data: data})
}

func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, ErrorBody{Error: message})
}

func ErrorWithCode(w http.ResponseWriter, status int, message, code string) {
	JSON(w, status, ErrorBody{Error: message, Code: code})
}

func BadRequest(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, message)
}

func Unauthorized(w http.ResponseWriter) {
	Error(w, http.StatusUnauthorized, "unauthorized")
}

func Forbidden(w http.ResponseWriter, message string) {
	ErrorWithCode(w, http.StatusForbidden, message, "FORBIDDEN")
}

func NotFound(w http.ResponseWriter) {
	Error(w, http.StatusNotFound, "not found")
}

func InternalError(w http.ResponseWriter) {
	Error(w, http.StatusInternalServerError, "internal server error")
}
