import type { Metadata } from 'next';
import { Bebas_Neue, DM_Sans } from 'next/font/google';
import './globals.css';

const display = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'BallKnower — Sports Trivia, Ranked',
  description: 'Compete globally in sports trivia. Prove you\'re the ultimate Ball Knower.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-bk-black text-bk-white font-body antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
