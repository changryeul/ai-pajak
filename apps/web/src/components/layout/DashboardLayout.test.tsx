import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLayout } from './DashboardLayout'

// Wrapper component for router context
function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  )
}

describe('DashboardLayout Component', () => {
  it('renders sidebar on desktop', () => {
    const { container } = renderWithRouter(
      <DashboardLayout userRole="CUSTOMER" userName="Test" />
    )
    // Desktop sidebar container
    const desktopSidebar = container.querySelector('.hidden.lg\\:block')
    expect(desktopSidebar).toBeInTheDocument()
  })

  it('renders header', () => {
    const { container } = renderWithRouter(
      <DashboardLayout userRole="CUSTOMER" userName="Test" />
    )
    expect(container.querySelector('header')).toBeInTheDocument()
  })

  it('has main content area with max-width constraint', () => {
    const { container } = renderWithRouter(
      <DashboardLayout userRole="CUSTOMER" userName="Test" />
    )
    const mainContent = container.querySelector('.max-w-\\[1400px\\]')
    expect(mainContent).toBeInTheDocument()
  })

  it('opens mobile sidebar sheet when menu is clicked', async () => {
    renderWithRouter(
      <DashboardLayout userRole="CUSTOMER" userName="Test" />
    )

    // Click hamburger menu
    const menuButton = screen.getByLabelText('Toggle menu')
    fireEvent.click(menuButton)

    // Sheet should be open - the sidebar content should be visible
    expect(await screen.findAllByText('AI Pajak')).toHaveLength(2) // Desktop + Mobile
  })

  it('passes user info to sidebar and header', () => {
    renderWithRouter(
      <DashboardLayout
        userRole="CONSULTANT_JTC"
        userName="Sarah Consultant"
        userEmail="consultant@example.com"
      />
    )

    // Check username appears (in header and sidebar)
    expect(screen.getAllByText('Sarah Consultant').length).toBeGreaterThan(0)
  })

  it('passes notification count to header', () => {
    renderWithRouter(
      <DashboardLayout
        userRole="CUSTOMER"
        userName="Test"
        notificationCount={7}
      />
    )

    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('has onLogout prop available', () => {
    const onLogout = vi.fn()
    renderWithRouter(
      <DashboardLayout
        userRole="CUSTOMER"
        userName="Test"
        onLogout={onLogout}
      />
    )
    // Component renders without error with onLogout prop
    expect(screen.getAllByText('Test').length).toBeGreaterThan(0)
  })

  it('has onSettingsClick prop available', () => {
    const onSettingsClick = vi.fn()
    renderWithRouter(
      <DashboardLayout
        userRole="CUSTOMER"
        userName="Test"
        onSettingsClick={onSettingsClick}
      />
    )
    // Component renders without error with onSettingsClick prop
    expect(screen.getAllByText('Test').length).toBeGreaterThan(0)
  })

  it('has full height layout', () => {
    const { container } = renderWithRouter(
      <DashboardLayout userRole="CUSTOMER" userName="Test" />
    )
    const layout = container.firstChild
    expect(layout).toHaveClass('h-screen')
  })
})
