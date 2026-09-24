import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://ownlymalta.com'),
  title: 'Ownly Malta — Know what your property is really earning',
  description: 'Track property income, expenses, mortgages, cash flow and long-term returns in one simple dashboard.',
  openGraph: { title:'Know what your property is really earning.', description:'Clear property cash flow, in one dashboard.', images:[{url:'/og.png',width:1792,height:921,alt:'Ownly property cash-flow dashboard'}] },
  twitter: { card:'summary_large_image', title:'Know what your property is really earning.', description:'Clear property cash flow, in one dashboard.', images:['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
