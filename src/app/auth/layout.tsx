import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bk-black flex flex-col items-center justify-center px-4">
      <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
        <div className="w-10 h-10 rounded-xl bg-bk-gold flex items-center justify-center group-hover:scale-110 transition-transform">
          <span className="font-display text-lg text-bk-black">BK</span>
        </div>
        <span className="font-display text-2xl tracking-wider text-bk-white">BALLKNOWER</span>
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
