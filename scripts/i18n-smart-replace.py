#!/usr/bin/env python3
"""
Smart i18n replacer — distinguishes JSX text from JS string literals.

Strategy:
  1. JSX text (>한글< or standalone on indented line) → {t('key')}
  2. JS string literal (label: '한글') → label: t('key')  (direct call, not template)
  3. showMsg/confirm/alert string → use t('key') directly
  4. Array matching constants → SKIP (don't replace)
  5. Comments → SKIP
  6. Placeholders → SKIP

Usage:
  python3 scripts/i18n-smart-replace.py <file.tsx> <namespace>
"""

import re
import sys
import json
import hashlib

def make_key(text: str, idx: int) -> str:
    h = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"k{idx}_{h}"

SKIP_PATTERNS = [
    # Column mapping arrays (Korean as matching hint — don't replace)
    r'\[.*,\s*[\'"]',  # inside array literals like ['급여', 'salary']
    r'console\.',
    r'loggers?\.',
]

def should_skip_line(line: str) -> bool:
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('{/*'):
        return True
    if 'import ' in stripped and 'from ' in stripped:
        return True
    # Array mapping patterns — Korean used as fuzzy match keys
    if re.search(r"\[\s*'[^']*',\s*'[^']*'", line):
        if 'employee_name' in line or 'gross_salary' in line or 'position' in line:
            return True
    return False

def classify_context(line: str, korean: str) -> str:
    """Classify whether Korean text is in JSX, JS string, or should be skipped."""
    stripped = line.strip()

    # showMsg / confirm / alert — replace the whole string arg
    if any(fn in line for fn in ['showMsg(', 'confirm(', 'alert(', 'setError(']):
        return 'function_arg'

    # label: '한글' or placeholder="한글" patterns
    if re.search(r"label:\s*'[^']*" + re.escape(korean), line):
        return 'js_label'
    if re.search(r'placeholder="[^"]*' + re.escape(korean), line):
        return 'jsx_attr'

    # JSX text content
    if '>' in line and '<' in line:
        return 'jsx'

    # Standalone text in JSX (indented, no assignment)
    if stripped == korean or stripped.startswith(korean):
        return 'jsx'

    # Default: treat as JSX
    return 'jsx'

