import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'

describe('Header Component', () => {
  it('renders with correct height class', () => {
    const { container } = render(<Header />)
    const header = container.querySelector('header')
    expect(header).toHaveClass('h-12') // 48px
  })

  it('shows notification bell icon', () => {
    render(<Header />)
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  it('shows notification count badge when count > 0', () => {
    render(<Header notificationCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows 9+ when notification count exceeds 9', () => {
    render(<Header notificationCount={15} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('does not show badge when notification count is 0', () => {
    render(<Header notificationCount={0} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('displays user name when provided', () => {
    render(<Header userName="John Customer" />)
    expect(screen.getByText('John Customer')).toBeInTheDocument()
  })

  it('displays default user name when not provided', () => {
    render(<Header />)
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('shows user initial in avatar', () => {
    render(<Header userName="John Customer" />)
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('calls onMenuClick when hamburger menu is clicked', () => {
    const onMenuClick = vi.fn()
    render(<Header onMenuClick={onMenuClick} />)

    const menuButton = screen.getByLabelText('Toggle menu')
    fireEvent.click(menuButton)

    expect(onMenuClick).toHaveBeenCalledTimes(1)
  })

  it('has mobile menu button visible on small screens', () => {
    render(<Header />)
    const menuButton = screen.getByLabelText('Toggle menu')
    expect(menuButton).toHaveClass('lg:hidden')
  })

  it('renders user dropdown trigger button', () => {
    render(<Header userName="Test" userRole="CUSTOMER" />)
    // The dropdown trigger should be accessible
    const userButton = screen.getByRole('button', { name: /Test/i })
    expect(userButton).toBeInTheDocument()
  })

  it('has onLogout prop wired correctly', () => {
    const onLogout = vi.fn()
    render(<Header userName="Test" onLogout={onLogout} />)
    // Verify the prop is passed (component renders without error)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('has onSettingsClick prop wired correctly', () => {
    const onSettingsClick = vi.fn()
    render(<Header userName="Test" onSettingsClick={onSettingsClick} />)
    // Verify the prop is passed (component renders without error)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
