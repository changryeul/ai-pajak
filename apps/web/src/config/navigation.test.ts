import { describe, it, expect } from 'vitest'
import { getMenuForRole, isPathActive, menuConfig, type UserRole } from './navigation'

describe('Navigation Config', () => {
  describe('menuConfig', () => {
    it('has dashboard menu item', () => {
      const dashboard = menuConfig.find(item => item.id === 'dashboard')
      expect(dashboard).toBeDefined()
      expect(dashboard?.path).toBe('/dashboard')
    })

    it('has tax-cases menu item with children', () => {
      const taxCases = menuConfig.find(item => item.id === 'tax-cases')
      expect(taxCases).toBeDefined()
      expect(taxCases?.children).toBeDefined()
      expect(taxCases?.children?.length).toBeGreaterThan(0)
    })

    it('has settings menu item available to all roles', () => {
      const settings = menuConfig.find(item => item.id === 'settings')
      expect(settings).toBeDefined()
      expect(settings?.roles).toContain('CUSTOMER')
      expect(settings?.roles).toContain('CONSULTANT_JTC')
      expect(settings?.roles).toContain('TAX_ADVISOR_JTC')
      expect(settings?.roles).toContain('PLATFORM_ADMIN')
    })
  })

  describe('getMenuForRole', () => {
    it('returns correct menu for CUSTOMER', () => {
      const menu = getMenuForRole('CUSTOMER')
      const menuIds = menu.map(item => item.id)

      expect(menuIds).toContain('dashboard')
      expect(menuIds).toContain('tax-cases')
      expect(menuIds).toContain('payment')
      expect(menuIds).toContain('settings')

      // Should not have consultant/advisor specific items
      expect(menuIds).not.toContain('customers')
      expect(menuIds).not.toContain('approval-queue')
      expect(menuIds).not.toContain('bulk-submit')
    })

    it('returns correct menu for CONSULTANT_JTC', () => {
      const menu = getMenuForRole('CONSULTANT_JTC')
      const menuIds = menu.map(item => item.id)

      expect(menuIds).toContain('dashboard')
      expect(menuIds).toContain('tax-cases')
      expect(menuIds).toContain('customers')
      expect(menuIds).toContain('tax-processing')
      expect(menuIds).toContain('communication')
      expect(menuIds).toContain('settings')

      // Should not have advisor-only items
      expect(menuIds).not.toContain('approval-queue')
      expect(menuIds).not.toContain('bulk-submit')
      expect(menuIds).not.toContain('team')
    })

    it('returns correct menu for TAX_ADVISOR_JTC', () => {
      const menu = getMenuForRole('TAX_ADVISOR_JTC')
      const menuIds = menu.map(item => item.id)

      expect(menuIds).toContain('dashboard')
      expect(menuIds).toContain('tax-cases')
      expect(menuIds).toContain('approval-queue')
      expect(menuIds).toContain('bulk-submit')
      expect(menuIds).toContain('team')
      expect(menuIds).toContain('settings')

      // Should not have customer-only items
      expect(menuIds).not.toContain('payment')
    })

    it('returns correct menu for PLATFORM_ADMIN', () => {
      const menu = getMenuForRole('PLATFORM_ADMIN')
      const menuIds = menu.map(item => item.id)

      expect(menuIds).toContain('dashboard')
      expect(menuIds).toContain('settings')

      // Should not have tax-related items
      expect(menuIds).not.toContain('tax-cases')
      expect(menuIds).not.toContain('approval-queue')
    })

    it('filters children based on role', () => {
      const customerMenu = getMenuForRole('CUSTOMER')
      const taxCases = customerMenu.find(item => item.id === 'tax-cases')

      // CUSTOMER should see upload, in-progress, completed
      const childIds = taxCases?.children?.map(c => c.id) || []
      expect(childIds).toContain('upload')
      expect(childIds).toContain('in-progress')
      expect(childIds).toContain('completed')
    })

    it('filters children differently for CONSULTANT_JTC', () => {
      const consultantMenu = getMenuForRole('CONSULTANT_JTC')
      const taxCases = consultantMenu.find(item => item.id === 'tax-cases')

      // CONSULTANT should see in-progress, completed but NOT upload
      const childIds = taxCases?.children?.map(c => c.id) || []
      expect(childIds).not.toContain('upload')
      expect(childIds).toContain('in-progress')
      expect(childIds).toContain('completed')
    })
  })

  describe('isPathActive', () => {
    it('returns true for exact dashboard match', () => {
      expect(isPathActive('/dashboard', '/dashboard')).toBe(true)
    })

    it('returns false for dashboard when on other page', () => {
      expect(isPathActive('/dashboard', '/tax-cases')).toBe(false)
    })

    it('returns true for exact path match', () => {
      expect(isPathActive('/tax-cases', '/tax-cases')).toBe(true)
    })

    it('returns true for nested path', () => {
      expect(isPathActive('/tax-cases', '/tax-cases/upload')).toBe(true)
      expect(isPathActive('/tax-cases', '/tax-cases/in-progress')).toBe(true)
    })

    it('returns false for unrelated path', () => {
      expect(isPathActive('/tax-cases', '/settings')).toBe(false)
    })

    it('handles dashboard special case (exact match only)', () => {
      expect(isPathActive('/dashboard', '/dashboard/something')).toBe(false)
    })
  })
})