def replace_in_context(line: str, korean: str, key: str, ctx: str) -> str:
    """Replace Korean text based on its context."""
    if ctx == 'function_arg':
        # showMsg('error', '한글') → showMsg('error', t('key'))
        line = line.replace(f"'{korean}'", f"t('{key}')")
        line = line.replace(f'"{korean}"', f"t('{key}')")
        # Template literal: `한글` → t('key')
        line = line.replace(f"`{korean}`", f"t('{key}')")
        # Partial in template: `${count}한글` — harder, just replace the Korean part
        if korean in line:
            line = line.replace(korean, f"${{t('{key}')}}")
    elif ctx == 'js_label':
        # label: '한글' → label: t('key')
        line = line.replace(f"'{korean}'", f"t('{key}')")
        # label: '한글 *' → label: `${t('key')} *`
        for match in re.finditer(r"'([^']*" + re.escape(korean) + r"[^']*)'", line):
            full = match.group(0)
            inner = match.group(1)
            new_inner = inner.replace(korean, f"${{t('{key}')}}")
            line = line.replace(full, f"`{new_inner}`")
    elif ctx == 'jsx_attr':
        # placeholder="한글" → placeholder={t('key')}
        line = line.replace(f'"{korean}"', f"{{t('{key}')}}")
        # placeholder="한글 text" → harder
        if korean in line:
            line = re.sub(
                f'"([^"]*){re.escape(korean)}([^"]*)"',
                lambda m: f'{{t(\'{key}\')}}' if not m.group(1) and not m.group(2) else f'{{`{m.group(1)}${{t(\'{key}\')}}{m.group(2)}`}}',
                line
            )
    else:  # jsx
        # >한글< → >{t('key')}<
        line = line.replace(f'>{korean}<', f'>{{t(\'{key}\')}}<')
        # Standalone Korean text in JSX
        if korean in line:
            line = line.replace(korean, f"{{t('{key}')}}")

    return line

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 i18n-smart-replace.py <file.tsx> <namespace>")
        sys.exit(1)

    filepath = sys.argv[1]
    namespace = sys.argv[2]
    dry_run = '--dry-run' in sys.argv

    with open(filepath) as f:
        lines = f.readlines()

    # Extract Korean strings with context
    extractions = []  # (line_idx, korean, context)
    seen_korean = set()

    for i, line in enumerate(lines):
        if should_skip_line(line):
            continue

        koreans = re.findall(r'[가-힣][가-힣\s\w\-·/%()\.,!?~→]*[가-힣\w)%.]', line)
        for k in koreans:
            k = k.strip()
            if len(k) < 2 or k in seen_korean:
                continue
            # Skip if inside a comment on this line
            comment_pos = line.find('//')
            if comment_pos >= 0 and line.find(k) > comment_pos:
                continue
            jc_start = line.find('{/*')
            jc_end = line.find('*/')
            if jc_start >= 0 and jc_end >= 0 and jc_start < line.find(k) < jc_end:
                continue

            ctx = classify_context(line, k)
            extractions.append((i, k, ctx))
            seen_korean.add(k)

    print(f"\n📊 {filepath}: {len(extractions)} unique Korean strings")

    if not extractions:
        return

    # Generate keys
    keys = {}
    for idx, (line_idx, korean, ctx) in enumerate(extractions):
        key = make_key(korean, idx)
        keys[korean] = {'key': key, 'ctx': ctx, 'line': line_idx + 1}
        flag = '⏭' if ctx == 'skip' else '✓'
        if not dry_run:
            print(f"  {flag} L{line_idx+1:4d} [{ctx:12s}] {key:15s} ← \"{korean[:40]}\"")

    if dry_run:
        print(f"\n🔍 Dry run — {len(keys)} keys")
        for korean, info in keys.items():
            print(f"  [{info['ctx']:12s}] {info['key']:15s} ← \"{korean[:50]}\"")
        return

    # Add to locale files
    for lang in ['ko', 'en', 'id', 'ja', 'zh']:
        locale_path = f'src/i18n/messages/{lang}.json'
        with open(locale_path) as f:
            obj = json.load(f)
        if namespace not in obj:
            obj[namespace] = {}
        for korean, info in keys.items():
            k = info['key']
            if lang == 'ko':
                obj[namespace][k] = korean
            else:
                obj[namespace][k] = korean  # Keep Korean for now, translate later
        with open(locale_path, 'w') as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f"\n✅ Added {len(keys)} keys to {namespace}")

    # Replace in source
    new_lines = []
    replaced = 0
    for i, line in enumerate(lines):
        modified = line
        for korean, info in keys.items():
            if korean in modified and not should_skip_line(modified):
                old = modified
                modified = replace_in_context(modified, korean, info['key'], info['ctx'])
                if modified != old:
                    replaced += 1
        new_lines.append(modified)

    # Add useTranslations if not present
    content = ''.join(new_lines)
    if 'useTranslations' not in content:
        content = content.replace(
            "import { useState",
            f"import {{ useTranslations }} from 'next-intl';\nimport {{ useState",
            1
        )

    # Add t() call if not present
    # Find the component function and add const t = useTranslations(namespace)
    if f"useTranslations('{namespace}')" not in content:
        # Find first useState after export
        match = re.search(r'(export (?:default )?function \w+[^{]*\{)\s*\n(\s+)', content)
        if match:
            indent = match.group(2)
            content = content.replace(
                match.group(0),
                f"{match.group(1)}\n{indent}const t = useTranslations('{namespace}');\n{indent}",
                1
            )

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"   Replaced {replaced} occurrences")
    print(f"\n⚠️  BUILD CHECK required — review the diff before committing")

if __name__ == '__main__':
    main()
