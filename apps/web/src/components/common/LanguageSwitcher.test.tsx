import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from './LanguageSwitcher';
import i18n from '@/i18n';

describe('LanguageSwitcher Component', () => {
  beforeEach(() => {
    // Reset to English before each test
    i18n.changeLanguage('en');
  });

  it('renders the language switcher button', () => {
    render(<LanguageSwitcher />);
    const button = screen.getByLabelText('Change language');
    expect(button).toBeInTheDocument();
  });

  it('shows dropdown menu when clicked', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');
    await user.click(button);

    // Dropdown menu items should now be visible
    expect(await screen.findByText('English')).toBeInTheDocument();
    expect(screen.getByText('한국어')).toBeInTheDocument();
    expect(screen.getByText('Bahasa Indonesia')).toBeInTheDocument();
  });

  it('changes language when Korean is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');
    await user.click(button);

    const koreanOption = await screen.findByText('한국어');
    await user.click(koreanOption);

    expect(i18n.language).toBe('ko');
  });

  it('changes language when Indonesian is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');
    await user.click(button);

    const indonesianOption = await screen.findByText('Bahasa Indonesia');
    await user.click(indonesianOption);

    expect(i18n.language).toBe('id');
  });

  it('persists language selection to localStorage', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');
    await user.click(button);

    const indonesianOption = await screen.findByText('Bahasa Indonesia');
    await user.click(indonesianOption);

    // i18next should persist to localStorage
    expect(localStorage.getItem('i18nextLng')).toBe('id');
  });

  it('highlights currently selected language in dropdown', async () => {
    const user = userEvent.setup();
    i18n.changeLanguage('ko');
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');
    await user.click(button);

    const koreanOption = await screen.findByText('한국어');
    expect(koreanOption.closest('[role="menuitem"]')).toHaveClass('bg-accent');
  });

  it('handles rapid language switching correctly', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const button = screen.getByLabelText('Change language');

    // Switch to Korean
    await user.click(button);
    await user.click(await screen.findByText('한국어'));
    expect(i18n.language).toBe('ko');

    // Switch to Indonesian
    await user.click(button);
    await user.click(await screen.findByText('Bahasa Indonesia'));
    expect(i18n.language).toBe('id');

    // Switch back to English
    await user.click(button);
    await user.click(await screen.findByText('English'));
    expect(i18n.language).toBe('en');
  });

  it('maintains language after component remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LanguageSwitcher />);

    // Change to Korean
    const button = screen.getByLabelText('Change language');
    await user.click(button);
    await user.click(await screen.findByText('한국어'));

    // Unmount and remount
    unmount();
    render(<LanguageSwitcher />);

    // Language should still be Korean
    expect(i18n.language).toBe('ko');
  });
});
