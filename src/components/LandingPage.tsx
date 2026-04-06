'use client';

import Link from 'next/link';
import { SPORTS } from '@/lib/sports';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bk-black overflow-hidden">
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#F5A623 1px, transparent 1px), linear-gradient(90deg, #F5A623 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F5A623, transparent 70%)' }} />

        <div className="relative z-10 animate-slide-up">
          {/* Logo */}
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-bk-gold flex items-center justify-center animate-gold-pulse">
              <span className="font-display text-2xl text-bk-black tracking-wider">BK</span>
            </div>
          </div>

          <h1 className="font-display text-[5rem] sm:text-[8rem] leading-none tracking-wide text-bk-white mb-4">
            BALL<br />
            <span className="text-gradient-gold">KNOWER</span>
          </h1>

          <p className="text-bk-gray-muted text-lg sm:text-xl max-w-md mx-auto mb-10 leading-relaxed">
            Sports trivia. Global rankings. Prove you know more than everyone else.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-4 bg-bk-gold text-bk-black font-bold text-lg rounded-xl hover:bg-bk-gold-dark transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Start Playing Free
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 border-2 border-bk-gray-light text-bk-white font-bold text-lg rounded-xl hover:border-bk-gold hover:text-bk-gold transition-all duration-200"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>

      {/* Sports grid */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-bk-gray-muted text-sm uppercase tracking-widest mb-8 font-bold">
            Pick your sport
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SPORTS.map((sport, i) => (
              <div
                key={sport.id}
                className="bg-bk-gray rounded-xl p-4 text-center border border-bk-gray-light hover:border-bk-gold transition-colors duration-200 cursor-default"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="text-3xl mb-2">{sport.emoji}</div>
                <div className="text-sm font-bold text-bk-white">{sport.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-t border-bk-gray-light py-12 px-6">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: 'ELO', label: 'Ranked System' },
            { value: 'AI', label: 'Powered Questions' },
            { value: '8+', label: 'Sport Categories' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="font-display text-5xl text-gradient-gold mb-1">{value}</div>
              <div className="text-bk-gray-muted text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
