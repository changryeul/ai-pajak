# AI Pajak Design System

**Version**: 1.0
**Last Updated**: 2025-12-23

---

## Brand Identity

### Vision
신뢰할 수 있고 전문적인 세무 플랫폼, 하지만 사용하기 쉽고 친근한 경험 제공

### Brand Personality
- **Professional** (전문적) - 세무는 정확해야 함
- **Trustworthy** (신뢰) - 민감한 세무 데이터 다룸
- **Simple** (단순) - 복잡한 세무를 쉽게
- **Efficient** (효율적) - 시간 절약이 핵심 가치

---

## Color Palette

### Primary Colors

```css
/* Main Brand Color - Trust & Professionalism */
--primary-blue: #2563EB;      /* Blue-600 - CTA buttons, links */
--primary-blue-dark: #1E40AF;  /* Blue-700 - Hover state */
--primary-blue-light: #DBEAFE; /* Blue-100 - Backgrounds */

/* Secondary - Success & Safety */
--secondary-green: #059669;    /* Green-600 - Success, completed */
--secondary-green-light: #D1FAE5; /* Green-100 - Success backgrounds */

/* Accent - Warning & Attention */
--accent-orange: #EA580C;      /* Orange-600 - Warnings, urgent */
--accent-yellow: #FBBF24;      /* Yellow-400 - Pending, in-progress */
```

### Semantic Colors

```css
/* Status Colors */
--status-success: #10B981;     /* Green-500 - ✅ Completed */
--status-warning: #F59E0B;     /* Yellow-500 - ⏳ Pending */
--status-danger: #EF4444;      /* Red-500 - ❌ Error, overdue */
--status-info: #3B82F6;        /* Blue-500 - ℹ️ Information */

/* Neutral Colors */
--gray-900: #111827;           /* Text - Primary */
--gray-700: #374151;           /* Text - Secondary */
--gray-500: #6B7280;           /* Text - Tertiary */
--gray-300: #D1D5DB;           /* Borders */
--gray-100: #F3F4F6;           /* Backgrounds */
--gray-50: #F9FAFB;            /* Subtle backgrounds */
--white: #FFFFFF;
```

### Usage Guidelines

| Color | Use Case | Example |
|-------|----------|---------|
| Primary Blue | CTA buttons, primary actions | "제출하기", "승인" |
| Green | Success states, completed tasks | "✅ 제출 완료" |
| Yellow | Pending, in-progress | "⏳ 검토 중" |
| Orange/Red | Urgent, errors, deadlines | "마감일 D-2" |
| Gray | Text, borders, backgrounds | Content, UI structure |

---

## Typography

### Font Family

```css
/* Korean + English Support */
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui,
             'Segoe UI', Roboto, sans-serif;
```

**Pretendard**: 한글 가독성 우수, 다양한 weight 지원

### Font Sizes & Weights

```css
/* Headings */
--h1: 2.5rem (40px);   /* Page titles */
--h2: 2rem (32px);     /* Section headers */
--h3: 1.5rem (24px);   /* Subsection headers */
--h4: 1.25rem (20px);  /* Card titles */
--h5: 1.125rem (18px); /* List headers */

/* Body Text */
--text-lg: 1.125rem (18px);  /* Emphasized text */
--text-base: 1rem (16px);    /* Default body text */
--text-sm: 0.875rem (14px);  /* Secondary text */
--text-xs: 0.75rem (12px);   /* Captions, labels */

/* Font Weights */
--weight-bold: 700;      /* Headings, emphasis */
--weight-semibold: 600;  /* Buttons, important text */
--weight-medium: 500;    /* Subheadings */
--weight-regular: 400;   /* Body text */
```

### Usage Guidelines

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page Title | 40px | Bold | Gray-900 |
| Section Header | 32px | Bold | Gray-900 |
| Card Title | 20px | Semibold | Gray-900 |
| Body Text | 16px | Regular | Gray-700 |
| Label | 14px | Medium | Gray-600 |
| Caption | 12px | Regular | Gray-500 |

---

## Spacing System

### 8px Grid System

