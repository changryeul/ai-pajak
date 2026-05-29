'use client';

import dynamic from 'next/dynamic';

const TaxChatbot = dynamic(() => import('./TaxChatbot'), { ssr: false });
const CustomerAiChat = dynamic(() => import('./CustomerAiChat'), { ssr: false });

interface Props {
  /** From server-resolved role. CUSTOMER → CustomerAiChat (concierge). Else → TaxChatbot (public AI Q&A). */
  role: string | null;
}

export function ChatbotWrapper({ role }: Props) {
  if (role === 'CUSTOMER') return <CustomerAiChat />;
  return <TaxChatbot />;
}
