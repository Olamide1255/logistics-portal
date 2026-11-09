'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Clock, MessageSquare, Send, ArrowLeft, Edit, Trash2, Save, X } from 'lucide-react';
import Link from 'next/link';

export default function ShipmentDetails() {
  const params = useParams();
  const router = useRouter();
  const awb = params.awb as string;

  const [shipment, setShipment] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Update State
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [actionBy, setActionBy] = useState(''); 

  // Comment State
  const [newComment, setNewComment] = useState('');
  const [commentBy, setCommentBy] = useState('');

  const fetchData = async () => {
    setLoading(true);
    
    // Get User Role
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const prefix = user.email.split('@')[0].toLowerCase();
      let role = 'Unknown';
      if (prefix.includes('admin') || prefix.includes('it')) role = 'Super Admin';
      else if (prefix.includes('finance')) role = 'Finance';
      else if (prefix.includes('cs')) role = 'Customer Service';
      else if (prefix.includes('rfs')) role = 'RFS';
      else if (prefix.includes('ops')) role = 'Operations';
      setUserRole(role);
    }

    // Get Shipment
    const { data: shipData, error } = await supabase
      .from('shipments')
      .select(`*, clients (client_name)`)
      .eq('awb_number', awb)
      .single();
    
    if (error) {
      console.error("Error fetching shipment:", error);
      setLoading(false);
      return;
    }

    setShipment(shipData);
    setEditFormData(shipData);

    if (shipData) {
      const { data: timeData } = await supabase
        .from('shipment_timeline')
        .select('*')
        .eq('shipment_id', shipData.id)
        .order('created_at', { ascending: false });
      setTimeline(timeData || []);

      const { data: commData } = await supabase
        .from('shipment_comments')
        .select('*')
        .eq('shipment_id', shipData.id)
        .order('created_at', { ascending: true });
      setComments(commData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (awb) fetchData();
  }, [awb]);

  // --- DELETE FUNCTION ---
  const handleDelete = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete shipment ${awb}? This action cannot be undone.`);
    if (!confirmDelete) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from('shipments').delete().eq('id', shipment.id);
    
    if (error) {
      alert("Error deleting shipment: " + error.message);
      setIsSubmitting(false);
    } else {
      router.push('/dashboard/shipments');
    }
  };

  // --- EDIT FUNCTIONS ---
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    const { error } = await supabase
      .from('shipments')
      .update({
        sender_details: editFormData.sender_details,
        receiver_details: editFormData.receiver_details,
        weight: parseFloat(editFormData.weight),
        dimensions: editFormData.dimensions,
        origin: editFormData.origin,
        destination: editFormData.destination,
        commodity_type: editFormData.commodity_type,
      })
      .eq('id', shipment.id);

    if (error) {
      alert("Error saving changes: " + error.message);
    } else {
      await supabase.from('shipment_timeline').insert([{
        shipment_id: shipment.id,
        status_dropdown: 'Details Edited',
        status_notes: 'Shipment information was manually corrected/updated.',
        updated_by_role: userRole,
        action_by_name: actionBy || userRole
      }]);
      
      setIsEditing(false);
      await fetchData();
    }
    setIsSubmitting(false);
  };

  // --- STATUS & COMMENT FUNCTIONS ---
  const handleApprovePayment = async () => {
    if (!actionBy) return alert('Please enter your name in the "Action By" field first.');
    setIsSubmitting(true);
    await supabase.from('shipments').update({ payment_status: 'Approved' }).eq('id', shipment.id);
    await supabase.from('shipment_timeline').insert([{
      shipment_id: shipment.id,
      status_dropdown: 'Finance Approved',
      status_notes: 'Payment confirmed and shipment released to next stage.',
      updated_by_role: userRole,
      action_by_name: actionBy
    }]);

    // NOTIFY RFS
    await supabase.from('notifications').insert([{
      role_target: 'RFS',
      title: 'Shipment Ready for Pickup',
      message: `AWB ${shipment.awb_number} has been approved by Finance and is ready for pickup.`,
      shipment_awb: shipment.awb_number
    }]);

    setActionBy('');
    await fetchData();
    setIsSubmitting(false);
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return alert('Please select a status.');
    if (!actionBy) return alert('Please enter your name in the "Action By" field.');
    setIsSubmitting(true);

    await supabase.from('shipments').update({ current_status: newStatus }).eq('id', shipment.id);
    await supabase.from('shipment_timeline').insert([{
      shipment_id: shipment.id,
      status_dropdown: newStatus,
      status_notes: statusNotes,
      updated_by_role: userRole, 
      action_by_name: actionBy
    }]);

    // NOTIFY NEXT TEAM
    if (newStatus === 'Picked Up') {
      await supabase.from('notifications').insert([{
        role_target: 'Operations',
        title: 'Shipment Arriving at Ops',
        message: `AWB ${shipment.awb_number} has been picked up by RFS.`,
        shipment_awb: shipment.awb_number
      }]);
    } else if (newStatus === 'Handed to Ops') {
      await supabase.from('notifications').insert([{
        role_target: 'Operations',
        title: 'Shipment Handed to Ops',
        message: `AWB ${shipment.awb_number} has been handed over for export formalities.`,
        shipment_awb: shipment.awb_number
      }]);
    } else if (newStatus === 'Export Cleared' || newStatus === 'Handed to Airline') {
      await supabase.from('notifications').insert([{
        role_target: 'Customer Service',
        title: 'Shipment Progress Update',
        message: `AWB ${shipment.awb_number} status changed to: ${newStatus}.`,
        shipment_awb: shipment.awb_number
      }]);
    }

    setNewStatus('');
    setStatusNotes('');
    setActionBy('');
    await fetchData();
    setIsSubmitting(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment || !commentBy) return alert('Please enter your name and a comment.');

    await supabase.from('shipment_comments').insert([{
      shipment_id: shipment.id,
      comment_text: newComment,
      updated_by_role: userRole,
      action_by_name: commentBy
    }]);

    setNewComment('');
    await fetchData();
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading shipment details...</div>;
  if (!shipment) return <div className="p-10 text-center text-red-500">Shipment not found.</div>;

  // Determine if user can edit/delete (Only Admin and CS)
  const canEditOrDelete = userRole === 'Super Admin' || userRole === 'Customer Service';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/shipments" className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Back to Shipments</h1>
        </div>
        
        {/* EDIT / DELETE BUTTONS (Role Restricted) */}
        {canEditOrDelete && (
          <>
            {!isEditing ? (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition">
                  <Edit size={16} /> Edit
                </button>
                <button onClick={handleDelete} disabled={isSubmitting} className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded hover:bg-red-100 transition">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition">
                  <X size={16} /> Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={isSubmitting} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                  <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AWB: {shipment.awb_number}</h1>
          <p className="text-gray-500 text-lg mt-1">Client: <span className="font-semibold text-gray-800">{shipment.clients?.client_name}</span></p>
        </div>
        <div className="text-left md:text-right space-y-2">
          <div className={`px-4 py-2 rounded-full font-bold text-sm inline-block ${shipment.payment_status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
            Payment: {shipment.payment_status}
          </div>
          <br/>
          <div className="px-4 py-2 rounded-full font-bold text-sm inline-block bg-blue-100 text-blue-800">
            Status: {shipment.current_status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Shipment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {isEditing && canEditOrDelete ? (
                <>
                  <div><label className="text-gray-500 block mb-1">Sender</label> <input name="sender_details" value={editFormData.sender_details || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  <div><label className="text-gray-500 block mb-1">Receiver</label> <input name="receiver_details" value={editFormData.receiver_details || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  <div><label className="text-gray-500 block mb-1">Origin</label> <input name="origin" value={editFormData.origin || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  <div><label className="text-gray-500 block mb-1">Destination</label> <input name="destination" value={editFormData.destination || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  <div><label className="text-gray-500 block mb-1">Commodity</label> <input name="commodity_type" value={editFormData.commodity_type || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-gray-500 block mb-1">Weight (kg)</label> <input type="number" step="0.01" name="weight" value={editFormData.weight || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                    <div><label className="text-gray-500 block mb-1">Dims</label> <input name="dimensions" value={editFormData.dimensions || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-gray-900" /></div>
                  </div>
                </>
              ) : (
                <>
                  <div><span className="text-gray-500 block">Sender</span> <span className="text-gray-900 font-medium">{shipment.sender_details}</span></div>
                  <div><span className="text-gray-500 block">Receiver</span> <span className="text-gray-900 font-medium">{shipment.receiver_details}</span></div>
                  <div><span className="text-gray-500 block">Origin</span> <span className="text-gray-900 font-medium">{shipment.origin}</span></div>
                  <div><span className="text-gray-500 block">Destination</span> <span className="text-gray-900 font-medium">{shipment.destination}</span></div>
                  <div><span className="text-gray-500 block">Commodity</span> <span className="text-gray-900 font-medium">{shipment.commodity_type}</span></div>
                  <div><span className="text-gray-500 block">Weight / Dims</span> <span className="text-gray-900 font-medium">{shipment.weight} kg / {shipment.dimensions}</span></div>
                </>
              )}
            </div>
          </div>

          {/* ACTION PANEL */}
          {!isEditing && (
            <div className="bg-gray-50 p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Action Panel</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Action By (Your Name / Dept) *</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe" 
                  value={actionBy} 
                  onChange={e => setActionBy(e.target.value)}
                  className="w-full border p-2 rounded text-gray-900 bg-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* FINANCE APPROVAL BUTTON (Role Restricted) */}
              {shipment.payment_status === 'Pending' && (userRole === 'Finance' || userRole === 'Super Admin') && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded">
                  <p className="text-orange-800 font-semibold mb-2">Awaiting Finance Approval</p>
                  <button onClick={handleApprovePayment} disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2 transition">
                    <CheckCircle size={18} /> {isSubmitting ? 'Processing...' : 'Approve Payment & Release'}
                  </button>
                </div>
              )}

              {/* STATUS UPDATE FORM (Role Restricted Options) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">New Status</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border p-2 rounded text-gray-900 bg-white focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Select Status...</option>
                    
                    {(userRole === 'RFS' || userRole === 'Super Admin') && (
                      <>
                        <option value="Picked Up">Picked Up (RFS)</option>
                        <option value="Handed to Ops">Handed to Ops</option>
                        <option value="Delivered">Delivered (Local)</option>
                      </>
                    )}

                    {(userRole === 'Operations' || userRole === 'Super Admin') && (
                      <>
                        <option value="Export Cleared">Export Cleared (Ops)</option>
                        <option value="Handed to Airline">Handed to Airline</option>
                      </>
                    )}
                    
                    {userRole === 'Super Admin' && (
                      <option value="Delivered">Mark as Delivered</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Additional Notes</label>
                  <input type="text" placeholder="Optional details..." value={statusNotes} onChange={e => setStatusNotes(e.target.value)} className="w-full border p-2 rounded text-gray-900 bg-white focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <button onClick={handleUpdateStatus} disabled={isSubmitting} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-96 overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock size={20}/> Timeline</h2>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {timeline.length === 0 && <p className="text-gray-500 text-sm">No updates yet.</p>}
              {timeline.map((item, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal group is-active">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-blue-500 text-white shadow shrink-0 z-10 text-xs">
                    ✓
                  </div>
                  <div className="w-[calc(100%-2rem)] bg-gray-50 p-3 rounded border border-gray-100 shadow-sm ml-4">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-gray-800 text-sm">{item.status_dropdown}</div>
                      <time className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</time>
                    </div>
                    <div className="text-sm text-gray-600">{item.status_notes}</div>
                    <div className="text-xs text-blue-600 mt-2 font-medium">By: {item.action_by_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col h-96">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageSquare size={20}/> Team Comments</h2>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
              {comments.length === 0 && <p className="text-gray-500 text-sm">No comments yet.</p>}
              {comments.map((c, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded text-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-800">{c.action_by_name}</span>
                    <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-gray-700">{c.comment_text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="mt-auto space-y-2">
              <input 
                type="text" 
                placeholder="Your Name..." 
                value={commentBy} 
                onChange={e => setCommentBy(e.target.value)}
                className="w-full border p-2 rounded text-gray-900 bg-white text-sm focus:ring-blue-500 focus:border-blue-500" 
                required
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Type a comment..." 
                  value={newComment} 
                  onChange={e => setNewComment(e.target.value)}
                  className="w-full border p-2 rounded text-gray-900 bg-white text-sm focus:ring-blue-500 focus:border-blue-500" 
                  required
                />
                <button type="submit" className="bg-gray-800 text-white p-2 rounded hover:bg-gray-900 transition">
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}