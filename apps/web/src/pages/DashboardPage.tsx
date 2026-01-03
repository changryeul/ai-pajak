import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Brain, UserCheck, Send, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { StatCard, UrgentCasesPanel, RecentActivityTimeline } from '@/components/dashboard';
import { getDashboardMockByRole, emptyDashboardMock } from '@/mocks/dashboard.mock';
import { type UserRole } from '@/config/navigation';

interface DashboardPageProps {
  userRole: UserRole;
  userName?: string;
}

export function DashboardPage({ userRole, userName }: DashboardPageProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  // Get mock data based on role with fallback to empty state
  const dashboardData = getDashboardMockByRole(userRole) ?? emptyDashboardMock;

  const handleCaseClick = (caseId: string) => {
    navigate(`/tax-cases/${caseId}`);
  };

  // Determine if this is a JTC role (Consultant or Advisor)
  const isJtcRole = userRole === 'CONSULTANT_JTC' || userRole === 'TAX_ADVISOR_JTC';
  const isAdvisor = userRole === 'TAX_ADVISOR_JTC';

  // Calculate urgent count
  const urgentCount = dashboardData.urgentCases.length;

  // Non-JTC roles get a simple dashboard
  if (!isJtcRole) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('welcomeCustomer', { name: userName || t('defaultUser') })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title={t('stats.inProgress')}
            value={dashboardData.statusDistribution.humanReview}
            icon={UserCheck}
            description={t('stats.inProgressDesc')}
          />
          <StatCard
            title={t('stats.completed')}
            value={dashboardData.statusDistribution.filed}
            icon={CheckCircle}
            variant="success"
            description={t('stats.completedDesc')}
          />
          <StatCard
            title={t('stats.upcomingDeadline')}
            value={urgentCount > 0 ? t('stats.casesCount', { count: urgentCount }) : t('stats.none')}
            icon={AlertCircle}
            variant={urgentCount > 0 ? 'urgent' : 'default'}
            description={t('stats.upcomingDeadlineDesc')}
          />
        </div>
      </div>
    );
  }

  // Consultant Dashboard
  if (!isAdvisor) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('welcomeConsultant')}
          </p>
        </div>

        {/* Stats Grid - Consultant Focus: Review-oriented */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('stats.assignedCustomers')}
            value={dashboardData.totalCustomers}
            icon={Users}
            description={t('stats.assignedCustomersDesc')}
          />
          <StatCard
            title={t('stats.pendingReview')}
            value={dashboardData.statusDistribution.humanReview}
            icon={UserCheck}
            variant={dashboardData.statusDistribution.humanReview > 10 ? 'urgent' : 'default'}
            description={t('stats.pendingReviewDesc')}
          />
          <StatCard
            title={t('stats.aiAnalyzing')}
            value={dashboardData.statusDistribution.aiAnalyzed}
            icon={Brain}
            description={t('stats.aiAnalyzingDesc')}
          />
          <StatCard
            title={t('stats.filed')}
            value={dashboardData.statusDistribution.filed}
            icon={Send}
            variant="success"
            description={t('stats.filedDesc')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Urgent Cases */}
          <UrgentCasesPanel cases={dashboardData.urgentCases} onCaseClick={handleCaseClick} />

          {/* Recent Activity */}
          <RecentActivityTimeline activities={dashboardData.recentActivities} />
        </div>
      </div>
    );
  }

  // Tax Advisor Dashboard
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('welcomeAdvisor')}</p>
      </div>

      {/* Stats Grid - Advisor Focus: Approval/Submission-oriented */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('stats.pendingApproval')}
          value={dashboardData.statusDistribution.humanReview}
          icon={UserCheck}
          variant={dashboardData.statusDistribution.humanReview > 15 ? 'urgent' : 'default'}
          description={t('stats.pendingApprovalDesc')}
        />
        <StatCard
          title={t('stats.readyToFile')}
          value={dashboardData.statusDistribution.approved}
          icon={Upload}
          description={t('stats.readyToFileDesc')}
        />
        <StatCard
          title={t('stats.filed')}
          value={dashboardData.statusDistribution.filed}
          icon={Send}
          variant="success"
          description={t('stats.filedDesc')}
        />
        <StatCard
          title={t('stats.dueSoon')}
          value={urgentCount}
          icon={AlertCircle}
          variant={urgentCount > 0 ? 'urgent' : 'default'}
          description={t('stats.dueSoonDesc')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Urgent Cases */}
        <UrgentCasesPanel cases={dashboardData.urgentCases} onCaseClick={handleCaseClick} />

        {/* Recent Activity */}
        <RecentActivityTimeline activities={dashboardData.recentActivities} />
      </div>
    </div>
  );
}
