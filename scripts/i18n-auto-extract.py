#!/usr/bin/env python3
"""
i18n Auto-Extractor for AI Pajak

Scans a TSX file for Korean text in JSX context, generates i18n keys,
replaces hardcoded text with t() calls, and adds keys to all 5 locale files.

Usage:
  python3 scripts/i18n-auto-extract.py src/app/[locale]/(dashboard)/tax/pph21/page.tsx pph21Page

Arguments:
  1. File path
  2. i18n namespace (e.g. 'pph21Page')

What it does:
  1. Finds Korean text in JSX (not comments, imports, or string constants)
  2. Generates camelCase keys from the Korean text
  3. Creates translations: ko=original, en=placeholder, id=placeholder
  4. Replaces in the source file
  5. Adds keys to ko.json, en.json, id.json, ja.json, zh.json

Review the diff before committing — automated replacement is best-effort.
"""

import re
import sys
import json
import hashlib
from pathlib import Path

def korean_to_key(text: str, idx: int) -> str:
    """Generate a short, stable key from Korean text."""
    # Use hash for stability + index for uniqueness
    clean = re.sub(r'[^가-힣a-zA-Z0-9]', '', text)[:20]
    h = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"k{idx}_{h}"

def extract_korean_strings(content: str) -> list[tuple[int, str, str]]:
    """Extract Korean strings from JSX content.
    Returns list of (line_number, original_text, context)."""
    results = []
    lines = content.split('\n')

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Skip comments, imports, type definitions
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        if stripped.startswith('{/*'):
            continue
        if 'import ' in stripped and 'from ' in stripped:
            continue
        if stripped.startswith('export type') or stripped.startswith('interface '):
            continue

        # Find Korean text segments
        # Pattern: Korean characters possibly mixed with other chars, in JSX or string context
        korean_segments = re.findall(r'[가-힣][가-힣\s\w\-·/%()\.,]*[가-힣\s\w)%.]', line)

        for seg in korean_segments:
            seg = seg.strip()
            if len(seg) < 2:
                continue
            # Skip if it's inside a comment
            comment_pos = line.find('//')
            seg_pos = line.find(seg)
            if comment_pos >= 0 and seg_pos > comment_pos:
                continue
            # Skip JSX comments
            if '{/*' in line and '*/' in line:
                jc_start = line.find('{/*')
                jc_end = line.find('*/')
                if jc_start < seg_pos < jc_end:
                    continue

            results.append((i, seg, stripped[:80]))

    return results

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 i18n-auto-extract.py <file.tsx> <namespace>")
        sys.exit(1)

    filepath = sys.argv[1]
    namespace = sys.argv[2]
    dry_run = '--dry-run' in sys.argv

    with open(filepath) as f:
        content = f.read()

    extractions = extract_korean_strings(content)

    if not extractions:
        print(f"No Korean text found in {filepath}")
        return

    # Deduplicate
    seen = set()
    unique = []
    for line_no, text, ctx in extractions:
        if text not in seen:
            seen.add(text)
            unique.append((line_no, text, ctx))

    print(f"\n📊 Found {len(unique)} unique Korean strings in {filepath}")
    print(f"   Namespace: {namespace}\n")

    # Generate keys and translations
    keys = {}
    for idx, (line_no, text, ctx) in enumerate(unique):
        key = korean_to_key(text, idx)
        keys[key] = {
            'ko': text,
            'en': f'[EN] {text}',  # placeholder — needs manual translation
            'id': f'[ID] {text}',  # placeholder
            'line': line_no,
            'context': ctx,
        }
        print(f"  L{line_no:4d}: {key:20s} ← \"{text[:50]}\"")

    if dry_run:
        print(f"\n🔍 Dry run — no files modified. {len(keys)} keys would be created.")
        return

    # Add to locale files
    for lang in ['ko', 'en', 'id', 'ja', 'zh']:
        locale_path = f'src/i18n/messages/{lang}.json'
        with open(locale_path) as f:
            obj = json.load(f)

        if namespace not in obj:
            obj[namespace] = {}

        for key, vals in keys.items():
            if lang == 'ko':
                obj[namespace][key] = vals['ko']
            elif lang == 'en':
                obj[namespace][key] = vals['en']
            elif lang == 'id':
                obj[namespace][key] = vals['id']
            else:
                obj[namespace][key] = vals['en']  # fallback

        with open(locale_path, 'w') as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f"\n✅ Added {len(keys)} keys to {namespace} in 5 locale files")

    # Replace in source file
    # Check if useTranslations is already imported
    has_use_translations = 'useTranslations' in content
    has_get_translations = 'getTranslations' in content

    if not has_use_translations and not has_get_translations:
        # Add import
        content = content.replace(
            "import { useState",
            "import { useTranslations } from 'next-intl';\nimport { useState",
            1
        )
        print(f"   Added useTranslations import")

    # Replace Korean text with t() calls
    replaced = 0
    for key, vals in keys.items():
        korean = vals['ko']
        # Try different replacement patterns

        # Pattern 1: JSX text content (>Korean<)
        old = f'>{korean}<'
        new = f'>{{t(\'{key}\')}}<'
        if old in content:
            content = content.replace(old, new, 1)
            replaced += 1
            continue

        # Pattern 2: JSX text (standalone on a line with indentation)
        for line in content.split('\n'):
            if korean in line and '//' not in line.split(korean)[0] and '{/*' not in line:
                old_line = line
                new_line = line.replace(korean, f'{{t(\'{key}\')}}', 1)
                if old_line != new_line:
                    content = content.replace(old_line, new_line, 1)
                    replaced += 1
                    break

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"   Replaced {replaced}/{len(keys)} strings in {filepath}")
    print(f"\n⚠️  Review the diff! Automated replacement is best-effort.")
    print(f"   - Check that useTranslations('{namespace}') is called in the component")
    print(f"   - Verify t() calls are in valid JSX positions")
    print(f"   - [EN]/[ID] translations need manual editing")

if __name__ == '__main__':
    main()
