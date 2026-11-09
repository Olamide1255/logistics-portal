'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RegisterShipment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    awb_number: '',
    client_name: '',
    sender_details: '',
    receiver_details: '',
    weight: '',
    dimensions: '',
    origin: '',
    destination: '',
    commodity_type: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

        try {
      // 1. Check if AWB already exists
      const { data: existingShipment } = await supabase
        .from('shipments')
        .select('awb_number')
        .eq('awb_number', formData.awb_number)
        .maybeSingle(); // Changed to maybeSingle

      if (existingShipment) {
        throw new Error('A shipment with this AWB Number already exists!');
      }

      // 2. Check if Client exists
      let clientId;
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .ilike('client_name', formData.client_name) 
        .maybeSingle(); // Changed to maybeSingle

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // 3. Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{ client_name: formData.client_name }])
          .select()
          .single(); // This one stays .single() because we just inserted it and expect 1 result
        
        if (clientError) {
          console.error("Supabase Insert Error:", clientError); // Logs to browser console
          throw new Error(`Database Error: ${clientError.message}`); // Shows real error on screen
        }
        clientId = newClient.id;
      }

      // 4. Insert the Shipment
      const { error: shipmentError } = await supabase.from('shipments').insert([
        {
          awb_number: formData.awb_number,
          client_id: clientId,
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

      // NOTIFY FINANCE
      await supabase.from('notifications').insert([{
        role_target: 'Finance',
        title: 'New Shipment Registered',
        message: `AWB ${formData.awb_number} is awaiting payment approval.`,
        shipment_awb: formData.awb_number
      }]);

      setSuccess('Shipment registered successfully!');
      setTimeout(() => router.push('/dashboard/shipments'), 2000); 

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

    return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Register New Shipment</h1>
        <p className="text-gray-500">Enter the shipment details below. AWB numbers must be unique.</p>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-4 rounded mb-6 border border-green-200">{success}</div>}

      <form onSubmit={handleRegister} className="bg-white p-8 rounded-lg shadow border border-gray-200">
        
        {/* AWB & Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AWB Number *</label>
            <input required name="awb_number" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 123-45678901" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input required name="client_name" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Acme Corp" />
          </div>
        </div>

        {/* Sender & Receiver */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Details *</label>
            <input required name="sender_details" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="Name, Phone, Address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Details *</label>
            <input required name="receiver_details" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="Name, Phone, Address" />
          </div>
        </div>

        {/* Origin, Destination, Commodity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
            <input required name="origin" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Lagos (LOS)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
            <input required name="destination" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. London (LHR)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commodity Type *</label>
            <input required name="commodity_type" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Electronics" />
          </div>
        </div>

        {/* Weight & Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
            <input required type="number" step="0.01" name="weight" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 12.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions (LxWxH cm) *</label>
            <input required name="dimensions" onChange={handleChange} className="w-full border p-2 rounded text-gray-900 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 50x40x30" />
          </div>
        </div>

        <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition">
          {loading ? 'Registering...' : 'Register Shipment'}
        </button>
      </form>
    </div>
  );
}