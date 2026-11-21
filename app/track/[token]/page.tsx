'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, Circle, Clock3, Globe2, PackageCheck, Plane, ShieldCheck } from 'lucide-react';

type TrackingData = {
  awb_number: string;
  origin: string | null;
  destination: string | null;
  current_status: string;
  created_at: string;
  expected_delivery_date: string | null;
  company: { name: string; logo_url: string | null };
  milestones: { status: string; occurred_at: string }[];
};

const dateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Pending update';

export default function PublicTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [shipment, setShipment] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_shipment_tracking', { p_token: token });
      if (!active) return;
      if (error || !data) setFailed(true);
      else setShipment(data as TrackingData);
      setLoading(false);
    };
    if (token) load();
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><PackageCheck size={19} /></span>
            <span>LogiFlow <span className="font-medium text-slate-400">Tracking</span></span>
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck size={15} /> Secure tracking</span>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">Retrieving your shipment updates…</p>
          </div>
        ) : failed || !shipment ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-7 py-14 text-center shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><PackageCheck size={25} /></div>
            <h1 className="text-2xl font-bold">Tracking link unavailable</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">This link may be invalid or no longer active. Please contact the logistics provider that shared it with you.</p>
            <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600"><ArrowLeft size={16} /> Back to home</Link>
          </div>
        ) : (
          <>
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Shipment tracking</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Your shipment, in view.</h1>
                <p className="mt-2 text-sm text-slate-500">Live progress shared by {shipment.company.name}.</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                {shipment.company.logo_url ? <img src={shipment.company.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Globe2 size={18} /></span>}
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Your logistics partner</p><p className="text-sm font-bold">{shipment.company.name}</p></div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Air waybill / reference</p><p className="mt-1 text-xl font-extrabold tracking-wide">{shipment.awb_number}</p></div>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700"><span className="h-2 w-2 rounded-full bg-indigo-500" />{shipment.current_status}</span>
              </div>
              <div className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Origin</p><p className="mt-1 text-lg font-bold">{shipment.origin || 'Not specified'}</p></div>
                <Plane className="hidden text-indigo-500 sm:block" size={21} />
                <div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Destination</p><p className="mt-1 text-lg font-bold">{shipment.destination || 'Not specified'}</p></div>
              </div>
              <div className="mt-8">
                <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Shipment journey</h2><span className="text-xs text-slate-400">Latest shared milestones</span></div>
                {shipment.milestones.length ? (
                  <ol className="space-y-0">
                    {shipment.milestones.map((item, index) => {
                      const latest = index === shipment.milestones.length - 1;
                      return <li key={index} className="relative flex gap-4 pb-6 last:pb-0">
                        {index !== shipment.milestones.length - 1 && <span className="absolute left-[11px] top-7 h-full w-px bg-slate-200" />}
                        <span className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${latest ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{latest ? <Clock3 size={13} /> : <CheckCircle2 size={15} />}</span>
                        <div className="min-w-0 flex-1"><p className={`text-sm font-bold ${latest ? 'text-indigo-700' : 'text-slate-800'}`}>{item.status}</p><p className="mt-1 text-xs text-slate-400">{dateTime(item.occurred_at)}</p></div>
                      </li>;
                    })}
                  </ol>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><Circle className="mx-auto text-slate-300" size={22} /><p className="mt-2 text-sm font-medium text-slate-500">No public milestones have been recorded yet.</p></div>
                )}
              </div>
              <div className="mt-8 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={17} /><p>This page shows public shipment progress only. Personal details, internal notes and payment information remain private.</p></div>
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">Tracking information is provided by {shipment.company.name}. Updates appear as milestones are recorded.</p>
          </>
        )}
      </section>
    </main>
  );
}
