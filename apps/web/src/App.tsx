import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useState, createContext, useContext } from 'react';
import Landing from './views/Landing';
import TaxCaseDetail from './views/TaxCaseDetail';
import { OCRReview } from './views/OCRReview';
import { DashboardLayout, MainLayout } from './components/layout';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentUploadPage } from './pages/DocumentUploadPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { InProgressPage } from './pages/InProgressPage';
import { CompletedPage } from './pages/CompletedPage';
import { type UserRole } from './config/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';

// Mock user data for development
const mockUsers: Record<UserRole, { name: string; email: string }> = {
  CUSTOMER: { name: 'John Customer', email: 'customer@example.com' },
  CONSULTANT_JTC: { name: 'Sarah Consultant', email: 'consultant@jtc.co.id' },
  TAX_ADVISOR_JTC: { name: 'David Advisor', email: 'advisor@jtc.co.id' },
  PLATFORM_ADMIN: { name: 'Admin User', email: 'admin@aipajak.com' },
  SYSTEM: { name: 'System', email: 'system@aipajak.com' },
};

// User context type
interface UserContextType {
  role: UserRole;
  name: string;
  email: string;
}

// Context for user data
const UserContext = createContext<UserContextType | null>(null);

// Hook to access user context
export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within UserContext.Provider');
  }
  return context;
}

function LandingWrapper() {
  const navigate = useNavigate();

  return (
    <Landing
      onStart={() => {
        navigate('/dashboard');
      }}
    />
  );
}

// Development role switcher component
function DevRoleSwitcher({
  currentRole,
  onRoleChange,
}: {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] rounded-lg border bg-background p-3 shadow-lg"
      role="region"
      aria-label="Development role switcher panel"
    >
      <div className="mb-2 text-xs font-medium text-muted-foreground" id="role-switcher-label">
        Dev Role Switcher
      </div>
      <Select value={currentRole} onValueChange={(value) => onRoleChange(value as UserRole)}>
        <SelectTrigger className="w-[180px]" aria-labelledby="role-switcher-label">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CUSTOMER">Customer</SelectItem>
          <SelectItem value="CONSULTANT_JTC">Consultant (JTC)</SelectItem>
          <SelectItem value="TAX_ADVISOR_JTC">Advisor (JTC)</SelectItem>
          <SelectItem value="PLATFORM_ADMIN">Platform Admin</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Dashboard layout wrapper with role state
function DashboardLayoutWithRole() {
  const [currentRole, setCurrentRole] = useState<UserRole>('CUSTOMER');
  const currentUser = mockUsers[currentRole];
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Implement actual logout logic (clear tokens, etc.)
    navigate('/');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  return (
    <UserContext.Provider value={{ role: currentRole, name: currentUser.name, email: currentUser.email }}>
      <DevRoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />
      <DashboardLayout
        userRole={currentRole}
        userName={currentUser.name}
        userEmail={currentUser.email}
        notificationCount={3}
        onLogout={handleLogout}
        onSettingsClick={handleSettingsClick}
      />
    </UserContext.Provider>
  );
}

// Dashboard content with role awareness
function DashboardContent() {
  const user = useUserContext();
  return <DashboardPage userRole={user.role} userName={user.name} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes with MainLayout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingWrapper />} />
          <Route path="/login" element={<div className="p-8 text-center">Login Page (Coming Soon)</div>} />
          <Route path="/signup" element={<div className="p-8 text-center">Sign Up Page (Coming Soon)</div>} />
        </Route>

        {/* Dashboard routes with layout */}
        <Route element={<DashboardLayoutWithRole />}>
          <Route path="/dashboard" element={<DashboardContent />} />
          <Route path="/tax-cases" element={<div className="p-4">Tax Filing List</div>} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/upload" element={<DocumentUploadPage />} />
          {/* Story 2-5 - OCR Review Page */}
          <Route path="/documents/:documentId/review" element={<OCRReview />} />
          <Route path="/tax-cases/in-progress" element={<InProgressPage />} />
          <Route path="/tax-cases/completed" element={<CompletedPage />} />
          <Route path="/tax-cases/:id" element={<TaxCaseDetail />} />
          <Route path="/customers" element={<div className="p-4">Customer Management</div>} />
          <Route path="/tax-processing" element={<div className="p-4">Tax Processing</div>} />
          <Route path="/communication" element={<div className="p-4">Communication</div>} />
          <Route path="/approval-queue" element={<div className="p-4">Approval Queue</div>} />
          <Route path="/bulk-submit" element={<div className="p-4">Bulk Submit</div>} />
          <Route path="/team" element={<div className="p-4">Team Management</div>} />
          <Route path="/payment" element={<div className="p-4">Payment</div>} />
          <Route path="/settings" element={<div className="p-4">Settings</div>} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
