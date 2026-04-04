import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/config/constants';

export default function Home() {
  redirect(`/${DEFAULT_LOCALE}`);
}