```css
--space-1: 0.25rem (4px);
--space-2: 0.5rem (8px);
--space-3: 0.75rem (12px);
--space-4: 1rem (16px);
--space-5: 1.25rem (20px);
--space-6: 1.5rem (24px);
--space-8: 2rem (32px);
--space-10: 2.5rem (40px);
--space-12: 3rem (48px);
--space-16: 4rem (64px);
```

### Usage Guidelines

| Use Case | Spacing |
|----------|---------|
| Component padding | 16px (space-4) |
| Section gaps | 32px (space-8) |
| Card spacing | 24px (space-6) |
| Input padding | 12px (space-3) |
| Button padding | 12px 24px |

---

## Components

### Buttons

#### Primary Button
```css
background: var(--primary-blue);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
font-size: 16px;

/* Hover */
background: var(--primary-blue-dark);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

#### Secondary Button
```css
background: white;
color: var(--primary-blue);
border: 1px solid var(--gray-300);
padding: 12px 24px;
border-radius: 8px;
```

#### Danger Button
```css
background: var(--status-danger);
color: white;
/* Same as primary but red */
```

### Input Fields

```css
border: 1px solid var(--gray-300);
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;
color: var(--gray-900);

/* Focus */
border-color: var(--primary-blue);
box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);

/* Error */
border-color: var(--status-danger);

/* Disabled */
background: var(--gray-100);
cursor: not-allowed;
```

### Cards

```css
background: white;
border: 1px solid var(--gray-200);
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 3px rgba(0,0,0,0.1);

/* Hover (if clickable) */
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
transform: translateY(-2px);
transition: all 0.2s;
```

### Status Badges

```css
/* Success */
background: var(--secondary-green-light);
color: var(--secondary-green);
padding: 4px 12px;
border-radius: 12px;
font-size: 14px;
font-weight: 500;

/* Warning */
background: #FEF3C7; /* Yellow-100 */
color: var(--accent-yellow);

/* Danger */
background: #FEE2E2; /* Red-100 */
color: var(--status-danger);
```

---

## Iconography

### Icon Library
**Heroicons** (https://heroicons.com/)
- Solid icons for filled states
- Outline icons for borders

### Icon Sizes

| Size | Use Case |
|------|----------|
| 16px | Inline text icons |
| 20px | Buttons, small UI elements |
| 24px | Default UI icons |
| 32px | Section headers |
| 48px | Empty states, illustrations |

### Icon Colors

| State | Color |
|-------|-------|
| Default | Gray-500 |
| Active | Primary Blue |
| Success | Green |
| Warning | Yellow |
| Danger | Red |

---

## Shadows & Elevation

```css
/* Card Elevation */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-base: 0 1px 3px rgba(0,0,0,0.1);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.1);

/* Focus Ring */
--focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.1);
```

---

## Border Radius

```css
--radius-sm: 4px;   /* Small elements */
--radius-md: 8px;   /* Default (buttons, inputs) */
--radius-lg: 12px;  /* Cards */
--radius-xl: 16px;  /* Modals */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Animations

### Transitions

```css
--transition-fast: 0.15s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
```

### Usage
- Button hover: `transition-base`
- Modal open: `transition-slow`
- Tooltip: `transition-fast`

---

## Responsive Breakpoints

```css
--screen-sm: 640px;   /* Mobile */
--screen-md: 768px;   /* Tablet */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large Desktop */
--screen-2xl: 1536px; /* Extra Large */
```

---

## Accessibility

### Contrast Ratios
- Text (normal): 4.5:1 minimum
- Text (large): 3:1 minimum
- Interactive elements: 3:1 minimum

### Touch Targets
- Minimum size: 44x44px
- Spacing between targets: 8px

### Focus States
- Always visible keyboard focus
- Focus ring: 3px blue outline
- Skip navigation links

---

## Example Usage

### Tax Consultant Dashboard Card

```jsx
<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-base hover:shadow-md transition-base">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-gray-900">ABC Corp</h3>
    <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
      ✅ 제출 완료
    </span>
  </div>
  <p className="text-sm text-gray-600">PPh 21: 완료</p>
  <p className="text-sm text-gray-600">마감일: D-5</p>
</div>
```

---

## Design Tokens (Tailwind Config)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1E40AF',
          light: '#DBEAFE',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

---

## Related Documentation

- [Wireframes](wireframes/README.md)
- [Screen Specifications](screens/README.md)
- [User Flows](user-flows.md)
