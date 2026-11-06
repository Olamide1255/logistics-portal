'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ShipmentDetails({ params }: { params: { awb: string } }) {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [actionBy, setActionBy] = useState(''); // e.g. "John (Finance)"
  
  const updateStatus = async () => {
    if (!actionBy) return alert('Please enter your name/initials to confirm action.');
    
    await supabase.from('shipment_timeline').insert([{
      shipment_id: params.awb, // Assuming we fetch by AWB
      status_dropdown: status,
      status_notes: notes,
      updated_by_role: 'Current User Role', // You'd pass this from Auth
      action_by_name: actionBy
    }]);

    await supabase.from('shipments').update({ current_status: status }).eq('awb_number', params.awb);
    alert('Status Updated!');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Shipment: {params.awb}</h1>
      
      {/* Status Update Section */}
      <div className="border p-4 rounded bg-gray-50">
        <h2 className="font-bold mb-2">Update Status</h2>
        <select className="border p-2 w-full mb-2" onChange={(e) => setStatus(e.target.value)}>
          <option value="">Select Status...</option>
          <option value="Picked Up">Picked Up</option>
          <option value="Handed to Ops">Handed to Ops</option>
          <option value="Export Cleared">Export Cleared</option>
          <option value="Handed to Airline">Handed to Airline</option>
        </select>
        
        <textarea 
          placeholder="Additional Notes (Free text)..." 
          className="border p-2 w-full mb-2" 
          onChange={(e) => setNotes(e.target.value)}
        />
        
        <input 
          type="text" 
          placeholder="Action By (Your Name - Role)" 
          className="border p-2 w-full mb-2" 
          onChange={(e) => setActionBy(e.target.value)}
        />
        
        <button onClick={updateStatus} className="bg-green-600 text-white px-4 py-2 rounded">Update</button>
      </div>
    </div>
  );
}