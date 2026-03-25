package model

import (
	"time"

	"github.com/google/uuid"
)

// Enums matching PostgreSQL types

type UserRole string

const (
	RoleCustomer      UserRole = "CUSTOMER"
	RoleConsultantJTC UserRole = "CONSULTANT_JTC"
	RoleTaxAdvisorJTC UserRole = "TAX_ADVISOR_JTC"
	RolePlatformAdmin UserRole = "PLATFORM_ADMIN"
	RoleSystem        UserRole = "SYSTEM"
)

type CustomerType string

const (
	CustomerIndividual CustomerType = "INDIVIDUAL"
	CustomerCompany    CustomerType = "COMPANY"
)

type TaxType string

const (
	TaxPPh21       TaxType = "PPh21"
	TaxPPh23       TaxType = "PPh23"
	TaxPPhFinal    TaxType = "PPh_FINAL"
	TaxPPN         TaxType = "PPN"
	TaxSPTMasa     TaxType = "SPT_MASA"
	TaxSPTTahunan  TaxType = "SPT_TAHUNAN"
)

type TaxFilingStatus string

const (
	FilingDraft       TaxFilingStatus = "DRAFT"
	FilingUnderReview TaxFilingStatus = "UNDER_REVIEW"
	FilingFiled       TaxFilingStatus = "FILED"
	FilingRejected    TaxFilingStatus = "REJECTED"
)

type POAStatus string

const (
	POADraft            POAStatus = "DRAFT"
	POAPendingSignature POAStatus = "PENDING_SIGNATURE"
	POAActive           POAStatus = "ACTIVE"
	POAExpired          POAStatus = "EXPIRED"
	POARevoked          POAStatus = "REVOKED"
	POARejected         POAStatus = "REJECTED"
)

type POAScope string

const (
	POAScopeAllTax      POAScope = "ALL_TAX_TYPES"
	POAScopePPh21       POAScope = "PPh21_ONLY"
	POAScopePPh23       POAScope = "PPh23_ONLY"
	POAScopePPN         POAScope = "PPN_ONLY"
	POAScopeSPTTahunan  POAScope = "SPT_TAHUNAN_ONLY"
	POAScopeCustom      POAScope = "CUSTOM"
)

type ActivityType string

const (
	ActivityCreate                ActivityType = "CREATE"
	ActivityUpdate                ActivityType = "UPDATE"
	ActivityReview                ActivityType = "REVIEW"
	ActivityFile                  ActivityType = "FILE"
	ActivityDownload              ActivityType = "DOWNLOAD"
	ActivityDelete                ActivityType = "DELETE"
	ActivityView                  ActivityType = "VIEW"
	ActivityPOACreated            ActivityType = "POA_CREATED"
	ActivityPOASigned             ActivityType = "POA_SIGNED"
	ActivityPOAActivated          ActivityType = "POA_ACTIVATED"
	ActivityPOARevoked            ActivityType = "POA_REVOKED"
	ActivityTaxFilingSubmit       ActivityType = "TAX_FILING_SUBMIT"
	ActivityTaxFilingUpdate       ActivityType = "TAX_FILING_UPDATE"
	ActivityTaxFilingStatusChange ActivityType = "TAX_FILING_STATUS_CHANGE"
)

// Core models

