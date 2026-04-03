/**
 * PPh 23 Jasa Lain Service Codes (PMK 141/PMK.03/2015)
 *
 * 62 service types subject to 2% PPh 23 withholding.
 * Used for e-Bupot reporting where specific service codes are required.
 */

export interface PPh23ServiceCode {
  /** Internal code identifier */
  code: string;
  /** Indonesian description */
  descriptionId: string;
  /** English description */
  descriptionEn: string;
  /** e-Bupot reporting code */
  ebupotCode: string;
  /** Tax rate (always 0.02 for jasa lain) */
  rate: number;
  /** PMK reference number */
  pmkRef: string;
  /** Related KBLI codes (primary) */
  kbliCodes?: string[];
}

export const PPH23_SERVICE_CODES: PPh23ServiceCode[] = [
  { code: 'JASA_PENILAI', descriptionId: 'Jasa penilai (appraisal)', descriptionEn: 'Appraisal services', ebupotCode: '24-104-01', rate: 0.02, pmkRef: 'PMK 141/2015 No.1', kbliCodes: ['74901'] },
  { code: 'JASA_AKTUARIS', descriptionId: 'Jasa aktuaris', descriptionEn: 'Actuarial services', ebupotCode: '24-104-02', rate: 0.02, pmkRef: 'PMK 141/2015 No.2', kbliCodes: ['66290'] },
  { code: 'JASA_AKUNTANSI', descriptionId: 'Jasa akuntansi, pembukuan, dan atestasi laporan keuangan', descriptionEn: 'Accounting, bookkeeping & financial attestation', ebupotCode: '24-104-03', rate: 0.02, pmkRef: 'PMK 141/2015 No.3', kbliCodes: ['69200'] },
  { code: 'JASA_HUKUM', descriptionId: 'Jasa hukum', descriptionEn: 'Legal services', ebupotCode: '24-104-04', rate: 0.02, pmkRef: 'PMK 141/2015 No.4', kbliCodes: ['69100'] },
  { code: 'JASA_ARSITEKTUR', descriptionId: 'Jasa arsitektur', descriptionEn: 'Architecture services', ebupotCode: '24-104-05', rate: 0.02, pmkRef: 'PMK 141/2015 No.5', kbliCodes: ['71101'] },
  { code: 'JASA_PERENCANAAN_KOTA', descriptionId: 'Jasa perencanaan kota dan lansekap', descriptionEn: 'City planning & landscape architecture', ebupotCode: '24-104-06', rate: 0.02, pmkRef: 'PMK 141/2015 No.6', kbliCodes: ['71102'] },
  { code: 'JASA_PERANCANG', descriptionId: 'Jasa perancang (desain)', descriptionEn: 'Design services', ebupotCode: '24-104-07', rate: 0.02, pmkRef: 'PMK 141/2015 No.7', kbliCodes: ['74100'] },
  { code: 'JASA_PENGEBORAN_MIGAS', descriptionId: 'Jasa pengeboran di bidang penambangan minyak dan gas bumi', descriptionEn: 'Oil & gas drilling services', ebupotCode: '24-104-08', rate: 0.02, pmkRef: 'PMK 141/2015 No.8', kbliCodes: ['06100'] },
  { code: 'JASA_PENUNJANG_MIGAS', descriptionId: 'Jasa penunjang di bidang penambangan minyak dan gas bumi', descriptionEn: 'Oil & gas support services', ebupotCode: '24-104-09', rate: 0.02, pmkRef: 'PMK 141/2015 No.9' },
  { code: 'JASA_PENAMBANGAN', descriptionId: 'Jasa penambangan dan jasa penunjang di bidang penambangan selain migas', descriptionEn: 'Mining & mining support services', ebupotCode: '24-104-10', rate: 0.02, pmkRef: 'PMK 141/2015 No.10', kbliCodes: ['09900'] },
  { code: 'JASA_PENUNJANG_PENERBANGAN', descriptionId: 'Jasa penunjang di bidang penerbangan dan bandar udara', descriptionEn: 'Aviation & airport support services', ebupotCode: '24-104-11', rate: 0.02, pmkRef: 'PMK 141/2015 No.11' },
  { code: 'JASA_PENEBANGAN_HUTAN', descriptionId: 'Jasa penebangan hutan', descriptionEn: 'Forest logging services', ebupotCode: '24-104-12', rate: 0.02, pmkRef: 'PMK 141/2015 No.12', kbliCodes: ['02200'] },
  { code: 'JASA_PENGOLAHAN_LIMBAH', descriptionId: 'Jasa pengolahan limbah', descriptionEn: 'Waste processing services', ebupotCode: '24-104-13', rate: 0.02, pmkRef: 'PMK 141/2015 No.13', kbliCodes: ['38210'] },
  { code: 'JASA_PENYEDIA_TENAGA_KERJA', descriptionId: 'Jasa penyedia tenaga kerja (outsourcing)', descriptionEn: 'Labor outsourcing services', ebupotCode: '24-104-14', rate: 0.02, pmkRef: 'PMK 141/2015 No.14', kbliCodes: ['78200'] },
  { code: 'JASA_PERANTARA', descriptionId: 'Jasa perantara dan/atau keagenan', descriptionEn: 'Intermediary & agency services', ebupotCode: '24-104-15', rate: 0.02, pmkRef: 'PMK 141/2015 No.15', kbliCodes: ['46100'] },
  { code: 'JASA_PERDAGANGAN_EFEK', descriptionId: 'Jasa di bidang perdagangan surat-surat berharga', descriptionEn: 'Securities trading services', ebupotCode: '24-104-16', rate: 0.02, pmkRef: 'PMK 141/2015 No.16', kbliCodes: ['66110'] },
  { code: 'JASA_KUSTODIAN', descriptionId: 'Jasa kustodian/penyimpanan/penitipan', descriptionEn: 'Custodian/storage services', ebupotCode: '24-104-17', rate: 0.02, pmkRef: 'PMK 141/2015 No.17', kbliCodes: ['66190'] },
  { code: 'JASA_PENGISIAN_SUARA', descriptionId: 'Jasa pengisian suara (dubbing) dan/atau sulih suara', descriptionEn: 'Dubbing & voice-over services', ebupotCode: '24-104-18', rate: 0.02, pmkRef: 'PMK 141/2015 No.18', kbliCodes: ['59120'] },
  { code: 'JASA_MIXING_FILM', descriptionId: 'Jasa mixing film', descriptionEn: 'Film mixing services', ebupotCode: '24-104-19', rate: 0.02, pmkRef: 'PMK 141/2015 No.19', kbliCodes: ['59110'] },
  { code: 'JASA_PEMBUATAN_SARANA_PROMOSI', descriptionId: 'Jasa pembuatan sarana promosi film, iklan, poster, foto, slide, klise, banner, pamflet, baliho, folder, leaflet', descriptionEn: 'Promotional material production', ebupotCode: '24-104-20', rate: 0.02, pmkRef: 'PMK 141/2015 No.20', kbliCodes: ['73110'] },
  { code: 'JASA_SEHUBUNGAN_SOFTWARE', descriptionId: 'Jasa sehubungan dengan software atau hardware atau sistem komputer', descriptionEn: 'Software/hardware/computer system services', ebupotCode: '24-104-21', rate: 0.02, pmkRef: 'PMK 141/2015 No.21', kbliCodes: ['62010', '62020', '62090'] },
  { code: 'JASA_PEMBUATAN_WEBSITE', descriptionId: 'Jasa pembuatan dan/atau pengelolaan website', descriptionEn: 'Website creation & management', ebupotCode: '24-104-22', rate: 0.02, pmkRef: 'PMK 141/2015 No.22', kbliCodes: ['63110'] },
  { code: 'JASA_INTERNET', descriptionId: 'Jasa internet termasuk sambungannya', descriptionEn: 'Internet services & connections', ebupotCode: '24-104-23', rate: 0.02, pmkRef: 'PMK 141/2015 No.23' },
  { code: 'JASA_PENYIMPANAN', descriptionId: 'Jasa penyimpanan, pengolahan, dan/atau penyaluran data, informasi, dan/atau program', descriptionEn: 'Data storage, processing & distribution', ebupotCode: '24-104-24', rate: 0.02, pmkRef: 'PMK 141/2015 No.24' },
  { code: 'JASA_INSTALASI_MESIN', descriptionId: 'Jasa instalasi/pemasangan mesin, peralatan, listrik, telepon, air, gas, AC, dan/atau TV kabel', descriptionEn: 'Machine/equipment installation', ebupotCode: '24-104-25', rate: 0.02, pmkRef: 'PMK 141/2015 No.25', kbliCodes: ['33200'] },
  { code: 'JASA_PERAWATAN', descriptionId: 'Jasa perawatan/perbaikan/pemeliharaan mesin, peralatan, listrik, telepon, air, gas, AC, TV kabel, alat transportasi', descriptionEn: 'Maintenance & repair services', ebupotCode: '24-104-26', rate: 0.02, pmkRef: 'PMK 141/2015 No.26', kbliCodes: ['33110'] },
  { code: 'JASA_MAKLON', descriptionId: 'Jasa maklon', descriptionEn: 'Contract manufacturing (toll manufacturing)', ebupotCode: '24-104-27', rate: 0.02, pmkRef: 'PMK 141/2015 No.27' },
  { code: 'JASA_PENYELIDIKAN', descriptionId: 'Jasa penyelidikan dan keamanan', descriptionEn: 'Investigation & security services', ebupotCode: '24-104-28', rate: 0.02, pmkRef: 'PMK 141/2015 No.28', kbliCodes: ['80100'] },
  { code: 'JASA_PENERJEMAHAN', descriptionId: 'Jasa penerjemahan', descriptionEn: 'Translation services', ebupotCode: '24-104-29', rate: 0.02, pmkRef: 'PMK 141/2015 No.29' },
  { code: 'JASA_PENGANGKUTAN_BARANG', descriptionId: 'Jasa pengangkutan/ekspedisi kecuali yang telah diatur dalam Pasal 15 UU PPh', descriptionEn: 'Freight forwarding/expedition', ebupotCode: '24-104-30', rate: 0.02, pmkRef: 'PMK 141/2015 No.30', kbliCodes: ['52291'] },
  { code: 'JASA_PELAYANAN_KEPELABUHANAN', descriptionId: 'Jasa pelayanan kepelabuhanan', descriptionEn: 'Port services', ebupotCode: '24-104-31', rate: 0.02, pmkRef: 'PMK 141/2015 No.31' },
  { code: 'JASA_PENGANGKUTAN_MELALUI_JALUR_PIPA', descriptionId: 'Jasa pengangkutan melalui jalur pipa', descriptionEn: 'Pipeline transport services', ebupotCode: '24-104-32', rate: 0.02, pmkRef: 'PMK 141/2015 No.32' },
  { code: 'JASA_PENGELOLAAN_PENITIPAN_ANAK', descriptionId: 'Jasa pengelolaan penitipan anak', descriptionEn: 'Childcare management services', ebupotCode: '24-104-33', rate: 0.02, pmkRef: 'PMK 141/2015 No.33' },
  { code: 'JASA_PELATIHAN', descriptionId: 'Jasa pelatihan dan/atau kursus', descriptionEn: 'Training & courses', ebupotCode: '24-104-34', rate: 0.02, pmkRef: 'PMK 141/2015 No.34' },
  { code: 'JASA_TELEKOMUNIKASI', descriptionId: 'Jasa telekomunikasi yang bukan untuk umum', descriptionEn: 'Private telecommunication services', ebupotCode: '24-104-35', rate: 0.02, pmkRef: 'PMK 141/2015 No.35' },
  { code: 'JASA_SEHUBUNGAN_PENGGUNAAN_HARTA', descriptionId: 'Jasa sehubungan dengan penggunaan harta selain tanah dan/atau bangunan', descriptionEn: 'Services related to asset use (non-land/building)', ebupotCode: '24-104-36', rate: 0.02, pmkRef: 'PMK 141/2015 No.36' },
  { code: 'JASA_EVENT_ORGANIZER', descriptionId: 'Jasa penyelenggara kegiatan (event organizer)', descriptionEn: 'Event organizer services', ebupotCode: '24-104-37', rate: 0.02, pmkRef: 'PMK 141/2015 No.37', kbliCodes: ['82300'] },
  { code: 'JASA_PENYEDIAAN_TEMPAT_WAKTU_MEDIA', descriptionId: 'Jasa penyediaan tempat dan/atau waktu dalam media massa, media luar ruang atau media lain', descriptionEn: 'Advertising space/time provision', ebupotCode: '24-104-38', rate: 0.02, pmkRef: 'PMK 141/2015 No.38' },
  { code: 'JASA_PEMBASMIAN_HAMA', descriptionId: 'Jasa pembasmian hama', descriptionEn: 'Pest control services', ebupotCode: '24-104-39', rate: 0.02, pmkRef: 'PMK 141/2015 No.39', kbliCodes: ['81290'] },
  { code: 'JASA_KEBERSIHAN', descriptionId: 'Jasa kebersihan atau cleaning service', descriptionEn: 'Cleaning services', ebupotCode: '24-104-40', rate: 0.02, pmkRef: 'PMK 141/2015 No.40', kbliCodes: ['81210'] },
  { code: 'JASA_SEDOT_SEPTIC_TANK', descriptionId: 'Jasa sedot septic tank dan/atau WC', descriptionEn: 'Septic tank/toilet cleaning', ebupotCode: '24-104-41', rate: 0.02, pmkRef: 'PMK 141/2015 No.41' },
  { code: 'JASA_PERMAK', descriptionId: 'Jasa permak atau rubah desain atau bordir', descriptionEn: 'Alteration/embroidery services', ebupotCode: '24-104-42', rate: 0.02, pmkRef: 'PMK 141/2015 No.42' },
  { code: 'JASA_PENATU', descriptionId: 'Jasa penatu (laundry)', descriptionEn: 'Laundry services', ebupotCode: '24-104-43', rate: 0.02, pmkRef: 'PMK 141/2015 No.43' },
  { code: 'JASA_PEMBUATAN_KATERING', descriptionId: 'Jasa katering atau tata boga', descriptionEn: 'Catering services', ebupotCode: '24-104-44', rate: 0.02, pmkRef: 'PMK 141/2015 No.44', kbliCodes: ['56210'] },
  { code: 'JASA_FREIGHT_FORWARDING', descriptionId: 'Jasa freight forwarding', descriptionEn: 'Freight forwarding services', ebupotCode: '24-104-45', rate: 0.02, pmkRef: 'PMK 141/2015 No.45' },
  { code: 'JASA_LOGISTIK', descriptionId: 'Jasa logistik', descriptionEn: 'Logistics services', ebupotCode: '24-104-46', rate: 0.02, pmkRef: 'PMK 141/2015 No.46' },
  { code: 'JASA_FUMIGASI', descriptionId: 'Jasa fumigasi', descriptionEn: 'Fumigation services', ebupotCode: '24-104-47', rate: 0.02, pmkRef: 'PMK 141/2015 No.47' },
  { code: 'JASA_PENGURUSAN_DOKUMEN', descriptionId: 'Jasa pengurusan dokumen', descriptionEn: 'Document management services', ebupotCode: '24-104-48', rate: 0.02, pmkRef: 'PMK 141/2015 No.48' },
  { code: 'JASA_PENGEPAKAN', descriptionId: 'Jasa pengepakan', descriptionEn: 'Packaging services', ebupotCode: '24-104-49', rate: 0.02, pmkRef: 'PMK 141/2015 No.49', kbliCodes: ['82920'] },
  { code: 'JASA_PENYEDIAAN_TENAGA_AHLI', descriptionId: 'Jasa penyediaan tenaga ahli', descriptionEn: 'Expert staffing services', ebupotCode: '24-104-50', rate: 0.02, pmkRef: 'PMK 141/2015 No.50' },
  { code: 'JASA_SURVEY', descriptionId: 'Jasa survei', descriptionEn: 'Survey services', ebupotCode: '24-104-51', rate: 0.02, pmkRef: 'PMK 141/2015 No.51' },
  { code: 'JASA_TESTER', descriptionId: 'Jasa tester', descriptionEn: 'Testing services', ebupotCode: '24-104-52', rate: 0.02, pmkRef: 'PMK 141/2015 No.52' },
  { code: 'JASA_SELAM', descriptionId: 'Jasa selam (diving)', descriptionEn: 'Diving services', ebupotCode: '24-104-53', rate: 0.02, pmkRef: 'PMK 141/2015 No.53' },
  { code: 'JASA_PENGOLAHAN_HASIL_PERTANIAN', descriptionId: 'Jasa pengolahan hasil pertanian, perkebunan, perikanan, peternakan, dan/atau perhutanan', descriptionEn: 'Agricultural processing services', ebupotCode: '24-104-54', rate: 0.02, pmkRef: 'PMK 141/2015 No.54' },
  { code: 'JASA_DEKORASI', descriptionId: 'Jasa dekorasi', descriptionEn: 'Decoration services', ebupotCode: '24-104-55', rate: 0.02, pmkRef: 'PMK 141/2015 No.55' },
  { code: 'JASA_PENCETAKAN', descriptionId: 'Jasa pencetakan/penerbitan', descriptionEn: 'Printing/publishing services', ebupotCode: '24-104-56', rate: 0.02, pmkRef: 'PMK 141/2015 No.56' },
  { code: 'JASA_PENYELAMAN', descriptionId: 'Jasa penyelaman', descriptionEn: 'Underwater diving services', ebupotCode: '24-104-57', rate: 0.02, pmkRef: 'PMK 141/2015 No.57' },
  { code: 'JASA_PEMELIHARAAN_KOLAM', descriptionId: 'Jasa pemeliharaan kolam', descriptionEn: 'Pool maintenance services', ebupotCode: '24-104-58', rate: 0.02, pmkRef: 'PMK 141/2015 No.58' },
  { code: 'JASA_KATERING_TRANSPORTASI', descriptionId: 'Jasa katering untuk transportasi darat, laut, dan/atau udara', descriptionEn: 'Transport catering services', ebupotCode: '24-104-59', rate: 0.02, pmkRef: 'PMK 141/2015 No.59' },
  { code: 'JASA_PENGOLAHAN_DATA', descriptionId: 'Jasa pengolahan data', descriptionEn: 'Data processing services', ebupotCode: '24-104-60', rate: 0.02, pmkRef: 'PMK 141/2015 No.60' },
  { code: 'JASA_PENYEDIAAN_SUMBER_DAYA_MANUSIA', descriptionId: 'Jasa penyediaan sumber daya manusia', descriptionEn: 'Human resource provision services', ebupotCode: '24-104-61', rate: 0.02, pmkRef: 'PMK 141/2015 No.61' },
  { code: 'JASA_LAINNYA', descriptionId: 'Jasa lainnya yang telah dipotong PPh Pasal 21', descriptionEn: 'Other services subject to PPh 21', ebupotCode: '24-104-62', rate: 0.02, pmkRef: 'PMK 141/2015 No.62' },
];

/** Lookup map by code for O(1) access */
const SERVICE_CODE_MAP = new Map<string, PPh23ServiceCode>(
  PPH23_SERVICE_CODES.map(sc => [sc.code, sc])
);

/** Reverse map: KBLI code → service code */
const KBLI_TO_SERVICE_MAP = new Map<string, PPh23ServiceCode>();
for (const sc of PPH23_SERVICE_CODES) {
  if (sc.kbliCodes) {
    for (const kbli of sc.kbliCodes) {
      KBLI_TO_SERVICE_MAP.set(kbli, sc);
    }
  }
}

/**
 * Get service code by internal code identifier
 */
export function getServiceCode(code: string): PPh23ServiceCode | undefined {
  return SERVICE_CODE_MAP.get(code);
}

/**
 * Get service code by KBLI code (best-effort mapping)
 */
export function getServiceCodeByKBLI(kbliCode: string): PPh23ServiceCode | undefined {
  return KBLI_TO_SERVICE_MAP.get(kbliCode);
}

/**
 * Get all 62 service codes
 */
export function getAllServiceCodes(): PPh23ServiceCode[] {
  return PPH23_SERVICE_CODES;
}
