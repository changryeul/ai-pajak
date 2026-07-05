export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      billing_transaction: {
        Row: {
          amount_base: number | null
          amount_tax: number | null
          amount_total: number
          billing_period: string | null
          created_at: string | null
          currency: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          idempotency_key: string | null
          invoice_number: string | null
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          platform_fee: number
          platform_owner_id: string
          service_type: string | null
          tax_partner_id: string | null
          tax_service_fee: number
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          amount_base?: number | null
          amount_tax?: number | null
          amount_total: number
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_number?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          platform_fee?: number
          platform_owner_id: string
          service_type?: string | null
          tax_partner_id?: string | null
          tax_service_fee?: number
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          amount_base?: number | null
          amount_tax?: number | null
          amount_total?: number
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_number?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          platform_fee?: number
          platform_owner_id?: string
          service_type?: string | null
          tax_partner_id?: string | null
          tax_service_fee?: number
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_transaction_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transaction_platform_owner_id_fkey"
            columns: ["platform_owner_id"]
            isOneToOne: false
            referencedRelation: "platform_owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transaction_tax_partner_id_fkey"
            columns: ["tax_partner_id"]
            isOneToOne: false
            referencedRelation: "tax_partner"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant: {
        Row: {
          created_at: string | null
          email: string
          employee_id: string | null
          employment_end_date: string | null
          employment_start_date: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          tax_partner_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          employee_id?: string | null
          employment_end_date?: string | null
          employment_start_date: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          tax_partner_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          employee_id?: string | null
          employment_end_date?: string | null
          employment_start_date?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          tax_partner_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_tax_partner_id_fkey"
            columns: ["tax_partner_id"]
            isOneToOne: false
            referencedRelation: "tax_partner"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_message: {
        Row: {
          consultant_id: string | null
          customer_id: string
          id: string
          is_from_customer: boolean
          is_read: boolean | null
          message_content: string
          message_type: string
          read_at: string | null
          sent_at: string | null
          tax_filing_id: string | null
        }
        Insert: {
          consultant_id?: string | null
          customer_id: string
          id?: string
          is_from_customer: boolean
          is_read?: boolean | null
          message_content: string
          message_type: string
          read_at?: string | null
          sent_at?: string | null
          tax_filing_id?: string | null
        }
        Update: {
          consultant_id?: string | null
          customer_id?: string
          id?: string
          is_from_customer?: boolean
          is_read?: boolean | null
          message_content?: string
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          tax_filing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_message_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_message_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_message_tax_filing_id_fkey"
            columns: ["tax_filing_id"]
            isOneToOne: false
            referencedRelation: "tax_filing"
            referencedColumns: ["id"]
          },
        ]
      }
      customer: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string
          full_name: string
          id: string
          npwp: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string
          full_name: string
          id?: string
          npwp?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string
          full_name?: string
          id?: string
          npwp?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dynamic_tax_rates: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_until: string | null
          is_active: boolean | null
          legal_basis: string
          pph21_brackets: Json
          ppn_statutory_rate: number
          ptkp: Json
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from: string
          effective_until?: string | null
          is_active?: boolean | null
          legal_basis: string
          pph21_brackets: Json
          ppn_statutory_rate: number
          ptkp: Json
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          is_active?: boolean | null
          legal_basis?: string
          pph21_brackets?: Json
          ppn_statutory_rate?: number
          ptkp?: Json
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      klu_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string
          is_luxury_item: boolean | null
          pph_final_exempt: boolean | null
          pph23_rate: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description: string
          is_luxury_item?: boolean | null
          pph_final_exempt?: boolean | null
          pph23_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string
          is_luxury_item?: boolean | null
          pph_final_exempt?: boolean | null
          pph23_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      luxury_item_classifications: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string | null
          hs_code: string | null
          id: string
          item_name: string
          legal_basis: string | null
          ppn_treatment: string | null
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          hs_code?: string | null
          id?: string
          item_name: string
          legal_basis?: string | null
          ppn_treatment?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          hs_code?: string | null
          id?: string
          item_name?: string
          legal_basis?: string | null
          ppn_treatment?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification: {
        Row: {
          id: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          priority: Database["public"]["Enums"]["notification_priority"]
          title: string
          message: string
          data: Json | null
          channels: Database["public"]["Enums"]["notification_channel"][]
          read: boolean
          read_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          title: string
          message: string
          data?: Json | null
          channels?: Database["public"]["Enums"]["notification_channel"][]
          read?: boolean
          read_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          title?: string
          message?: string
          data?: Json | null
          channels?: Database["public"]["Enums"]["notification_channel"][]
          read?: boolean
          read_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          deadline_reminders: boolean
          filing_updates: boolean
          payment_reminders: boolean
          marketing_emails: boolean
          reminder_days_before: number[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          deadline_reminders?: boolean
          filing_updates?: boolean
          payment_reminders?: boolean
          marketing_emails?: boolean
          reminder_days_before?: number[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          deadline_reminders?: boolean
          filing_updates?: boolean
          payment_reminders?: boolean
          marketing_emails?: boolean
          reminder_days_before?: number[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          name: string
          platform_owner_id: string
          service_agreement_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          name?: string
          platform_owner_id: string
          service_agreement_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          name?: string
          platform_owner_id?: string
          service_agreement_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_platform_owner_id_fkey"
            columns: ["platform_owner_id"]
            isOneToOne: false
            referencedRelation: "platform_owner"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_owner: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          legal_name: string
          name: string
          npwp: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_name: string
          name?: string
          npwp: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_name?: string
          name?: string
          npwp?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      power_of_attorney: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_ip_address: unknown
          customer_signature_url: string | null
          customer_signed_at: string | null
          document_hash: string | null
          document_url: string
          id: string
          notes: string | null
          poa_number: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          scope: Database["public"]["Enums"]["poa_scope"]
          scope_details: Json | null
          status: Database["public"]["Enums"]["poa_status"] | null
          tax_partner_id: string
          tax_partner_signature_url: string | null
          tax_partner_signed_at: string | null
          tax_partner_signed_by_user_id: string | null
          updated_at: string | null
          valid_from: string
          valid_to: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_ip_address?: unknown
          customer_signature_url?: string | null
          customer_signed_at?: string | null
          document_hash?: string | null
          document_url: string
          id?: string
          notes?: string | null
          poa_number?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scope?: Database["public"]["Enums"]["poa_scope"]
          scope_details?: Json | null
          status?: Database["public"]["Enums"]["poa_status"] | null
          tax_partner_id: string
          tax_partner_signature_url?: string | null
          tax_partner_signed_at?: string | null
          tax_partner_signed_by_user_id?: string | null
          updated_at?: string | null
          valid_from: string
          valid_to: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_ip_address?: unknown
          customer_signature_url?: string | null
          customer_signed_at?: string | null
          document_hash?: string | null
          document_url?: string
          id?: string
          notes?: string | null
          poa_number?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scope?: Database["public"]["Enums"]["poa_scope"]
          scope_details?: Json | null
          status?: Database["public"]["Enums"]["poa_status"] | null
          tax_partner_id?: string
          tax_partner_signature_url?: string | null
          tax_partner_signed_at?: string | null
          tax_partner_signed_by_user_id?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_of_attorney_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_of_attorney_tax_partner_id_fkey"
            columns: ["tax_partner_id"]
            isOneToOne: false
            referencedRelation: "tax_partner"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_split: {
        Row: {
          accounting_status:
            | Database["public"]["Enums"]["accounting_status"]
            | null
          amount: number
          billing_transaction_id: string
          created_at: string | null
          description: string | null
          id: string
          recipient_organization_id: string
          recipient_type: Database["public"]["Enums"]["revenue_recipient_type"]
          transferred_at: string | null
          updated_at: string | null
        }
        Insert: {
          accounting_status?:
            | Database["public"]["Enums"]["accounting_status"]
            | null
          amount: number
          billing_transaction_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          recipient_organization_id: string
          recipient_type: Database["public"]["Enums"]["revenue_recipient_type"]
          transferred_at?: string | null
          updated_at?: string | null
        }
        Update: {
          accounting_status?:
            | Database["public"]["Enums"]["accounting_status"]
            | null
          amount?: number
          billing_transaction_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          recipient_organization_id?: string
          recipient_type?: Database["public"]["Enums"]["revenue_recipient_type"]
          transferred_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_split_billing_transaction_id_fkey"
            columns: ["billing_transaction_id"]
            isOneToOne: false
            referencedRelation: "billing_transaction"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          plan_type: Database["public"]["Enums"]["subscription_plan"] | null
          price: number | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          price?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_activity_log: {
        Row: {
          activity_details: Json | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          actor_organization_id: string | null
          actor_role: Database["public"]["Enums"]["user_role_type"]
          actor_user_id: string
          created_at: string | null
          customer_id: string
          id: string
          ip_address: unknown
          tax_filing_id: string | null
          tax_period: string | null
          tax_type: Database["public"]["Enums"]["tax_type"] | null
          user_agent: string | null
        }
        Insert: {
          activity_details?: Json | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          actor_organization_id?: string | null
          actor_role: Database["public"]["Enums"]["user_role_type"]
          actor_user_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          ip_address?: unknown
          tax_filing_id?: string | null
          tax_period?: string | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          user_agent?: string | null
        }
        Update: {
          activity_details?: Json | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          actor_organization_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role_type"]
          actor_user_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          ip_address?: unknown
          tax_filing_id?: string | null
          tax_period?: string | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_activity_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_activity_log_tax_filing_id_fkey"
            columns: ["tax_filing_id"]
            isOneToOne: false
            referencedRelation: "tax_filing"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_advisor: {
        Row: {
          consultant_id: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          license_expiry_date: string | null
          license_number: string
          license_type: string
          updated_at: string | null
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          license_expiry_date?: string | null
          license_number: string
          license_type: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          license_expiry_date?: string | null
          license_number?: string
          license_type?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_advisor_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "consultant"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_document: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          mime_type: string
          ocr_data: Json | null
          tax_filing_id: string
          uploaded_at: string | null
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          mime_type: string
          ocr_data?: Json | null
          tax_filing_id: string
          uploaded_at?: string | null
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          ocr_data?: Json | null
          tax_filing_id?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_document_tax_filing_id_fkey"
            columns: ["tax_filing_id"]
            isOneToOne: false
            referencedRelation: "tax_filing"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_filing: {
        Row: {
          bpe_number: string | null
          consultant_id: string
          created_at: string | null
          customer_id: string
          filed_at: string | null
          id: string
          power_of_attorney_id: string | null
          status: Database["public"]["Enums"]["tax_filing_status"] | null
          tax_advisor_id: string | null
          tax_data: Json
          tax_period: string
          tax_type: Database["public"]["Enums"]["tax_type"]
          updated_at: string | null
        }
        Insert: {
          bpe_number?: string | null
          consultant_id: string
          created_at?: string | null
          customer_id: string
          filed_at?: string | null
          id?: string
          power_of_attorney_id?: string | null
          status?: Database["public"]["Enums"]["tax_filing_status"] | null
          tax_advisor_id?: string | null
          tax_data?: Json
          tax_period: string
          tax_type: Database["public"]["Enums"]["tax_type"]
          updated_at?: string | null
        }
        Update: {
          bpe_number?: string | null
          consultant_id?: string
          created_at?: string | null
          customer_id?: string
          filed_at?: string | null
          id?: string
          power_of_attorney_id?: string | null
          status?: Database["public"]["Enums"]["tax_filing_status"] | null
          tax_advisor_id?: string | null
          tax_data?: Json
          tax_period?: string
          tax_type?: Database["public"]["Enums"]["tax_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_filing_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_filing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_filing_power_of_attorney_id_fkey"
            columns: ["power_of_attorney_id"]
            isOneToOne: false
            referencedRelation: "power_of_attorney"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_filing_tax_advisor_id_fkey"
            columns: ["tax_advisor_id"]
            isOneToOne: false
            referencedRelation: "tax_advisor"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_law_analyses: {
        Row: {
          affected_systems: string[]
          analyzed_at: string | null
          change_type: string[]
          confidence_score: number | null
          created_at: string | null
          detailed_changes: Json
          effective_date: string
          id: string
          law_number: string
          law_title: string
          law_type: string
          original_document: string | null
          requires_human_review: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_migrations: string[]
          summary: string
          updated_at: string | null
        }
        Insert: {
          affected_systems: string[]
          analyzed_at?: string | null
          change_type: string[]
          confidence_score?: number | null
          created_at?: string | null
          detailed_changes: Json
          effective_date: string
          id?: string
          law_number: string
          law_title: string
          law_type: string
          original_document?: string | null
          requires_human_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_migrations: string[]
          summary: string
          updated_at?: string | null
        }
        Update: {
          affected_systems?: string[]
          analyzed_at?: string | null
          change_type?: string[]
          confidence_score?: number | null
          created_at?: string | null
          detailed_changes?: Json
          effective_date?: string
          id?: string
          law_number?: string
          law_title?: string
          law_type?: string
          original_document?: string | null
          requires_human_review?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_migrations?: string[]
          summary?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tax_law_applications: {
        Row: {
          analysis_id: string | null
          application_status: string | null
          applied_at: string | null
          applied_by: string
          applied_migrations: string[]
          error_messages: Json | null
          id: string
          rollback_migrations: string[] | null
        }
        Insert: {
          analysis_id?: string | null
          application_status?: string | null
          applied_at?: string | null
          applied_by: string
          applied_migrations: string[]
          error_messages?: Json | null
          id?: string
          rollback_migrations?: string[] | null
        }
        Update: {
          analysis_id?: string | null
          application_status?: string | null
          applied_at?: string | null
          applied_by?: string
          applied_migrations?: string[]
          error_messages?: Json | null
          id?: string
          rollback_migrations?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_law_applications_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "tax_law_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_partner: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          email_domain: string
          id: string
          is_active: boolean | null
          legal_name: string
          name: string
          npwp: string
          partnership_start_date: string
          phone: string | null
          platform_id: string
          tax_license_number: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          email_domain: string
          id?: string
          is_active?: boolean | null
          legal_name: string
          name?: string
          npwp: string
          partnership_start_date: string
          phone?: string | null
          platform_id: string
          tax_license_number: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          email_domain?: string
          id?: string
          is_active?: boolean | null
          legal_name?: string
          name?: string
          npwp?: string
          partnership_start_date?: string
          phone?: string | null
          platform_id?: string
          tax_license_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_partner_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platform"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          organization_type:
            | Database["public"]["Enums"]["organization_type"]
            | null
          role: Database["public"]["Enums"]["user_role_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          role: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          role?: Database["public"]["Enums"]["user_role_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_consultant_id: { Args: never; Returns: string }
      get_customer_id: { Args: never; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_organization_type: {
        Args: never
        Returns: Database["public"]["Enums"]["organization_type"]
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role_type"]
      }
      has_active_poa: {
        Args: {
          p_customer_id: string
          p_filing_date?: string
          p_tax_partner_id: string
          p_tax_type: Database["public"]["Enums"]["tax_type"]
        }
        Returns: boolean
      }
      is_customer: { Args: never; Returns: boolean }
      is_jtc_consultant: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      update_poa_status: { Args: never; Returns: undefined }
    }
    Enums: {
      accounting_status: "PENDING" | "RECOGNIZED" | "TRANSFERRED"
      activity_type:
        | "CREATE"
        | "UPDATE"
        | "REVIEW"
        | "FILE"
        | "DOWNLOAD"
        | "DELETE"
        | "VIEW"
        | "POA_CREATED"
        | "POA_SIGNED"
        | "POA_ACTIVATED"
        | "POA_REVOKED"
      billing_cycle: "MONTHLY" | "ANNUAL"
      customer_type: "INDIVIDUAL" | "COMPANY"
      item_category: "ESSENTIAL" | "LUXURY" | "SPECIAL"
      notification_channel: "EMAIL" | "IN_APP" | "PUSH"
      notification_priority: "HIGH" | "MEDIUM" | "LOW"
      notification_type:
        | "DEADLINE_REMINDER"
        | "FILING_STATUS"
        | "POA_STATUS"
        | "DOCUMENT_PROCESSED"
        | "PAYMENT_DUE"
        | "PAYMENT_RECEIVED"
        | "SYSTEM_ANNOUNCEMENT"
      organization_type: "PLATFORM_OWNER" | "PLATFORM" | "TAX_PARTNER"
      payment_status: "PENDING" | "PAID" | "FAILED" | "REFUNDED"
      poa_scope:
        | "ALL_TAX_TYPES"
        | "PPh21_ONLY"
        | "PPh23_ONLY"
        | "PPN_ONLY"
        | "SPT_TAHUNAN_ONLY"
        | "CUSTOM"
      poa_status:
        | "DRAFT"
        | "PENDING_SIGNATURE"
        | "ACTIVE"
        | "EXPIRED"
        | "REVOKED"
        | "REJECTED"
      revenue_recipient_type: "PLATFORM_OWNER" | "TAX_PARTNER"
      subscription_plan: "FREE" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE"
      tax_filing_status: "DRAFT" | "UNDER_REVIEW" | "FILED" | "REJECTED"
      tax_type:
        | "PPh21"
        | "PPh23"
        | "PPh_FINAL"
        | "PPN"
        | "SPT_MASA"
        | "SPT_TAHUNAN"
      transaction_type: "SUBSCRIPTION" | "TAX_SERVICE"
      user_role_type:
        | "CUSTOMER"
        | "CONSULTANT"
        | "TAX_ADVISOR"
        | "PLATFORM_ADMIN"
        | "SYSTEM"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      accounting_status: ["PENDING", "RECOGNIZED", "TRANSFERRED"],
      activity_type: [
        "CREATE",
        "UPDATE",
        "REVIEW",
        "FILE",
        "DOWNLOAD",
        "DELETE",
        "VIEW",
        "POA_CREATED",
        "POA_SIGNED",
        "POA_ACTIVATED",
        "POA_REVOKED",
      ],
      billing_cycle: ["MONTHLY", "ANNUAL"],
      customer_type: ["INDIVIDUAL", "COMPANY"],
      item_category: ["ESSENTIAL", "LUXURY", "SPECIAL"],
      notification_channel: ["EMAIL", "IN_APP", "PUSH"],
      notification_priority: ["HIGH", "MEDIUM", "LOW"],
      notification_type: [
        "DEADLINE_REMINDER",
        "FILING_STATUS",
        "POA_STATUS",
        "DOCUMENT_PROCESSED",
        "PAYMENT_DUE",
        "PAYMENT_RECEIVED",
        "SYSTEM_ANNOUNCEMENT",
      ],
      organization_type: ["PLATFORM_OWNER", "PLATFORM", "TAX_PARTNER"],
      payment_status: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      poa_scope: [
        "ALL_TAX_TYPES",
        "PPh21_ONLY",
        "PPh23_ONLY",
        "PPN_ONLY",
        "SPT_TAHUNAN_ONLY",
        "CUSTOM",
      ],
      poa_status: [
        "DRAFT",
        "PENDING_SIGNATURE",
        "ACTIVE",
        "EXPIRED",
        "REVOKED",
        "REJECTED",
      ],
      revenue_recipient_type: ["PLATFORM_OWNER", "TAX_PARTNER"],
      subscription_plan: ["FREE", "BASIC", "PROFESSIONAL", "ENTERPRISE"],
      tax_filing_status: ["DRAFT", "UNDER_REVIEW", "FILED", "REJECTED"],
      tax_type: [
        "PPh21",
        "PPh23",
        "PPh_FINAL",
        "PPN",
        "SPT_MASA",
        "SPT_TAHUNAN",
      ],
      transaction_type: ["SUBSCRIPTION", "TAX_SERVICE"],
      user_role_type: [
        "CUSTOMER",
        "CONSULTANT",
        "TAX_ADVISOR",
        "PLATFORM_ADMIN",
        "SYSTEM",
      ],
    },
  },
} as const

