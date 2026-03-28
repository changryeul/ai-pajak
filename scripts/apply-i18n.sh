#!/bin/bash
# Apply i18n to remaining pages
# Adds useTranslations import and replaces hardcoded text

# Helper: Add useTranslations import if not present
add_import() {
  local file=$1
  if ! grep -q "useTranslations" "$file"; then
    sed -i '' "s|from 'next/navigation';|from 'next/navigation';\nimport { useTranslations } from 'next-intl';|" "$file"
  fi
}

# SPT Tahunan page
FILE="src/app/[locale]/(dashboard)/tax/spt-tahunan/page.tsx"
add_import "$FILE"
sed -i '' 's|const t = useTranslations('\''tax'\'');|const t = useTranslations();\n  const tt = useTranslations('\''tax'\'');|' "$FILE"
sed -i '' "s|AI Auto-fill Available|{t('pages.sptAutofillAvailable')}|g" "$FILE" 2>/dev/null
sed -i '' "s|Pilih jenis formulir SPT Tahunan yang sesuai dengan kondisi Anda|{t('pages.selectSptForm')}|g" "$FILE" 2>/dev/null
sed -i '' "s|Tidak yakin formulir mana?|{t('pages.notSureForm')}|g" "$FILE" 2>/dev/null
sed -i '' "s|Upload Dokumen|{t('pages.uploadDoc')}|g" "$FILE" 2>/dev/null

# Tax Savings page
FILE="src/app/[locale]/(dashboard)/tax/savings/page.tsx"
add_import "$FILE"

# Anomaly Detection page
FILE="src/app/[locale]/(dashboard)/tax/anomaly/page.tsx"
add_import "$FILE"

# Tax Report page
FILE="src/app/[locale]/(dashboard)/tax/report/page.tsx"
add_import "$FILE"

# PPh21 Bulk page
FILE="src/app/[locale]/(dashboard)/tax/pph21-bulk/page.tsx"
add_import "$FILE"

# Chat page
FILE="src/app/[locale]/(dashboard)/chat/page.tsx"
add_import "$FILE"

# Marketplace page
FILE="src/app/[locale]/(dashboard)/marketplace/page.tsx"
add_import "$FILE"

# Referral page
FILE="src/app/[locale]/(dashboard)/referral/page.tsx"
add_import "$FILE"

echo "Done! Import statements added."
