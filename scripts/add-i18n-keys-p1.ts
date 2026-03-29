import * as fs from 'fs';
import * as path from 'path';
const DIR = path.resolve(process.cwd(), 'src/i18n/messages');

const keys: Record<string, Record<string, Record<string, string>>> = {
  sptForm: {
    aiAutofillSuccess: { id: 'dokumen berhasil dibaca', en: 'documents read successfully', ko: '문서 읽기 성공', ja: '書類の読み取り成功', zh: '文件读取成功' },
    detectedPtkp: { id: 'Status PTKP terdeteksi', en: 'PTKP status detected', ko: 'PTKP 상태 감지됨', ja: 'PTKPステータス検出', zh: '检测到PTKP状态' },
    detectedYear: { id: 'Tahun Pajak', en: 'Tax Year', ko: '과세연도', ja: '課税年度', zh: '纳税年度' },
    checkAndContinue: { id: 'Silakan periksa data dan lanjutkan', en: 'Please check data and continue', ko: '데이터를 확인하고 계속하세요', ja: 'データを確認して続行', zh: '请检查数据并继续' },
    extractedData: { id: 'Data Penghasilan Terekstrak', en: 'Extracted Income Data', ko: '추출된 소득 데이터', ja: '抽出された所得データ', zh: '提取的收入数据' },
    employer: { id: 'Pemberi Kerja', en: 'Employer', ko: '고용주', ja: '雇用主', zh: '雇主' },
    employerNpwp: { id: 'NPWP Pemberi Kerja', en: 'Employer NPWP', ko: '고용주 NPWP', ja: '雇用主NPWP', zh: '雇主NPWP' },
    grossIncome: { id: 'Penghasilan Bruto', en: 'Gross Income', ko: '총소득', ja: '総所得', zh: '总收入' },
    netIncome: { id: 'Penghasilan Neto', en: 'Net Income', ko: '순소득', ja: '純所得', zh: '净收入' },
    positionCost: { id: 'Biaya Jabatan', en: 'Position Cost', ko: '직위비', ja: '職位費用', zh: '职位费用' },
    taxWithheld: { id: 'PPh Dipotong', en: 'Tax Withheld', ko: '원천징수 세금', ja: '源泉徴収税', zh: '已扣缴税款' },
    totalGross: { id: 'Total Bruto', en: 'Total Gross', ko: '총 브루토', ja: '総額', zh: '总额' },
    totalNet: { id: 'Total Neto', en: 'Total Net', ko: '총 네토', ja: '純額合計', zh: '净额合计' },
    totalTaxWithheld: { id: 'Total PPh Dipotong', en: 'Total Tax Withheld', ko: '총 원천징수', ja: '源泉徴収合計', zh: '扣缴合计' },
    cancel: { id: 'Batal', en: 'Cancel', ko: '취소', ja: 'キャンセル', zh: '取消' },
    save: { id: 'Simpan', en: 'Save', ko: '저장', ja: '保存', zh: '保存' },
    add: { id: 'Tambah', en: 'Add', ko: '추가', ja: '追加', zh: '添加' },
    manualInput: { id: 'Isi Manual', en: 'Enter Manually', ko: '직접 입력', ja: '手動入力', zh: '手动输入' },
    manualTitle: { id: 'Isi Data Manual', en: 'Enter Data Manually', ko: '데이터 직접 입력', ja: '手動データ入力', zh: '手动输入数据' },
    manualHint: { id: 'Isi data dari slip gaji tahunan Anda. Jika tidak tahu angka pastinya, tanyakan ke bagian HRD.', en: 'Enter data from your annual salary slip. If unsure, ask your HR department.', ko: '연간 급여 명세서의 데이터를 입력하세요. 정확한 수치를 모르면 인사부에 문의하세요.', ja: '年間給与明細からデータを入力してください。', zh: '输入年度工资单数据。如不确定，请咨询人力资源部门。' },
    companyName: { id: 'Nama Perusahaan', en: 'Company Name', ko: '회사명', ja: '会社名', zh: '公司名称' },
    totalSalaryYear: { id: 'Total Gaji Setahun (Bruto)', en: 'Total Annual Salary (Gross)', ko: '연간 총 급여 (브루토)', ja: '年間総給与（総額）', zh: '年度总工资（总额）' },
    salaryHint: { id: 'Jumlah semua gaji + tunjangan + bonus + THR selama setahun', en: 'All salary + allowances + bonus + THR for the year', ko: '연간 급여 + 수당 + 보너스 + THR 합계', ja: '年間の給与＋手当＋ボーナス＋THRの合計', zh: '全年工资+津贴+奖金+THR总计' },
    taxAlreadyDeducted: { id: 'Pajak yang Sudah Dipotong', en: 'Tax Already Deducted', ko: '이미 공제된 세금', ja: '既に控除された税金', zh: '已扣除的税款' },
    taxDeductedHint: { id: 'PPh 21 yang sudah dipotong perusahaan', en: 'PPh 21 already deducted by employer', ko: '회사에서 이미 공제한 PPh 21', ja: '会社が控除済みのPPh 21', zh: '公司已扣除的PPh 21' },
    additionalData: { id: 'Data tambahan (opsional)', en: 'Additional data (optional)', ko: '추가 데이터 (선택)', ja: '追加データ（任意）', zh: '附加数据（可选）' },
    pension: { id: 'Iuran Pensiun', en: 'Pension', ko: '연금', ja: '年金', zh: '养老金' },
    correction: { id: 'Pembetulan ke-', en: 'Correction No.', ko: '수정 번호', ja: '修正番号', zh: '更正编号' },
  },
  monthlyPayments: {
    paymentsTab: { id: 'Pembayaran', en: 'Payments', ko: '납부', ja: '納付', zh: '缴纳' },
    counterpartiesTab: { id: 'Lawan Transaksi', en: 'Counterparties', ko: '거래 상대방', ja: '取引先', zh: '交易对方' },
    transactionsTab: { id: 'Transaksi', en: 'Transactions', ko: '거래', ja: '取引', zh: '交易' },
    noSchedule: { id: 'Belum Ada Jadwal Pembayaran', en: 'No Payment Schedule Yet', ko: '납부 일정 없음', ja: '納付スケジュールなし', zh: '尚无付款计划' },
    createSchedule: { id: 'Buat Jadwal', en: 'Create Schedule', ko: '일정 생성', ja: 'スケジュール作成', zh: '创建计划' },
    paid: { id: 'Lunas', en: 'Paid', ko: '완납', ja: '納付済', zh: '已付' },
    unpaid: { id: 'Belum', en: 'Unpaid', ko: '미납', ja: '未納', zh: '未付' },
    overdue: { id: 'Terlambat', en: 'Overdue', ko: '연체', ja: '延滞', zh: '逾期' },
    thisMonth: { id: 'Bulan Ini', en: 'This Month', ko: '이번 달', ja: '今月', zh: '本月' },
    viewDetail: { id: 'Lihat Detail Transaksi', en: 'View Transaction Detail', ko: '거래 상세 보기', ja: '取引詳細を表示', zh: '查看交易详情' },
    markPaid: { id: 'Tandai Lunas', en: 'Mark as Paid', ko: '납부 완료', ja: '納付済にする', zh: '标记为已付' },
    amountDue: { id: 'Jumlah Terutang', en: 'Amount Due', ko: '납부 금액', ja: '納付額', zh: '应付金额' },
    payDeadline: { id: 'Batas Setor', en: 'Payment Deadline', ko: '납부 마감', ja: '納付期限', zh: '缴款截止' },
    reportDeadline: { id: 'Batas Lapor', en: 'Report Deadline', ko: '신고 마감', ja: '申告期限', zh: '申报截止' },
    addCounterparty: { id: 'Tambah', en: 'Add', ko: '추가', ja: '追加', zh: '添加' },
    searchNameNpwp: { id: 'Cari nama atau NPWP...', en: 'Search name or NPWP...', ko: '이름 또는 NPWP 검색...', ja: '名前またはNPWPで検索...', zh: '搜索名称或NPWP...' },
    noCounterparties: { id: 'Belum ada lawan transaksi', en: 'No counterparties yet', ko: '거래 상대방 없음', ja: '取引先がありません', zh: '暂无交易对方' },
  },
  simpleMode: {
    photoTitle: { id: 'Foto Slip Gaji Tahunan', en: 'Photo Annual Salary Slip', ko: '연간 급여 명세서 촬영', ja: '年間給与明細を撮影', zh: '拍摄年度工资单' },
    photoSubtitle: { id: 'Dari bagian HRD kantor Anda (disebut "Bukti Potong 1721-A1")', en: 'From your company HR department (called "Bukti Potong 1721-A1")', ko: '회사 인사부에서 받는 서류 (원천징수 영수증 1721-A1)', ja: '会社の人事部から（源泉徴収票1721-A1）', zh: '从公司人力资源部获取（扣缴凭证1721-A1）' },
    takePhotoOrUpload: { id: 'Ambil Foto atau Upload File', en: 'Take Photo or Upload File', ko: '사진 촬영 또는 파일 업로드', ja: '写真を撮るかファイルをアップロード', zh: '拍照或上传文件' },
    fromCameraOrFile: { id: 'Foto dari kamera HP atau file PDF/gambar', en: 'Photo from phone camera or PDF/image file', ko: '폰 카메라 사진 또는 PDF/이미지 파일', ja: '携帯カメラの写真またはPDF/画像ファイル', zh: '手机拍照或PDF/图片文件' },
    aiReading: { id: 'AI sedang membaca dokumen Anda...', en: 'AI is reading your document...', ko: 'AI가 문서를 읽고 있습니다...', ja: 'AIが書類を読み取り中...', zh: 'AI正在读取您的文件...' },
    waitAMoment: { id: 'Tunggu sebentar ya, biasanya 10-30 detik', en: 'Please wait, usually 10-30 seconds', ko: '잠시 기다려주세요, 보통 10-30초', ja: 'お待ちください、通常10-30秒', zh: '请稍候，通常10-30秒' },
    makeSurePhotoIsClear: { id: 'Pastikan foto jelas dan tidak terpotong', en: 'Make sure the photo is clear and not cropped', ko: '사진이 선명하고 잘리지 않았는지 확인하세요', ja: '写真が鮮明で切れていないことを確認', zh: '确保照片清晰且未裁剪' },
    aiSuccess: { id: 'AI Berhasil Membaca Data Anda!', en: 'AI Successfully Read Your Data!', ko: 'AI가 데이터를 성공적으로 읽었습니다!', ja: 'AIがデータを読み取りました！', zh: 'AI成功读取了您的数据！' },
    checkData: { id: 'Periksa apakah data di bawah sudah benar', en: 'Check if the data below is correct', ko: '아래 데이터가 맞는지 확인하세요', ja: '以下のデータが正しいか確認してください', zh: '请检查以下数据是否正确' },
    dataCorrect: { id: 'Ya, Data Sudah Benar', en: 'Yes, Data is Correct', ko: '네, 데이터가 맞습니다', ja: 'はい、データは正しいです', zh: '是的，数据正确' },
    retakePhoto: { id: 'Foto Ulang', en: 'Retake Photo', ko: '다시 촬영', ja: '再撮影', zh: '重新拍照' },
    sptDone: { id: 'SPT Anda Sudah Selesai!', en: 'Your SPT is Done!', ko: 'SPT가 완성되었습니다!', ja: 'SPTが完成しました！', zh: '您的SPT已完成！' },
    sptDoneDesc: { id: 'Laporan pajak tahunan Anda sudah dibuat', en: 'Your annual tax report has been created', ko: '연간 세금 보고서가 작성되었습니다', ja: '年次確定申告が作成されました', zh: '您的年度纳税申报表已创建' },
    nextSteps: { id: 'Langkah selanjutnya', en: 'Next steps', ko: '다음 단계', ja: '次のステップ', zh: '下一步' },
    step1Download: { id: 'Download PDF untuk arsip Anda', en: 'Download PDF for your records', ko: 'PDF 다운로드 (기록 보관용)', ja: '記録用にPDFをダウンロード', zh: '下载PDF存档' },
    step2Report: { id: 'Klik "Lapor ke DJP" untuk mengirim ke kantor pajak', en: 'Click "Report to DJP" to submit to tax office', ko: '"DJP에 신고"를 클릭하여 세무서에 제출', ja: '「DJPに申告」をクリックして税務署に提出', zh: '点击"向DJP申报"提交至税务局' },
    step3SaveBpe: { id: 'Simpan nomor BPE sebagai bukti pelaporan', en: 'Save BPE number as filing proof', ko: 'BPE 번호를 신고 증빙으로 보관', ja: 'BPE番号を申告証明として保存', zh: '保存BPE号码作为申报凭证' },
    uploadOther: { id: 'Upload dokumen lain', en: 'Upload another document', ko: '다른 문서 업로드', ja: '別の書類をアップロード', zh: '上传其他文件' },
    noSlip: { id: 'Tidak punya slip gaji? → Isi data manual', en: "Don't have salary slip? → Enter manually", ko: '급여 명세서가 없나요? → 직접 입력', ja: '給与明細がない？→手動入力', zh: '没有工资单？→手动输入' },
    reportToDjp: { id: 'Lapor ke DJP', en: 'Report to DJP', ko: 'DJP에 신고', ja: 'DJPに申告', zh: '向DJP申报' },
  },
  wizard: {
    nextStep: { id: 'Langkah Selanjutnya', en: 'Next Step', ko: '다음 단계', ja: '次のステップ', zh: '下一步' },
    completed: { id: 'selesai', en: 'completed', ko: '완료', ja: '完了', zh: '已完成' },
    allDone: { id: 'Semua langkah selesai!', en: 'All steps complete!', ko: '모든 단계 완료!', ja: 'すべてのステップ完了！', zh: '所有步骤已完成！' },
    allDoneDesc: { id: 'SPT Anda sudah dilaporkan. Simpan BPE sebagai bukti.', en: 'Your SPT has been filed. Save BPE as proof.', ko: 'SPT가 신고되었습니다. BPE를 증빙으로 보관하세요.', ja: 'SPTが申告されました。BPEを証明として保存してください。', zh: '您的SPT已申报。请保存BPE作为凭证。' },
    close: { id: 'Tutup', en: 'Close', ko: '닫기', ja: '閉じる', zh: '关闭' },
  },
};

for (const locale of ['id', 'en', 'ko', 'ja', 'zh']) {
  const fp = path.join(DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  for (const [section, items] of Object.entries(keys)) {
    if (!c[section]) c[section] = {};
    for (const [k, tr] of Object.entries(items)) {
      if (!c[section][k]) c[section][k] = tr[locale] || tr.en;
    }
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done! Added P1 i18n keys');
