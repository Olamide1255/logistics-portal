'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';

export default function RegisterShipment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_platform_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        setIsAuthorized(false);
        return;
      }

      // Match the database shipments_insert policy. Email addresses are not
      // an authorization source and must never grant operational permissions.
      setIsAuthorized(
        profile.is_platform_admin === true ||
        ['Super Admin', 'Customer Service', 'Freight'].includes(profile.role)
      );
    };
    checkRole();
  }, [router]);

  const initialFormState = {
    awb_number: '', client_name: '', shipment_type: 'Export', service_type: 'DDP',
    agreed_amount: '', rate: '', currency: 'NGN', sender_details: '',
    receiver_details: '', weight: '', dimensions: '', origin: '', destination: '', commodity_type: '', expected_delivery_date: '', payment_due_date: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: existingShipment } = await supabase.from('shipments_secure').select('awb_number').eq('awb_number', formData.awb_number).maybeSingle(); 
      if (existingShipment) throw new Error('A shipment with this AWB Number already exists!');

      let clientId;
      const { data: existingClient } = await supabase.from('clients').select('id').ilike('client_name', formData.client_name).maybeSingle(); 
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase.from('clients').insert([{ client_name: formData.client_name }]).select().single(); 
        if (clientError) throw new Error(`Database Error: ${clientError.message}`); 
        clientId = newClient.id;
      }

      const { error: shipmentError } = await supabase.from('shipments').insert([
        {
          awb_number: formData.awb_number, client_id: clientId, shipment_type: formData.shipment_type,
          service_type: formData.service_type, agreed_amount: formData.agreed_amount ? parseFloat(formData.agreed_amount) : null,
          rate: formData.rate ? parseFloat(formData.rate) : null, currency: formData.currency,
          sender_details: formData.sender_details, receiver_details: formData.receiver_details,
          weight: parseFloat(formData.weight), dimensions: formData.dimensions, origin: formData.origin,
          destination: formData.destination, commodity_type: formData.commodity_type,
          expected_delivery_date: formData.expected_delivery_date || null,
          payment_due_date: formData.payment_due_date || null,
          current_status: 'Registered', payment_status: 'Pending',
        }
      ]);

      if (shipmentError) throw shipmentError;

      await supabase.from('notifications').insert([{
        role_target: 'Finance', title: 'New Shipment Registered',
        message: `AWB ${formData.awb_number} (${formData.shipment_type}) is awaiting payment approval.`,
        shipment_awb: formData.awb_number
      }]);

      posthog.capture('shipment_registered', {
        shipment_type: formData.shipment_type,
        service_type: formData.service_type,
        currency: formData.currency,
        has_expected_delivery_date: Boolean(formData.expected_delivery_date),
        has_payment_due_date: Boolean(formData.payment_due_date),
      });
      setSuccess('Shipment registered successfully!');
      setFormData(initialFormState); 
      setTimeout(() => router.push('/dashboard/shipments'), 2000); 

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized === null) return <div className="p-10 text-center text-slate-500 animate-pulse">Verifying access...</div>;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="bg-red-50 p-6 rounded-full mb-6"><ShieldAlert size={48} className="text-red-500" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md mb-6">Only Customer Service, Freight, and Super Admins can register new shipments.</p>
        <Link href="/dashboard" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Register New Shipment</h1>
        <p className="text-slate-500 mt-1 font-medium">Enter the shipment details below. AWB numbers must be unique.</p>
      </div>

      {error && <div role="alert" aria-live="assertive" className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 border border-red-200 font-medium">{error}</div>}
      {success && <div role="status" aria-live="polite" className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-6 border border-emerald-200 font-medium">{success}</div>}

      <form onSubmit={handleRegister} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div><label htmlFor="shipment-awb" className="block text-sm font-bold text-slate-700 mb-1">AWB Number *</label><input id="shipment-awb" required name="awb_number" value={formData.awb_number} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 123-45678901" /></div>
          <div><label htmlFor="shipment-client" className="block text-sm font-bold text-slate-700 mb-1">Client Name *</label><input id="shipment-client" required name="client_name" value={formData.client_name} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Acme Corp" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div><label htmlFor="shipment-type" className="block text-sm font-bold text-slate-700 mb-1">Shipment Type *</label><select id="shipment-type" required name="shipment_type" value={formData.shipment_type} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"><option value="Export">Export</option><option value="Import">Import</option></select></div>
          <div><label htmlFor="shipment-service" className="block text-sm font-bold text-slate-700 mb-1">Service Type *</label><select id="shipment-service" required name="service_type" value={formData.service_type} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"><option value="DDP">DDP</option><option value="DAP">DAP</option><option value="D2P">D2P</option><option value="FOB">FOB</option><option value="EXW">EXW</option><option value="AFW">AFW</option></select></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div><label htmlFor="shipment-rate" className="block text-sm font-bold text-slate-700 mb-1">Rate</label><input id="shipment-rate" type="number" min="0" step="0.01" name="rate" value={formData.rate} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 5.50" /></div>
          <div><label htmlFor="shipment-agreed-amount" className="block text-sm font-bold text-slate-700 mb-1">Agreed Amount</label><input id="shipment-agreed-amount" type="number" min="0" step="0.01" name="agreed_amount" value={formData.agreed_amount} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 150000" /></div>
          <div><label htmlFor="shipment-currency" className="block text-sm font-bold text-slate-700 mb-1">Currency</label><select id="shipment-currency" name="currency" value={formData.currency} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"><option value="NGN">NGN</option><option value="USD">USD</option></select></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div><label htmlFor="shipment-sender" className="block text-sm font-bold text-slate-700 mb-1">Sender Details *</label><input id="shipment-sender" required name="sender_details" value={formData.sender_details} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Name, Phone, Address" /></div>
          <div><label htmlFor="shipment-receiver" className="block text-sm font-bold text-slate-700 mb-1">Receiver Details *</label><input id="shipment-receiver" required name="receiver_details" value={formData.receiver_details} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Name, Phone, Address" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div><label htmlFor="shipment-origin" className="block text-sm font-bold text-slate-700 mb-1">Origin *</label><input id="shipment-origin" required name="origin" value={formData.origin} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Lagos (LOS)" /></div>
          <div><label htmlFor="shipment-destination" className="block text-sm font-bold text-slate-700 mb-1">Destination *</label><input id="shipment-destination" required name="destination" value={formData.destination} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. London (LHR)" /></div>
          <div><label htmlFor="shipment-commodity" className="block text-sm font-bold text-slate-700 mb-1">Commodity Type *</label><input id="shipment-commodity" required name="commodity_type" value={formData.commodity_type} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Electronics" /></div>
        </div>

        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Service commitments</h2>
            <p className="mt-1 text-xs text-slate-500">Optional dates used for delivery performance and receivables reporting.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="shipment-expected-delivery" className="mb-1 block text-sm font-semibold text-slate-700">Expected delivery date</label>
              <input id="shipment-expected-delivery" type="date" name="expected_delivery_date" value={formData.expected_delivery_date} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <p className="mt-1 text-xs text-slate-400">Used to calculate on-time and late deliveries.</p>
            </div>
            <div>
              <label htmlFor="shipment-payment-due" className="mb-1 block text-sm font-semibold text-slate-700">Payment due date</label>
              <input id="shipment-payment-due" type="date" name="payment_due_date" value={formData.payment_due_date} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <p className="mt-1 text-xs text-slate-400">Used to calculate outstanding receivables ageing.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div><label htmlFor="shipment-weight" className="block text-sm font-bold text-slate-700 mb-1">Weight (kg) *</label><input id="shipment-weight" required type="number" min="0.01" step="0.01" name="weight" value={formData.weight} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 12.5" /></div>
          <div><label htmlFor="shipment-dimensions" className="block text-sm font-bold text-slate-700 mb-1">Dimensions (LxWxH cm) *</label><input id="shipment-dimensions" required name="dimensions" value={formData.dimensions} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 50x40x30" /></div>
        </div>

        <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20">
          {loading ? 'Registering...' : 'Register Shipment'}
        </button>
      </form>
    </div>
  );
}