import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

// Wrapper component for router context
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Sidebar Component', () => {
  it('renders logo', () => {
    renderWithRouter(<Sidebar userRole="CUSTOMER" userName="Test User" />)
    expect(screen.getByText('AI Pajak')).toBeInTheDocument()
  })

  it('renders user profile section with name', () => {
    renderWithRouter(<Sidebar userRole="CUSTOMER" userName="John Customer" userEmail="test@example.com" />)
    expect(screen.getByText('John Customer')).toBeInTheDocument()
  })

  it('shows user initial in avatar', () => {
    renderWithRouter(<Sidebar userRole="CUSTOMER" userName="John Customer" />)
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('displays default user name when not provided', () => {
    renderWithRouter(<Sidebar userRole="CUSTOMER" />)
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  describe('Role-based menu visibility', () => {
    it('shows CUSTOMER menu items', () => {
      renderWithRouter(<Sidebar userRole="CUSTOMER" />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Tax Filing')).toBeInTheDocument()
      expect(screen.getByText('Payment')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('shows CONSULTANT_JTC menu items', () => {
      renderWithRouter(<Sidebar userRole="CONSULTANT_JTC" />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Customers')).toBeInTheDocument()
      expect(screen.getByText('Tax Processing')).toBeInTheDocument()
      expect(screen.getByText('Communication')).toBeInTheDocument()
    })

    it('shows TAX_ADVISOR_JTC menu items', () => {
      renderWithRouter(<Sidebar userRole="TAX_ADVISOR_JTC" />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Approval Queue')).toBeInTheDocument()
      expect(screen.getByText('Bulk Submit')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
    })

    it('hides CONSULTANT_JTC specific items from CUSTOMER', () => {
      renderWithRouter(<Sidebar userRole="CUSTOMER" />)
      expect(screen.queryByText('Customers')).not.toBeInTheDocument()
      expect(screen.queryByText('Tax Processing')).not.toBeInTheDocument()
    })

    it('hides TAX_ADVISOR_JTC specific items from CUSTOMER', () => {
      renderWithRouter(<Sidebar userRole="CUSTOMER" />)
      expect(screen.queryByText('Approval Queue')).not.toBeInTheDocument()
      expect(screen.queryByText('Bulk Submit')).not.toBeInTheDocument()
      expect(screen.queryByText('Team')).not.toBeInTheDocument()
    })
  })

  it('has correct sidebar width class', () => {
    const { container } = renderWithRouter(<Sidebar userRole="CUSTOMER" />)
    const sidebar = container.querySelector('aside')
    expect(sidebar).toHaveClass('w-60') // 240px
  })
})
