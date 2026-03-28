/**
 * Generate OG Image and PWA Icons for AI Pajak
 * Run: npx tsx scripts/generate-og-image.ts
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function generateOGImage() {
  // Create a 1200x630 canvas using PDF as intermediate (will be used as-is or converted)
  const doc = await PDFDocument.create();
  const page = doc.addPage([1200, 630]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Background gradient (blue to indigo)
  page.drawRectangle({
    x: 0, y: 0, width: 1200, height: 630,
    color: rgb(0.145, 0.388, 0.922), // blue-600
  });

  // Darker overlay on right
  page.drawRectangle({
    x: 600, y: 0, width: 600, height: 630,
    color: rgb(0.310, 0.275, 0.898), // indigo-600
    opacity: 0.5,
  });

  // Decorative circles
  page.drawCircle({ x: 1100, y: 530, size: 200, color: rgb(1, 1, 1), opacity: 0.05 });
  page.drawCircle({ x: 100, y: 100, size: 150, color: rgb(1, 1, 1), opacity: 0.05 });
  page.drawCircle({ x: 800, y: 300, size: 100, color: rgb(1, 1, 1), opacity: 0.03 });

  // Logo box
  page.drawRectangle({
    x: 80, y: 440, width: 70, height: 70,
    color: rgb(1, 1, 1), opacity: 0.2,
    borderColor: rgb(1, 1, 1), borderWidth: 0,
  });

  // "AI" text in logo
  page.drawText('AI', {
    x: 93, y: 460,
    font: font,
    size: 36,
    color: rgb(1, 1, 1),
  });

  // "PAJAK" next to logo
  page.drawText('PAJAK', {
    x: 165, y: 460,
    font: font,
    size: 40,
    color: rgb(1, 1, 1),
  });

  // Main title
  page.drawText('Platform Pajak Cerdas', {
    x: 80, y: 360,
    font: font,
    size: 52,
    color: rgb(1, 1, 1),
  });

  page.drawText('Indonesia', {
    x: 80, y: 300,
    font: font,
    size: 52,
    color: rgb(1, 1, 1),
  });

  // Subtitle
  page.drawText('Hitung, Lapor, dan Optimalkan Pajak', {
    x: 80, y: 240,
    font: fontRegular,
    size: 24,
    color: rgb(0.749, 0.827, 1), // blue-200
  });

  page.drawText('dengan Teknologi AI Terdepan', {
    x: 80, y: 210,
    font: fontRegular,
    size: 24,
    color: rgb(0.749, 0.827, 1),
  });

  // Feature badges
  const badges = ['SPT Auto-fill', 'AI OCR', 'Tax Savings', 'Smart Validation'];
  let badgeX = 80;
  for (const badge of badges) {
    const textWidth = fontRegular.widthOfTextAtSize(badge, 16);
    page.drawRectangle({
      x: badgeX, y: 140, width: textWidth + 24, height: 32,
      color: rgb(1, 1, 1), opacity: 0.15,
    });
    page.drawText(badge, {
      x: badgeX + 12, y: 150,
      font: fontRegular,
      size: 16,
      color: rgb(1, 1, 1),
    });
    badgeX += textWidth + 36;
  }

  // Right side - Stats
  const stats = [
    { value: '5', label: 'Bahasa' },
    { value: '62+', label: 'Fitur' },
    { value: '40M+', label: 'WP Target' },
  ];

  let statY = 420;
  for (const stat of stats) {
    page.drawText(stat.value, {
      x: 850, y: statY,
      font: font,
      size: 48,
      color: rgb(1, 1, 1),
    });
    page.drawText(stat.label, {
      x: 850, y: statY - 30,
      font: fontRegular,
      size: 18,
      color: rgb(0.749, 0.827, 1),
    });
    statY -= 100;
  }

  // URL at bottom
  page.drawText('aipajak.com', {
    x: 80, y: 60,
    font: fontRegular,
    size: 20,
    color: rgb(1, 1, 1),
    opacity: 0.7,
  });

  // Save as PDF (can be converted to PNG using external tools)
  const pdfBytes = await doc.save();
  const publicDir = path.resolve(process.cwd(), 'public');

  // Save PDF version
  fs.writeFileSync(path.join(publicDir, 'og-image.pdf'), pdfBytes);
  console.log('Generated: public/og-image.pdf');

  // Generate SVG version for OG image
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="50%" style="stop-color:#3b52d9"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1100" cy="100" r="200" fill="white" opacity="0.05"/>
  <circle cx="100" cy="530" r="150" fill="white" opacity="0.05"/>
  <circle cx="800" cy="350" r="100" fill="white" opacity="0.03"/>
  <rect x="80" y="60" width="65" height="65" rx="16" fill="white" opacity="0.2"/>
  <text x="94" y="105" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="32" fill="white">AI</text>
  <text x="160" y="105" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="38" fill="white" letter-spacing="2">PAJAK</text>
  <text x="80" y="220" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="52" fill="white">Platform Pajak Cerdas</text>
  <text x="80" y="285" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="52" fill="white">Indonesia</text>
  <text x="80" y="340" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#bfdbfe">Hitung, Lapor, dan Optimalkan Pajak dengan Teknologi AI</text>
  <rect x="80" y="380" width="130" height="36" rx="8" fill="white" opacity="0.15"/>
  <text x="100" y="404" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="white">SPT Auto-fill</text>
  <rect x="222" y="380" width="90" height="36" rx="8" fill="white" opacity="0.15"/>
  <text x="240" y="404" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="white">AI OCR</text>
  <rect x="324" y="380" width="120" height="36" rx="8" fill="white" opacity="0.15"/>
  <text x="342" y="404" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="white">Tax Savings</text>
  <rect x="456" y="380" width="150" height="36" rx="8" fill="white" opacity="0.15"/>
  <text x="472" y="404" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="white">Smart Validation</text>
  <text x="850" y="180" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="56" fill="white">5</text>
  <text x="850" y="210" font-family="Helvetica,Arial,sans-serif" font-size="18" fill="#bfdbfe">Bahasa</text>
  <text x="850" y="300" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="56" fill="white">62+</text>
  <text x="850" y="330" font-family="Helvetica,Arial,sans-serif" font-size="18" fill="#bfdbfe">Fitur</text>
  <text x="850" y="420" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="56" fill="white">40M+</text>
  <text x="850" y="450" font-family="Helvetica,Arial,sans-serif" font-size="18" fill="#bfdbfe">WP Target</text>
  <text x="80" y="580" font-family="Helvetica,Arial,sans-serif" font-size="18" fill="white" opacity="0.6">aipajak.com</text>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'og-image.svg'), svgContent);
  console.log('Generated: public/og-image.svg');

  // Also create a simple PNG placeholder using SVG data URL approach
  // For production, convert SVG to PNG using sharp or similar
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), Buffer.from(svgContent));
  console.log('Generated: public/og-image.png (SVG content - convert to PNG for production)');

  // PWA Icons (simple SVG)
  const iconsDir = path.join(publicDir, 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const iconSvg = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="${size * 0.35}" fill="white">AI</text>
</svg>`;

  fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), iconSvg(192));
  fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), iconSvg(512));
  // PNG placeholders
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), Buffer.from(iconSvg(192)));
  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), Buffer.from(iconSvg(512)));
  console.log('Generated: public/icons/icon-192.png, icon-512.png');

  console.log('\nDone! For production PNG conversion, use:');
  console.log('  npx sharp-cli og-image.svg -o og-image.png --width 1200 --height 630');
}

generateOGImage().catch(console.error);
