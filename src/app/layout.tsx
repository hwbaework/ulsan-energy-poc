import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers/QueryProvider';

export const metadata: Metadata = {
  title: '울산 에너지 자급자족 플랫폼 (POC)',
  description: '울산미포 에너지 자급자족 - ESG Energy Platform POC',
  manifest: '/manifest.json',
  openGraph: {
    title: 'RMS 에너지 플랫폼',
    description: '울산미포 에너지 자급자족 - Ulsan Energy Self-Sufficiency ESG Energy Platform',
    url: 'https://energy.rmsgroup.co.kr',
    siteName: 'RMS 에너지 플랫폼',
    images: [
      {
        url: 'https://energy.rmsgroup.co.kr/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RMS 에너지 플랫폼',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RMS 에너지 플랫폼',
    description: '울산미포 에너지 자급자족 - ESG Energy Platform',
    images: ['https://energy.rmsgroup.co.kr/images/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" style={{ colorScheme: 'dark' }}>
      <body className="bg-surface-dark text-white font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
