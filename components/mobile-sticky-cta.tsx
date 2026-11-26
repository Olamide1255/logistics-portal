import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function MobileStickyCta() {
  return (
    <div className="mobile-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
      <Link href="/signup" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
        Start your free setup <ArrowRight size={17} />
      </Link>
    </div>
  );
}
