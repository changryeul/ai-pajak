/**
 * AI Tax Assistant - Chatbot for tax-related queries
 * Uses Claude/GPT for natural language understanding
 */
export class TaxAssistant {
  private static claudeApiKey = process.env.ANTHROPIC_API_KEY;
  private static openaiApiKey = process.env.OPENAI_API_KEY;

  private static systemPrompt = `You are an expert Indonesian tax assistant named "Asisten Pajak AI".
Your role is to help users with Indonesian tax-related questions and guide them through tax filing processes.

Key knowledge areas:
1. PPh 21 (Income Tax Article 21) - Employment income tax withholding
2. PPh 23 (Income Tax Article 23) - Withholding on dividends, interest, royalties, etc.
3. PPN (Value Added Tax) - 11% rate on taxable goods and services
4. SPT Tahunan - Annual tax returns (1770, 1770S, 1770SS for individuals, 1771 for corporates)
5. NPWP registration and requirements
6. Tax deadlines and penalties

Guidelines:
- Always respond in the user's language (Indonesian, English, Korean, Japanese, or Chinese)
- Provide accurate tax rates and regulations based on current Indonesian tax law
- Recommend consulting a tax professional for complex cases
- Be helpful, clear, and concise
- Include relevant calculations when helpful
- Cite specific regulations when applicable (e.g., UU PPh, PMK)

Important tax deadlines:
- PPh 21/23: 10th of following month
- PPN: Last day of following month
- SPT Tahunan Individual: March 31st
- SPT Tahunan Corporate: April 30th`;

  /**
   * Chat with the tax assistant using Claude
   */
  static async chatWithClaude(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    language: string = 'id'
  ): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: `${this.systemPrompt}\n\nRespond in ${this.getLanguageName(language)}.`,
          messages: messages,
        }),
      });

      const data = await response.json();
      return data.content?.[0]?.text || 'Sorry, I could not process your request.';
    } catch (error) {
      console.error('Claude API error:', error);
      return 'Sorry, there was an error processing your request.';
    }
  }

  /**
   * Chat with the tax assistant using OpenAI
   */
  static async chatWithOpenAI(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    language: string = 'id'
  ): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `${this.systemPrompt}\n\nRespond in ${this.getLanguageName(language)}.`,
            },
            ...messages,
          ],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sorry, I could not process your request.';
    } catch (error) {
      console.error('OpenAI API error:', error);
      return 'Sorry, there was an error processing your request.';
    }
  }

  /**
   * Analyze a tax document and provide insights
   */
  static async analyzeDocument(
    documentData: Record<string, unknown>,
    language: string = 'id'
  ): Promise<{
    summary: string;
    issues: string[];
    recommendations: string[];
  }> {
    const prompt = `Analyze this Indonesian tax document data and provide:
1. A brief summary of the document
2. Any potential issues or errors found
3. Recommendations for the taxpayer

Document data:
${JSON.stringify(documentData, null, 2)}`;

    const response = await this.chatWithClaude(
      [{ role: 'user', content: prompt }],
      language
    );

    // Parse the response into structured format
    try {
      const sections = response.split('\n\n');
      return {
        summary: sections[0] || response,
        issues: this.extractListItems(sections[1] || ''),
        recommendations: this.extractListItems(sections[2] || ''),
      };
    } catch {
      return {
        summary: response,
        issues: [],
        recommendations: [],
      };
    }
  }

  /**
   * Validate tax calculations
   */
  static async validateCalculation(
    calculationType: 'pph21' | 'pph23' | 'ppn',
    inputData: Record<string, unknown>,
    calculatedResult: Record<string, unknown>,
    language: string = 'id'
  ): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  }> {
    const prompt = `As an Indonesian tax expert, validate this ${calculationType.toUpperCase()} calculation:

Input Data:
${JSON.stringify(inputData, null, 2)}

Calculated Result:
${JSON.stringify(calculatedResult, null, 2)}

Please verify if the calculation is correct according to Indonesian tax regulations.
List any errors found and provide suggestions for corrections.`;

    const response = await this.chatWithOpenAI(
      [{ role: 'user', content: prompt }],
      language
    );

    const hasErrors = response.toLowerCase().includes('error') ||
                     response.toLowerCase().includes('incorrect') ||
                     response.toLowerCase().includes('salah');

    return {
      isValid: !hasErrors,
      errors: this.extractListItems(response.split('error')[1] || ''),
      suggestions: this.extractListItems(response.split('suggestion')[1] || response.split('saran')[1] || ''),
    };
  }

  private static getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      id: 'Indonesian (Bahasa Indonesia)',
      en: 'English',
      ko: 'Korean',
      ja: 'Japanese',
      zh: 'Chinese',
    };
    return languages[code] || 'Indonesian';
  }

  private static extractListItems(text: string): string[] {
    const lines = text.split('\n');
    return lines
      .filter((line) => line.trim().match(/^[-•*\d.]/))
      .map((line) => line.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }
}
