# JTC VAT 템플릿 — EFAKTUR DATE 셀 수정 요청 / Permintaan Perbaikan Sel EFAKTUR DATE

- **Date / Tanggal**: 2026-06-09
- **From / Dari**: Ai Pajak 운영팀 (Operations)
- **To / Kepada**: JTC 세무사팀 (Tax Consultant Team)
- **Subject / Subjek**: `3. (JAKARTA TAX CONSULTING)_TEMPLATE-VAT.xlsx` — 샘플 row 의 EFAKTUR DATE 셀에 저장된 값과 표시 값이 일치하지 않습니다 / Nilai tersimpan dan nilai ditampilkan tidak cocok pada sel EFAKTUR DATE di baris contoh.

---

## 한국어 — 요청 내용

### 발견

JTC 가 신규 법인 고객에게 배포하는 PPN 월별 신고 공식 템플릿 `3. (JAKARTA TAX CONSULTING)_TEMPLATE-VAT.xlsx` 의 **샘플 row (VAT OUT, NO=1)** 의 `EFAKTUR DATE` 셀 (H10) 에 다음과 같은 불일치가 있습니다.

| 항목 | 값 |
|---|---|
| 사용자가 Excel 에서 보는 값 (`w`) | `11/1/25` |
| 실제 셀에 저장된 값 (`v`) | `2025-10-31 14:59:08` UTC |

→ 사용자가 의도한 날짜는 (DD/MM/YY 인니 관행 기준) **2025년 1월 11일** 으로 보이나, 셀 내부 저장 값은 **2025년 10월 31일 22:59** (WIB) 입니다. 두 값이 완전히 다른 날짜입니다.

### 원인 (추정)

샘플 데이터 입력 시 사용자 PC 의 locale 이 다른 환경 (미국 등 MM/DD/YY) 이었거나, 다른 셀에서 paste 되면서 stored value 가 displayed text 와 어긋났을 가능성. 또는 셀에 date format 만 입혔지만 stored value 가 다른 시점에서 들어온 케이스.

### 우리 시스템 영향

Ai Pajak 의 import 파서는 **저장된 값 (`v`) 을 신뢰** 하도록 설계되어 있습니다 (locale 의존 표시 값을 신뢰하면 다른 silent bug 를 가릴 수 있어 의도적). 결과적으로 **고객이 Excel 에서 보는 날짜와 시스템에 들어가는 날짜가 다른** 상태가 됩니다.

오늘 작업 (commit `2ca83b8`) 으로 빈 slot detection + 원본 Excel row 표시 등 다른 silent quality 이슈는 모두 해결됐으나, **이 날짜 mismatch 만은 파일 자체의 수정이 필요** 합니다.

### 요청

다음 중 하나로 처리 부탁드립니다:

1. **권장**: 샘플 row 의 `EFAKTUR DATE` 셀 (H10) 을 삭제 후 재입력. Excel 에서 `2025-01-11` 또는 `11-Jan-2025` 형식으로 다시 타이핑하면 v/w 가 다시 일치합니다.
2. 또는 ISO 형식 (`2025-01-11`) 만 강제 사용한 새 sample row 로 교체.
3. 또는 샘플 row 를 비우고 (NO 만 남기고) 빈 4-slot 템플릿으로 배포 — 우리 importer 가 빈 slot 을 silently skip 하므로 영향 없음.

### 후속

수정된 파일 다시 받으면 `scripts/verify-ppn-jtc-template-contract.ts` 로 재검증 후 운영팀 매뉴얼에 "최신 버전 파일" 로 갱신.

---

## Bahasa Indonesia — Permintaan

### Temuan

Pada template resmi PPN bulanan yang JTC bagikan ke nasabah korporasi baru, `3. (JAKARTA TAX CONSULTING)_TEMPLATE-VAT.xlsx`, **baris contoh (VAT OUT, NO=1)** sel `EFAKTUR DATE` (H10) menunjukkan ketidakcocokan berikut.

| Item | Nilai |
|---|---|
| Nilai yang ditampilkan di Excel (`w`) | `11/1/25` |
| Nilai aktual tersimpan di sel (`v`) | `2025-10-31 14:59:08` UTC |

→ Tanggal yang dimaksud (berdasarkan konvensi DD/MM/YY Indonesia) tampaknya **11 Januari 2025**, namun nilai tersimpan internal adalah **31 Oktober 2025 22:59** (WIB). Dua tanggal yang sepenuhnya berbeda.

### Kemungkinan Penyebab

Saat memasukkan data contoh, locale PC pengguna mungkin berbeda (misalnya AS dengan MM/DD/YY), atau nilai disalin-tempel dari sel lain sehingga nilai tersimpan tidak sinkron dengan teks yang ditampilkan. Atau, format tanggal diterapkan pada sel tetapi nilai aktualnya berasal dari titik waktu yang berbeda.

### Dampak pada Sistem Kami

Parser import Ai Pajak dirancang untuk **mempercayai nilai tersimpan (`v`)** (sengaja, karena mempercayai nilai tampilan yang bergantung pada locale dapat menyembunyikan bug halus lainnya). Akibatnya, **tanggal yang dilihat nasabah di Excel berbeda dengan tanggal yang masuk ke sistem**.

Pekerjaan hari ini (commit `2ca83b8`) telah menyelesaikan masalah silent quality lainnya (deteksi slot kosong, pelacakan baris Excel asli), namun **ketidakcocokan tanggal ini memerlukan perbaikan pada file itu sendiri**.

### Permintaan

Mohon ditangani dengan salah satu cara berikut:

1. **Direkomendasikan**: Hapus dan ketik ulang sel `EFAKTUR DATE` (H10) di baris contoh. Mengetik ulang dalam format `2025-01-11` atau `11-Jan-2025` di Excel akan menyinkronkan kembali nilai v/w.
2. Atau ganti dengan baris contoh baru yang menggunakan format ISO (`2025-01-11`) saja.
3. Atau kosongkan baris contoh (sisakan hanya NO) dan distribusikan template 4-slot kosong — importer kami melewatkan slot kosong secara silent sehingga tidak berdampak.

### Tindak Lanjut

Setelah menerima file yang diperbaiki, kami akan validasi ulang dengan `scripts/verify-ppn-jtc-template-contract.ts` dan memperbarui manual operasi dengan "versi file terbaru".

---

## 부록 / Lampiran — 기술 세부 정보

기술자 분께만:

```
Cell H10 raw XLSX object:
  { t: 'd',  v: 2025-10-31T14:59:08.000Z,  w: '11/1/25' }
```

`t='d'` (date type) + 저장 값과 표시 형식이 분리됨. 정상적인 Excel date entry 라면 `v` 가 자정 (00:00) 으로 떨어지지만, 본 셀은 `14:59:08` 초까지 포함된 specific moment — 직접 입력이 아닌 다른 source 에서 들어왔거나 시스템 timestamp 가 그대로 남은 흔적입니다.

확인 명령 (참고):
```bash
node -e "
const X=require('xlsx');
const w=X.readFile('3. (JAKARTA TAX CONSULTING)_TEMPLATE-VAT.xlsx');
console.log(w.Sheets[w.SheetNames[0]]['H10']);
"
```
