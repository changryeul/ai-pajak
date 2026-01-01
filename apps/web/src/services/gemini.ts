// src/services/gemini.ts

/**
 * ⚠️ 프론트 Mock AI 계산 함수
 * - 실제 Gemini API는 백엔드에서만 호출해야 함
 * - 지금은 UI 테스트용 더미 응답
 */
export async function simulateTaxCalculation(payload: any) {
  console.log('[Mock AI] payload:', payload);

  // 네트워크 지연 흉내
  await new Promise((r) => setTimeout(r, 800));

  return {
    suggestedTax: Math.floor(
      (payload.revenue - payload.cogs - payload.opex) * 0.22
    ),
    confidence: 0.87,
    explanation:
      'This is a simulated AI result. Actual tax calculation will be performed by backend AI.',
  };
}