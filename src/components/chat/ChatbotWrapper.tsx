'use client';

import dynamic from 'next/dynamic';

const TaxChatbot = dynamic(() => import('./TaxChatbot'), { ssr: false });

export function ChatbotWrapper() {
  return <TaxChatbot />;
}
