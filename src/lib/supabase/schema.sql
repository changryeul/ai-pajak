-- AI PAJAK Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  npwp TEXT,
  nik TEXT,
  user_type TEXT NOT NULL DEFAULT 'individual' CHECK (user_type IN ('individual', 'corporate', 'tax_consultant')),
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'professional', 'enterprise')),
  company_name TEXT,
  company_npwp TEXT,
  address JSONB,
  preferred_locale TEXT NOT NULL DEFAULT 'id' CHECK (preferred_locale IN ('id', 'en', 'ko', 'ja', 'zh')),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax documents table
CREATE TABLE public.tax_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pph21', 'pph23', 'ppn', 'spt-tahunan')),
  tax_period TEXT NOT NULL, -- Format: YYYY-MM or YYYY
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'ready_to_submit', 'submitted', 'accepted', 'rejected', 'needs_revision')),
  data JSONB NOT NULL DEFAULT '{}',
  calculated_tax DECIMAL(20, 2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  djp_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table (for PPh 21)
CREATE TABLE public.employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  npwp TEXT,
  nik TEXT NOT NULL,
  ptkp_category TEXT NOT NULL CHECK (ptkp_category IN ('TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3', 'KI0', 'KI1', 'KI2', 'KI3')),
  position TEXT,
  department TEXT,
  join_date DATE,
  bank_account TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll records (for PPh 21 calculations)
CREATE TABLE public.payroll_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL, -- Format: YYYY-MM
  gross_salary DECIMAL(20, 2) NOT NULL,
  allowances JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  jht_employee DECIMAL(20, 2) DEFAULT 0,
  jp_employee DECIMAL(20, 2) DEFAULT 0,
  pph21_amount DECIMAL(20, 2) DEFAULT 0,
  net_salary DECIMAL(20, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploaded documents (for OCR)
CREATE TABLE public.uploaded_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  document_type TEXT, -- Type detected by OCR
  ocr_result JSONB,
  ocr_confidence DECIMAL(5, 2),
  linked_tax_document_id UUID REFERENCES public.tax_documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'basic', 'professional', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  midtrans_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  midtrans_transaction_id TEXT,
  midtrans_order_id TEXT,
  payment_method TEXT,
  payment_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax deadlines reference table
CREATE TABLE public.tax_deadlines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tax_type TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  description TEXT NOT NULL,
  due_day INTEGER NOT NULL, -- Day of month/year
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default tax deadlines
INSERT INTO public.tax_deadlines (tax_type, period_type, description, due_day) VALUES
  ('pph21', 'monthly', 'PPh 21 Monthly Filing', 10),
  ('pph23', 'monthly', 'PPh 23 Monthly Filing', 10),
  ('ppn', 'monthly', 'PPN Monthly Filing', 31),
  ('spt-tahunan', 'yearly', 'SPT Tahunan Individual (1770/1770S/1770SS)', 31), -- March 31
  ('spt-tahunan', 'yearly', 'SPT Tahunan Corporate (1771)', 30); -- April 30

-- Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tax documents policies
CREATE POLICY "Users can view own tax documents" ON public.tax_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax documents" ON public.tax_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax documents" ON public.tax_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax documents" ON public.tax_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Employees policies
CREATE POLICY "Users can view own employees" ON public.employees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own employees" ON public.employees
  FOR ALL USING (auth.uid() = user_id);

-- Payroll policies
CREATE POLICY "Users can view own payroll records" ON public.payroll_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = payroll_records.employee_id
      AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own payroll records" ON public.payroll_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = payroll_records.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Uploaded documents policies
CREATE POLICY "Users can view own uploaded documents" ON public.uploaded_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own uploaded documents" ON public.uploaded_documents
  FOR ALL USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Activity logs policies
CREATE POLICY "Users can view own activity logs" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tax_documents
  BEFORE UPDATE ON public.tax_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_tax_documents_user_id ON public.tax_documents(user_id);
CREATE INDEX idx_tax_documents_type ON public.tax_documents(type);
CREATE INDEX idx_tax_documents_status ON public.tax_documents(status);
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX idx_payroll_records_period ON public.payroll_records(period);
CREATE INDEX idx_uploaded_documents_user_id ON public.uploaded_documents(user_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
