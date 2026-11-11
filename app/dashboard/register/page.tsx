'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function RegisterShipment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        if (prefix.includes('admin') || prefix.includes('it') || prefix.includes('cs') || prefix.includes('info')) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } else {
        router.push('/login');
      }
    };
    checkRole();
  }, [router]);

  const initialFormState = {
    awb_number: '',
    client_name: '',
    shipment_type: 'Export', // Default to Export
    sender_details: '',
    receiver_details: '',
    weight: '',
    dimensions: '',
    origin: '',
    destination: '',
    commodity_type: '',
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
      const { data: existingShipment } = await supabase
        .from('shipments')
        .select('awb_number')
        .eq('awb_number', formData.awb_number)
        .maybeSingle(); 

      if (existingShipment) throw new Error('A shipment with this AWB Number already exists!');

      let clientId;
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .ilike('client_name', formData.client_name) 
        .maybeSingle(); 

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{ client_name: formData.client_name }])
          .select()
          .single(); 
        
        if (clientError) throw new Error(`Database Error: ${clientError.message}`); 
        clientId = newClient.id;
      }

      const { error: shipmentError } = await supabase.from('shipments').insert([
        {
          awb_number: formData.awb_number,
          client_id: clientId,
          shipment_type: formData.shipment_type, // Save Import/Export
          sender_details: formData.sender_details,
          receiver_details: formData.receiver_details,
          weight: parseFloat(formData.weight),
          dimensions: formData.dimensions,
          origin: formData.origin,
          destination: formData.destination,
          commodity_type: formData.commodity_type,
          current_status: 'Registered',
          payment_status: 'Pending',
        }
      ]);

      if (shipmentError) throw shipmentError;

      // Notify Finance
      await supabase.from('notifications').insert([{
        role_target: 'Finance',
        title: 'New Shipment Registered',
        message: `AWB ${formData.awb_number} (${formData.shipment_type}) is awaiting payment approval.`,
        shipment_awb: formData.awb_number
      }]);

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
        <p className="text-slate-500 max-w-md mb-6">Only Customer Service and Super Admins can register new shipments.</p>
        <Link href="/dashboard" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Register New Shipment</h1>
        <p className="text-slate-500 mt-1 font-medium">Enter the shipment details below. AWB numbers must be unique.</p>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 font-medium">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 border border-emerald-200 font-medium">{success}</div>}

      <form onSubmit={handleRegister} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">AWB Number *</label>
            <input required name="awb_number" value={formData.awb_number} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 123-45678901" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">Client Name *</label>
            <input required name="client_name" value={formData.client_name} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Acme Corp" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">Shipment Type *</label>
            <select required name="shipment_type" value={formData.shipment_type} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
              <option value="Export">Export</option>
              <option value="Import">Import</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Sender Details *</label><input required name="sender_details" value={formData.sender_details} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Name, Phone, Address" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Receiver Details *</label><input required name="receiver_details" value={formData.receiver_details} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Name, Phone, Address" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Origin *</label><input required name="origin" value={formData.origin} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Lagos (LOS)" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Destination *</label><input required name="destination" value={formData.destination} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. London (LHR)" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Commodity Type *</label><input required name="commodity_type" value={formData.commodity_type} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Electronics" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Weight (kg) *</label><input required type="number" step="0.01" name="weight" value={formData.weight} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 12.5" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Dimensions (LxWxH cm) *</label><input required name="dimensions" value={formData.dimensions} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. 50x40x30" /></div>
        </div>

        <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20">
          {loading ? 'Registering...' : 'Register Shipment'}
        </button>
      </form>
    </div>
  );
}