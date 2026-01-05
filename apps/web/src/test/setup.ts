import '@testing-library/jest-dom'

// Initialize i18n for tests
import '../i18n'

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
