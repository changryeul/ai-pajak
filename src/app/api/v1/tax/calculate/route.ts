import { NextRequest, NextResponse } from 'next/server';
import { PPh21Calculator } from '@/lib/tax/pph21-calculator';
import type { PPh21Data } from '@/types';

/**
 * POST /api/v1/tax/calculate
 *
 * Public API endpoint for enterprise integrations.
 * Requires API key in Authorization header.
 *
 * Usage:
 * curl -X POST /api/v1/tax/calculate \
 *   -H "Authorization: Bearer <api-key>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"type": "pph21", "data": {...}}'
 */
export async function POST(request: NextRequest) {
  // API Key validation
  const authHeader = request.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required. Use Authorization: Bearer <api-key>' },
      { status: 401 }
    );
  }

  // In production, validate API key against database
  // For now, check against environment variable
  const validKey = process.env.ENTERPRISE_API_KEY;
  if (!validKey || apiKey !== validKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, data, period = 'annual' } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'type and data are required', validTypes: ['pph21', 'pph21-bulk'] },
        { status: 400 }
      );
    }

    switch (type) {
      case 'pph21': {
        const calc = period === 'monthly'
          ? PPh21Calculator.calculateMonthly(data as PPh21Data)
          : PPh21Calculator.calculateAnnual(data as PPh21Data);

        return NextResponse.json({
          success: true,
          data: {
            ...calc,
            effective_rate: PPh21Calculator.getEffectiveTaxRate(calc.tax_amount, calc.gross_income),
            period,
          },
        });
      }

      case 'pph21-bulk': {
        const employees = data.employees as PPh21Data[];
        if (!Array.isArray(employees) || employees.length === 0) {
          return NextResponse.json({ error: 'employees array required' }, { status: 400 });
        }
        if (employees.length > 1000) {
          return NextResponse.json({ error: 'Maximum 1000 employees per request' }, { status: 400 });
        }

        const results = employees.map((emp) => {
          try {
            const calc = period === 'monthly'
              ? PPh21Calculator.calculateMonthly(emp)
              : PPh21Calculator.calculateAnnual(emp);
            return { employee_name: emp.employee_name, ...calc, error: null };
          } catch (err) {
            return { employee_name: emp.employee_name, error: err instanceof Error ? err.message : 'Failed' };
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              total: results.length,
              success: results.filter(r => !r.error).length,
              failed: results.filter(r => r.error).length,
            },
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}`, validTypes: ['pph21', 'pph21-bulk'] },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calculation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/tax/calculate
 * API documentation
 */
export async function GET() {
  return NextResponse.json({
    api: 'AI Pajak Enterprise API',
    version: 'v1',
    endpoints: {
      'POST /api/v1/tax/calculate': {
        description: 'Calculate Indonesian tax',
        auth: 'Bearer <api-key>',
        types: {
          pph21: {
            description: 'PPh 21 Income Tax calculation',
            fields: {
              employee_name: 'string',
              ptkp_category: 'TK0|TK1|TK2|TK3|K0|K1|K2|K3|KI0|KI1|KI2|KI3',
              gross_salary: 'number (monthly)',
              jht_employee: 'number (monthly JHT)',
              jp_employee: 'number (monthly JP)',
            },
          },
          'pph21-bulk': {
            description: 'Bulk PPh 21 for multiple employees',
            fields: { employees: 'PPh21Data[]' },
            limit: '1000 employees per request',
          },
        },
      },
    },
  });
}
