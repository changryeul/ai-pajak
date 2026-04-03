'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserCheck,
  FileText,
  Search,
  ChevronRight,
  Building2,
  User,
  Loader2,
  Plus,
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  created_at: string;
  poa_status: 'none' | 'pending' | 'active';
  filing_count: number;
}

interface CustomerStats {
  total: number;
  active: number;
  activePoa: number;
  pendingFilings: number;
}

export default function CustomersPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    active: 0,
    activePoa: 0,
    pendingFilings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    company_name: '',
    email: '',
    phone: '',
    npwp: '',
    address: '',
    customer_type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers || []);
        setStats(data.stats || {
          total: data.customers?.length || 0,
          active: 0,
          activePoa: 0,
          pendingFilings: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateDialog(false);
        setCreateForm({ full_name: '', company_name: '', email: '', phone: '', npwp: '', address: '', customer_type: 'INDIVIDUAL' });
        loadCustomers();
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
    } finally {
      setCreating(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.full_name?.toLowerCase().includes(query) ||
      customer.company_name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.npwp?.toLowerCase().includes(query)
    );
  });

  const getPoaStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">{t('customers.poaActive')}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">{t('customers.poaPending')}</Badge>;
      default:
        return <Badge variant="outline">{t('customers.noPoaYet')}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('customers.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('customers.description')}
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              {t('customers.addCustomer')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{t('customers.addCustomer')}</DialogTitle>
              <DialogDescription>{t('customers.description')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t('customers.customerType')}</Label>
                <Select
                  value={createForm.customer_type}
                  onValueChange={(v) => setCreateForm({ ...createForm, customer_type: v as 'INDIVIDUAL' | 'COMPANY' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">{t('customers.individual')}</SelectItem>
                    <SelectItem value="COMPANY">{t('customers.company')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('customers.name')} *</Label>
                <Input
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              {createForm.customer_type === 'COMPANY' && (
                <div className="grid gap-2">
                  <Label>{t('customers.company')} *</Label>
                  <Input
                    value={createForm.company_name}
                    onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t('customers.email')}</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('customers.phone')}</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t('customers.npwp')}</Label>
                <Input
                  value={createForm.npwp}
                  onChange={(e) => setCreateForm({ ...createForm, npwp: e.target.value })}
                  placeholder="XX.XXX.XXX.X-XXX.XXX"
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreateCustomer} disabled={creating || !createForm.full_name}>
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {t('customers.addCustomer')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, value: stats.total, label: t('customers.totalCustomers'), gradient: 'from-blue-500 to-blue-600' },
          { icon: UserCheck, value: stats.activePoa, label: t('customers.activePOA'), gradient: 'from-green-500 to-emerald-600' },
          { icon: FileText, value: stats.pendingFilings, label: t('customers.pendingFilings'), gradient: 'from-amber-500 to-orange-500' },
          { icon: Building2, value: customers.filter((c) => c.customer_type === 'COMPANY').length, label: t('customers.company'), gradient: 'from-purple-500 to-violet-600' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="group border-0 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('customers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <p className="text-sm text-gray-500">
              {filteredCustomers.length} {t('customers.customersFound')}
            </p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('customers.noCustomers')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('customers.name')}</TableHead>
                  <TableHead>{t('customers.customerType')}</TableHead>
                  <TableHead>{t('customers.npwp')}</TableHead>
                  <TableHead>{t('customers.poaStatus')}</TableHead>
                  <TableHead>{t('customers.filings')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          customer.customer_type === 'COMPANY'
                            ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                          {customer.customer_type === 'COMPANY' ? (
                            <Building2 className="h-4 w-4 text-white" />
                          ) : (
                            <User className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {customer.company_name || customer.full_name}
                          </p>
                          {customer.company_name && (
                            <p className="text-sm text-gray-500">{customer.full_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {customer.customer_type === 'COMPANY'
                          ? t('customers.company')
                          : t('customers.individual')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{customer.npwp || '-'}</span>
                    </TableCell>
                    <TableCell>{getPoaStatusBadge(customer.poa_status)}</TableCell>
                    <TableCell>
                      <span className="text-gray-600">{customer.filing_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/${locale}/customers/${customer.id}`)}
                      >
                        {t('customers.viewDetails')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
