'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Clock, MessageSquare, Send, ArrowLeft, Edit, Trash2, Save, X, WifiOff, Plane, Anchor, Paperclip, Upload, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import { queueAction, processQueue } from '@/lib/offlineSync';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ShipmentDetails() {
  const params = useParams();
  const router = useRouter();
  
  const rawAwb = params.awb as string;
  const awb = decodeURIComponent(rawAwb).trim();

  const [shipment, setShipment] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [actionBy, setActionBy] = useState(''); 

  const [newComment, setNewComment] = useState('');
  const [commentBy, setCommentBy] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setIsOnline(navigator.onLine);
    if (navigator.onLine) processQueue();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setUserRole(profile?.role || 'Unknown');
    }

    // FETCH FROM THE SECURE VIEW INSTEAD OF THE TABLE
    const { data: shipData, error } = await supabase
      .from('shipments_secure')
      .select(`*, clients (client_name)`)
      .ilike('awb_number', awb)
      .single();
    
    if (error) { console.error(error); setLoading(false); return; }

    setShipment(shipData);
    setEditFormData(shipData);

    if (shipData) {
      const { data: timeData } = await supabase.from('shipment_timeline').select('*').eq('shipment_id', shipData.id).order('created_at', { ascending: false });
      setTimeline(timeData || []);

      const { data: commData } = await supabase.from('shipment_comments').select('*').eq('shipment_id', shipData.id).order('created_at', { ascending: true });
      setComments(commData || []);

      const { data: docData } = await supabase.from('shipment_documents').select('*').eq('shipment_id', shipData.id).order('created_at', { ascending: false });
      setDocuments(docData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (awb) fetchData();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [awb]);

  useEffect(() => {
    if (!shipment?.id) return;
    const channel = supabase
      .channel(`shipment_${shipment.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shipment_comments', filter: `shipment_id=eq.${shipment.id}` }, (payload) => {
        setComments((prev) => prev.some(c => c.id === payload.new.id) ? prev : [...prev.filter(c => !c.isOptimistic), payload.new]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shipment_timeline', filter: `shipment_id=eq.${shipment.id}` }, (payload) => {
        setTimeline((prev) => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev.filter(t => !t.isOptimistic)]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shipment_documents', filter: `shipment_id=eq.${shipment.id}` }, (payload) => {
        setDocuments((prev) => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shipments_secure', filter: `id=eq.${shipment.id}` }, (payload) => {
        setShipment((prev: any) => ({ ...prev, ...payload.new }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shipment?.id]);

  // Generate short-lived signed URLs for private documents
  useEffect(() => {
    const generateUrls = async () => {
      const urls: Record<string, string> = {};
      for (const doc of documents) {
        if (doc.file_path) {
          const { data } = await supabase.storage
            .from('shipment-documents')
            .createSignedUrl(doc.file_path, 3600); // 1 hour expiry
          if (data?.signedUrl) urls[doc.id] = data.signedUrl;
        }
      }
      setSignedUrls(urls);
    };
    if (documents.length > 0) generateUrls();
  }, [documents]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text("MARCHLOG LOGISTICS", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Official Shipment Manifest", 14, 28);
    
    // Shipment Details
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`AWB Number: ${shipment.awb_number}`, 14, 45);
    doc.text(`Client: ${shipment.clients?.client_name}`, 14, 52);
    doc.text(`Type: ${shipment.shipment_type} (${shipment.service_type})`, 14, 59);
    
    // Table Data
    const tableData = [
      ["Sender", shipment.sender_details],
      ["Receiver", shipment.receiver_details],
      ["Origin", shipment.origin],
      ["Destination", shipment.destination],
      ["Commodity", shipment.commodity_type],
      ["Weight / Dims", `${shipment.weight} kg / ${shipment.dimensions}`],
    ];

    autoTable(doc, {
      startY: 70,
      head: [['Field', 'Details']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    // Financials (Only print if they exist in the view)
    if (shipment.agreed_amount) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Financials', 'Amount']],
        body: [
          ["Rate", shipment.rate || '—'],
          ["Agreed Amount", `${shipment.currency} ${shipment.agreed_amount.toLocaleString()}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald
      });
    }

    // Save PDF
    doc.save(`Manifest_${shipment.awb_number}.pdf`);
    toast.success("PDF Downloaded successfully");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!actionBy) return alert('Please enter your name in the "Action By" field before uploading.');

    setUploading(true);
    try {
      // Fetch user's company_id for the folder structure
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user!.id).single();
      
      const fileExt = file.name.split('.').pop();
      // 🔒 Path must start with company_id for RLS to enforce isolation
      const filePath = `${profile!.company_id}/${shipment.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('shipment-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Save path (not public URL) to the database
      const { error: dbError } = await supabase.from('shipment_documents').insert([{
        shipment_id: shipment.id,
        company_id: profile!.company_id,
        file_name: file.name,
        file_path: filePath,        // New: private path
        file_url: null,             // No more public URLs
        uploaded_by: actionBy
      }]);
      if (dbError) throw dbError;

      toast.success("Document uploaded securely!");
      await fetchData();
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFreightBooked = async () => {
    if (!actionBy) return alert('Please enter your name in the "Action By" field.');
    setIsSubmitting(true);
    try {
      await supabase.from('shipments_secure').update({ current_status: 'Booked' }).eq('id', shipment.id);
      await supabase.from('shipment_timeline').insert([{ shipment_id: shipment.id, status_dropdown: 'Booked', status_notes: 'Freight space secured.', updated_by_role: userRole, action_by_name: actionBy }]);
      await supabase.from('notifications').insert([{ role_target: 'ALL', title: 'Shipment Booked', message: `Freight (${actionBy}) booked space for AWB ${shipment.awb_number}. Ready for RFS pickup.`, shipment_awb: shipment.awb_number }]);
      setActionBy(''); await fetchData();
    } catch (error) { alert("Error booking shipment."); } finally { setIsSubmitting(false); }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return alert('Please select a status.');
    if (!actionBy) return alert('Please enter your name.');
    setIsSubmitting(true);
    try {
      await supabase.from('shipments_secure').update({ current_status: newStatus }).eq('id', shipment.id);
      await supabase.from('shipment_timeline').insert([{ shipment_id: shipment.id, status_dropdown: newStatus, status_notes: statusNotes, updated_by_role: userRole, action_by_name: actionBy }]);
      await supabase.from('notifications').insert([{ role_target: 'ALL', title: `Shipment Update: ${newStatus}`, message: `${userRole} (${actionBy}) updated AWB ${shipment.awb_number} to: ${newStatus}.`, shipment_awb: shipment.awb_number }]);
      setNewStatus(''); setStatusNotes(''); setActionBy(''); await fetchData();
    } catch (error) { alert("Error."); } finally { setIsSubmitting(false); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment || !commentBy) return;
    const tempId = `temp-${Date.now()}`;
    setComments(prev => [...prev, { id: tempId, comment_text: newComment, action_by_name: commentBy, created_at: new Date().toISOString(), isOptimistic: true }]);
    const savedComment = newComment; const savedCommentBy = commentBy; setNewComment('');
    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { data, error } = await supabase.from('shipment_comments').insert([{ shipment_id: shipment.id, comment_text: savedComment, updated_by_role: userRole, action_by_name: savedCommentBy }]).select().single();
      if (error) throw error;
      setComments(prev => prev.map(c => c.id === tempId ? data : c));
    } catch (error) {
      setComments(prev => prev.filter(c => c.id !== tempId));
      queueAction('shipment_comments', 'INSERT', { shipment_id: shipment.id, comment_text: savedComment, updated_by_role: userRole, action_by_name: savedCommentBy });
      toast.warning("Offline: Comment saved locally.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete shipment ${awb}?`)) return;
    setIsSubmitting(true);
    await supabase.from('shipments_secure').delete().eq('id', shipment.id);
    await supabase.from('notifications').delete().eq('shipment_awb', shipment.awb_number);
    router.push('/dashboard/shipments'); router.refresh(); 
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    try {
      await supabase.from('shipments_secure').update({ 
        sender_details: editFormData.sender_details, 
        receiver_details: editFormData.receiver_details, 
        weight: parseFloat(editFormData.weight), 
        dimensions: editFormData.dimensions, 
        origin: editFormData.origin, 
        destination: editFormData.destination, 
        commodity_type: editFormData.commodity_type, 
        shipment_type: editFormData.shipment_type,
        service_type: editFormData.service_type,
        agreed_amount: editFormData.agreed_amount ? parseFloat(editFormData.agreed_amount) : null,
        rate: editFormData.rate ? parseFloat(editFormData.rate) : null,
        currency: editFormData.currency
      }).eq('id', shipment.id);
      await supabase.from('shipment_timeline').insert([{ shipment_id: shipment.id, status_dropdown: 'Details Edited', status_notes: 'Shipment info corrected.', updated_by_role: userRole, action_by_name: actionBy || userRole }]);
      setIsEditing(false); await fetchData();
    } catch (error) { alert("Error saving changes."); } finally { setIsSubmitting(false); }
  };

  const handleApprovePayment = async () => {
    if (!actionBy) return alert('Please enter your name.');
    setIsSubmitting(true);
    try {
      await supabase.from('shipments_secure').update({ payment_status: 'Approved' }).eq('id', shipment.id).eq('payment_status', 'Pending'); 
      await supabase.from('shipment_timeline').insert([{ shipment_id: shipment.id, status_dropdown: 'Finance Approved', status_notes: 'Payment confirmed.', updated_by_role: userRole, action_by_name: actionBy }]);
      await supabase.from('notifications').insert([{ role_target: 'Freight', title: 'Action Needed: Book Shipment', message: `Finance (${actionBy}) approved AWB ${shipment.awb_number}. Please book space.`, shipment_awb: shipment.awb_number }]);
      await supabase.from('notifications').insert([{ role_target: 'Customer Service', title: 'Payment Approved', message: `Finance (${actionBy}) approved AWB ${shipment.awb_number}. Awaiting Freight booking.`, shipment_awb: shipment.awb_number }]);
      setActionBy(''); await fetchData(); 
    } catch (error) { alert("Error."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading...</div>;
  if (!shipment) return <div className="p-10 text-center text-red-500 font-bold">Shipment not found.</div>;

  const canEditOrDelete = userRole === 'Super Admin' || userRole === 'Customer Service';
  const canSeeFinancials = userRole === 'Super Admin' || userRole === 'Customer Service' || userRole === 'Finance' || userRole === 'Freight';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {!isOnline && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-md flex items-center gap-3 shadow-sm">
          <WifiOff size={20} /> <p className="font-medium text-sm">You are offline. Changes will sync when connection returns.</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/shipments" className="text-slate-400 hover:text-slate-800 transition-colors p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h1 className="text-sm font-semibold text-slate-500 uppercase tracking-widest hidden md:block">Back to Shipments</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={generatePDF} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-md font-medium text-sm">
            <Download size={16} /> Download Manifest
          </button>
          {canEditOrDelete && (
            <>
              {!isEditing ? (
                <>
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"><Edit size={16} /> Edit</button>
                  <button onClick={handleDelete} disabled={isSubmitting} className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors shadow-sm font-medium text-sm"><Trash2 size={16} /> Delete</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"><X size={16} /> Cancel</button>
                  <button onClick={handleSaveEdit} disabled={isSubmitting} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 font-medium text-sm"><Save size={16} /> Save</button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">AWB: {shipment.awb_number}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-slate-500 text-lg font-medium">Client: <span className="font-bold text-slate-800">{shipment.clients?.client_name}</span></p>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset flex items-center gap-1 ${shipment.shipment_type === 'Import' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}`}>
              {shipment.shipment_type === 'Import' ? <Anchor size={12} /> : <Plane size={12} />} {shipment.shipment_type}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset bg-slate-50 text-slate-700 ring-slate-200">
              {shipment.service_type || 'DDP'}
            </span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className={`px-4 py-2 rounded-xl font-bold text-sm inline-flex items-center gap-2 ring-1 ring-inset ${shipment.payment_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
            <span className={`w-2 h-2 rounded-full ${shipment.payment_status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span> Payment: {shipment.payment_status}
          </div>
          <div className="px-4 py-2 rounded-xl font-bold text-sm inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Status: {shipment.current_status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Shipment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {isEditing && canEditOrDelete ? (
                <>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Shipment Type</label><select name="shipment_type" value={editFormData.shipment_type || 'Export'} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white"><option value="Export">Export</option><option value="Import">Import</option></select></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Service Type</label><select name="service_type" value={editFormData.service_type || 'DDP'} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white"><option value="DDP">DDP</option><option value="DAP">DAP</option><option value="D2P">D2P</option><option value="FOB">FOB</option><option value="EXW">EXW</option><option value="AFW">AFW</option></select></div>
                  {canSeeFinancials && (
                    <>
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Rate</label><input type="number" step="0.01" name="rate" value={editFormData.rate || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Agreed Amount</label><div className="flex gap-2"><select name="currency" value={editFormData.currency || 'NGN'} onChange={handleEditChange} className="w-24 border border-slate-200 p-2.5 rounded-xl text-slate-900 bg-white font-semibold"><option value="NGN">NGN</option><option value="USD">USD</option></select><input type="number" step="0.01" name="agreed_amount" value={editFormData.agreed_amount || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div></div>
                    </>
                  )}
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Commodity</label><input name="commodity_type" value={editFormData.commodity_type || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Sender</label><input name="sender_details" value={editFormData.sender_details || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Receiver</label><input name="receiver_details" value={editFormData.receiver_details || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Origin</label><input name="origin" value={editFormData.origin || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Destination</label><input name="destination" value={editFormData.destination || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Weight</label><input type="number" step="0.01" name="weight" value={editFormData.weight || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div><div><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Dims</label><input name="dimensions" value={editFormData.dimensions || ''} onChange={handleEditChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-slate-900" /></div></div>
                </>
              ) : (
                <>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Sender</span> <span className="text-slate-900 font-semibold">{shipment.sender_details}</span></div>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Receiver</span> <span className="text-slate-900 font-semibold">{shipment.receiver_details}</span></div>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Origin</span> <span className="text-slate-900 font-semibold">{shipment.origin}</span></div>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Destination</span> <span className="text-slate-900 font-semibold">{shipment.destination}</span></div>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Commodity</span> <span className="text-slate-900 font-semibold">{shipment.commodity_type}</span></div>
                  <div><span className="text-xs font-bold text-slate-400 uppercase block mb-1">Weight / Dims</span> <span className="text-slate-900 font-semibold">{shipment.weight} kg / {shipment.dimensions}</span></div>
                  
                  {canSeeFinancials && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                      <div><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Rate</span><span className="text-lg font-extrabold text-slate-800">{shipment.rate ? parseFloat(shipment.rate).toLocaleString() : '—'}</span></div>
                      <div><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Agreed Amount</span><span className="text-lg font-extrabold text-emerald-600">{shipment.currency || 'NGN'} {shipment.agreed_amount ? parseFloat(shipment.agreed_amount).toLocaleString() : '0.00'}</span></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isEditing && (
            <>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Action Panel</h2>
                
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Action By (Your Name) *</label>
                  <input type="text" placeholder="e.g. John Doe" value={actionBy} onChange={e => setActionBy(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-sm" />
                </div>

                {shipment.payment_status === 'Pending' && (userRole === 'Finance' || userRole === 'Super Admin') && (
                  <div className="mb-6 p-4 bg-white border border-amber-200 rounded-xl shadow-sm">
                    <p className="text-amber-700 font-bold mb-3 flex items-center gap-2"><Clock size={18}/> Awaiting Finance Approval</p>
                    <button onClick={handleApprovePayment} disabled={isSubmitting} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 transition-all shadow-md">
                      <CheckCircle size={18} /> {isSubmitting ? 'Processing...' : 'Approve Payment'}
                    </button>
                  </div>
                )}

                {shipment.payment_status === 'Approved' && shipment.current_status === 'Registered' && (userRole === 'Freight' || userRole === 'Super Admin') && (
                  <div className="mb-6 p-4 bg-white border border-blue-200 rounded-xl shadow-sm">
                    <p className="text-blue-700 font-bold mb-3 flex items-center gap-2"><Plane size={18}/> Awaiting Freight Booking</p>
                    <button onClick={handleFreightBooked} disabled={isSubmitting} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md">
                      <CheckCircle size={18} /> {isSubmitting ? 'Processing...' : 'Mark as Booked'}
                    </button>
                  </div>
                )}

                {!((shipment.payment_status === 'Pending' && userRole === 'Finance') || (shipment.current_status === 'Registered' && userRole === 'Freight')) && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Status</label>
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-sm">
                          <option value="">Select Status...</option>
                          {(userRole === 'RFS' || userRole === 'Super Admin') && (<><option value="Picked Up">Picked Up (RFS)</option><option value="Handed to Ops">Handed to Ops</option><option value="Delivered">Delivered (Local)</option></>)}
                          {(userRole === 'Operations' || userRole === 'Super Admin') && (<><option value="Export Cleared">Export/Import Cleared (Ops)</option><option value="Handed to Airline">Handed to Airline</option></>)}
                          {userRole === 'Super Admin' && <option value="Delivered">Mark as Delivered</option>}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Additional Notes</label>
                        <input type="text" placeholder="Optional details..." value={statusNotes} onChange={e => setStatusNotes(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-sm" />
                      </div>
                    </div>
                    <button onClick={handleUpdateStatus} disabled={isSubmitting} className="mt-4 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                      {isSubmitting ? 'Updating...' : 'Update Status'}
                    </button>
                  </>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Paperclip size={20} className="text-indigo-500"/> Documents & Attachments</h2>
                
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl border-dashed flex flex-col items-center justify-center text-center">
                  <Upload className="text-slate-400 mb-2" size={32} />
                  <p className="text-sm text-slate-600 font-medium mb-2">Upload proof of pickup, customs forms, or invoices.</p>
                  <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  <label htmlFor="file-upload" className={`cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-slate-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? 'Uploading...' : 'Select File to Upload'}
                  </label>
                </div>

                <div className="space-y-3">
                  {documents.length === 0 && <p className="text-slate-500 text-sm italic">No documents uploaded yet.</p>}
                  {documents.map((doc) => {
                    const signedUrl = signedUrls[doc.id];
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={20} /></div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">{doc.file_name}</p>
                            <p className="text-xs text-slate-500">Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {signedUrl ? (
                          <a
                            href={signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <Download size={14} /> View
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Generating link…</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 h-112.5 overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Clock size={20} className="text-indigo-500"/> Timeline</h2>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {timeline.map((item, i) => (
                <div key={item.id || i} className={`relative flex items-center justify-between md:justify-normal group is-active ${item.isOptimistic ? 'opacity-60' : ''}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 border-white text-white shadow shrink-0 z-10 text-xs ${item.isOptimistic ? 'bg-slate-400' : 'bg-indigo-500'}`}>{item.isOptimistic ? '...' : '✓'}</div>
                  <div className="w-[calc(100%-3rem)] bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm ml-4">
                    <div className="flex items-center justify-between space-x-2 mb-1"><div className="font-bold text-slate-900 text-sm">{item.status_dropdown}</div><time className="text-[10px] font-semibold text-slate-400 uppercase">{new Date(item.created_at).toLocaleDateString()}</time></div>
                    <div className="text-sm text-slate-600 leading-relaxed">{item.status_notes}</div>
                    <div className="text-xs text-indigo-600 mt-2 font-bold bg-indigo-50 px-2 py-1 rounded-md inline-block">By: {item.action_by_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex flex-col h-112.5">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><MessageSquare size={20} className="text-indigo-500"/> Team Comments</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {comments.map((c, i) => (
                <div key={c.id || i} className={`bg-slate-50 p-4 rounded-xl border border-slate-100 ${c.isOptimistic ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-center mb-2"><span className="font-bold text-slate-800 text-sm">{c.action_by_name}</span><span className="text-[10px] font-bold text-slate-400 uppercase">{c.isOptimistic ? 'Sending...' : new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                  <p className="text-sm text-slate-700 leading-relaxed">{c.comment_text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="mt-auto space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input type="text" placeholder="Your Name..." value={commentBy} onChange={e => setCommentBy(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-slate-900 bg-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" required />
              <div className="flex gap-2">
                <input type="text" placeholder="Type a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} className="w-full border border-slate-200 p-2 rounded-lg text-slate-900 bg-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" required />
                <button type="submit" className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"><Send size={18} /></button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}