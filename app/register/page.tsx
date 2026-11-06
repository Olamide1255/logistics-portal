'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RegisterShipment() {
  const [awb, setAwb] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e: any) => {
    e.preventDefault();
    
    // Check if AWB already exists
    const { data: existing } = await supabase
      .from('shipments')
      .select('awb_number')
      .eq('awb_number', awb)
      .single();

    if (existing) {
      setError('Shipment with this AWB already exists!');
      return;
    }

    // Insert new shipment
    const { error: insertError } = await supabase.from('shipments').insert([
      { awb_number: awb, sender_details: 'Test Sender', receiver_details: 'Test Receiver', current_status: 'Registered' }
    ]);

    if (insertError) setError(insertError.message);
    else alert('Shipment Registered Successfully!');
  };

  return (
    <form onSubmit={handleRegister} className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Register Shipment</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <input 
        type="text" 
        placeholder="Enter AWB Number" 
        className="border p-2 w-full mb-4" 
        value={awb} onChange={(e) => setAwb(e.target.value)} required 
      />
      <button type="submit" className="bg-blue-600 text-white p-2 w-full rounded">Submit</button>
    </form>
  );
}