type Customer struct {
	ID           uuid.UUID    `json:"id"`
	UserID       uuid.UUID    `json:"user_id"`
	CustomerType CustomerType `json:"customer_type"`
	NPWP         *string      `json:"npwp"`
	NIK          *string      `json:"nik"`
	FullName     string       `json:"full_name"`
	CompanyName  *string      `json:"company_name"`
	Email        string       `json:"email"`
	Phone        *string      `json:"phone"`
	Address      *string      `json:"address"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

type Consultant struct {
	ID                  uuid.UUID  `json:"id"`
	TaxPartnerID        uuid.UUID  `json:"tax_partner_id"`
	UserID              uuid.UUID  `json:"user_id"`
	EmployeeID          *string    `json:"employee_id"`
	FullName            string     `json:"full_name"`
	Email               string     `json:"email"`
	Phone               *string    `json:"phone"`
	IsActive            bool       `json:"is_active"`
	EmploymentStartDate *time.Time `json:"employment_start_date"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type TaxFiling struct {
	ID                  uuid.UUID       `json:"id"`
	CustomerID          uuid.UUID       `json:"customer_id"`
	ConsultantID        *uuid.UUID      `json:"consultant_id"`
	TaxAdvisorID        *uuid.UUID      `json:"tax_advisor_id"`
	TaxType             TaxType         `json:"tax_type"`
	TaxPeriod           string          `json:"tax_period"`
	Status              TaxFilingStatus `json:"status"`
	TaxData             any             `json:"tax_data"`
	BPENumber           *string         `json:"bpe_number"`
	PowerOfAttorneyID   *uuid.UUID      `json:"power_of_attorney_id"`
	DJPSubmissionStatus *string         `json:"djp_submission_status"`
	DJPTransactionID    *string         `json:"djp_transaction_id"`
	FiledAt             *time.Time      `json:"filed_at"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

type PowerOfAttorney struct {
	ID            uuid.UUID `json:"id"`
	CustomerID    uuid.UUID `json:"customer_id"`
	TaxPartnerID  uuid.UUID `json:"tax_partner_id"`
	POANumber     string    `json:"poa_number"`
	Scope         POAScope  `json:"scope"`
	ScopeDetails  any       `json:"scope_details"`
	ValidFrom     time.Time `json:"valid_from"`
	ValidTo       time.Time `json:"valid_to"`
	Status        POAStatus `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type TaxActivityLog struct {
	ID                  uuid.UUID    `json:"id"`
	CustomerID          uuid.UUID    `json:"customer_id"`
	TaxFilingID         *uuid.UUID   `json:"tax_filing_id"`
	ActorUserID         uuid.UUID    `json:"actor_user_id"`
	ActorOrganizationID *uuid.UUID   `json:"actor_organization_id"`
	ActorRole           UserRole     `json:"actor_role"`
	ActivityType        ActivityType `json:"activity_type"`
	TaxType             *TaxType     `json:"tax_type"`
	TaxPeriod           *string      `json:"tax_period"`
	ActivityDetails     any          `json:"activity_details"`
	IPAddress           *string      `json:"ip_address"`
	UserAgent           *string      `json:"user_agent"`
	CreatedAt           time.Time    `json:"created_at"`
}

type UserRoleRecord struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	Role             UserRole   `json:"role"`
	OrganizationID   *uuid.UUID `json:"organization_id"`
	OrganizationType *string    `json:"organization_type"`
	IsActive         bool       `json:"is_active"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// Pagination

type Pagination struct {
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
	Total   int `json:"total"`
}

type PaginatedResult[T any] struct {
	Data       []T        `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// Billing models

type BillingTransaction struct {
	ID              uuid.UUID  `json:"id"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	TransactionType string     `json:"transaction_type"`
	AmountTotal     float64    `json:"amount_total"`
	AmountBase      float64    `json:"amount_base"`
	AmountTax       float64    `json:"amount_tax"`
	Currency        string     `json:"currency"`
	PaymentStatus   string     `json:"payment_status"`
	PaymentMethod   *string    `json:"payment_method"`
	InvoiceNumber   *string    `json:"invoice_number"`
	ServiceType     *string    `json:"service_type"`
	Description     *string    `json:"description"`
	BillingPeriod   *string    `json:"billing_period"`
	DueDate         *time.Time `json:"due_date"`
	PaidAt          *time.Time `json:"paid_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Subscription struct {
	ID                 uuid.UUID  `json:"id"`
	CustomerID         uuid.UUID  `json:"customer_id"`
	PlanType           string     `json:"plan_type"`
	BillingCycle       string     `json:"billing_cycle"`
	Price              float64    `json:"price"`
	CurrentPeriodStart time.Time  `json:"current_period_start"`
	CurrentPeriodEnd   time.Time  `json:"current_period_end"`
	IsActive           bool       `json:"is_active"`
	CancelledAt        *time.Time `json:"cancelled_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type UsageMetrics struct {
	TaxFilingsCount int   `json:"tax_filings_count"`
	DocumentsCount  int   `json:"documents_count"`
	StorageBytes    int64 `json:"storage_bytes"`
}
