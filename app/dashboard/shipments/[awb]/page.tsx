'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Clock, MessageSquare, Send, ArrowLeft, Edit, Trash2, Save, X, WifiOff, Plane, Anchor, Paperclip, Upload, FileText, Download, DollarSign, Plus } from 'lucide-react';
import Link from 'next/link';
import { queueAction, processQueue } from '@/lib/offlineSync';
import { toast, Toaster } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MAX_SHIPMENT_DOCUMENT_SIZE = 10 * 1024 * 1024;

export default function ShipmentDetails() {
  const params = useParams();
  const router = useRouter();
  
  const rawAwb = params.awb as string;
  const awb = decodeURIComponent(rawAwb).trim();

  const [shipment, setShipment] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [actionBy, setActionBy] = useState(''); 

  const [newComment, setNewComment] = useState('');
  const [commentBy, setCommentBy] = useState('');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setIsOnline(navigator.onLine);
    if (navigator.onLine) processQueue();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setUserRole(profile?.role || 'Unknown');
    }

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

      const { data: payData } = await supabase.from('payments').select('*').eq('shipment_id', shipData.id).order('created_at', { ascending: false });
      setPayments(payData || []);
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
        setDocuments((prev) => prev.some((doc) => doc.id === payload.new.id) ? prev : [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments', filter: `shipment_id=eq.${shipment.id}` }, (payload) => {
        setPayments((prev) => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shipments', filter: `id=eq.${shipment.id}` }, (payload) => {
        setShipment((prev: any) => ({ ...prev, ...payload.new }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shipment?.id]);

  // Calculate Financials
  const agreedAmount = parseFloat(shipment?.agreed_amount || '0');
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const balance = agreedAmount - totalPaid;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !actionBy) return toast.error("Please enter amount and your name.");
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('payments').insert([{
        company_id: shipment.company_id,
        shipment_id: shipment.id,
        amount: parseFloat(paymentAmount),
        currency: shipment.currency,
        payment_method: paymentMethod,
        reference: paymentRef,
        recorded_by: actionBy
      }]);
      if (error) throw error;

      // Auto-approve shipment if fully paid. A payment remains recorded even
      // if the separate shipment-status update needs an administrator's attention.
      if (totalPaid + parseFloat(paymentAmount) >= agreedAmount) {
        const { error: approvalError } = await supabase
          .from('shipments')
          .update({ payment_status: 'Approved' })
          .eq('id', shipment.id);
        if (approvalError) {
          toast.warning('Payment was recorded, but the shipment payment status could not be updated.');
        }
      }

      toast.success("Payment recorded successfully!");
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      await fetchData(); // Refresh ledger
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedFileTypes: Record<string, { mimeType: string; extensions: string[] }> = {
      'application/pdf': { mimeType: 'application/pdf', extensions: ['pdf'] },
      'image/jpeg': { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
      'image/png': { mimeType: 'image/png', extensions: ['png'] }
    };
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const matchingType = allowedFileTypes[file.type];

    if (!actionBy.trim()) {
      toast.error('Enter your name in the "Action By" field before uploading.');
      e.target.value = '';
      return;
    }
    if (!matchingType || !matchingType.extensions.includes(fileExtension)) {
      toast.error('Unsupported file type. Upload a PDF, JPG, JPEG, or PNG file.');
      e.target.value = '';
      return;
    }
    if (file.size === 0) {
      toast.error('The selected file is empty.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SHIPMENT_DOCUMENT_SIZE) {
      toast.error('File is too large. The maximum document size is 10 MB.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    let uploadedFilePath: string | null = null;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Your session could not be verified. Please sign in again.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      if (profileError || !profile?.company_id) throw new Error('Your company profile could not be verified.');

      if (!shipment?.id || !shipment?.company_id || shipment.company_id !== profile.company_id) {
        throw new Error('You do not have permission to upload documents for this shipment.');
      }

      const filePath = `${profile.company_id}/${shipment.id}/${crypto.randomUUID()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from('shipment-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: matchingType.mimeType,
          upsert: false
        });
      if (uploadError) throw uploadError;
      uploadedFilePath = filePath;

      // file_url is retained for compatibility with the existing NOT NULL schema.
      // It stores the private object path, never a permanent or public URL.
      const { data: savedDocument, error: dbError } = await supabase
        .from('shipment_documents')
        .insert([{
          shipment_id: shipment.id,
          company_id: profile.company_id,
          file_name: file.name,
          file_path: filePath,
          file_url: filePath,
          uploaded_by: actionBy.trim()
        }])
        .select('*')
        .single();

      if (dbError) {
        const { error: cleanupError } = await supabase.storage.from('shipment-documents').remove([filePath]);
        if (cleanupError) console.error('Failed to clean up orphaned shipment document:', cleanupError);
        uploadedFilePath = null;
        throw dbError;
      }

      setDocuments((previous) => previous.some((doc) => doc.id === savedDocument.id)
        ? previous
        : [savedDocument, ...previous]);
      toast.success('Document uploaded securely.');
    } catch (error: any) {
      if (uploadedFilePath) {
        const { error: cleanupError } = await supabase.storage.from('shipment-documents').remove([uploadedFilePath]);
        if (cleanupError) console.error('Failed to clean up uploaded shipment document:', cleanupError);
      }
      toast.error(`Document upload failed: ${error?.message || 'Unexpected error'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenDocument = async (document: any) => {
    // Open a blank tab synchronously so browser popup blockers do not discard the user action.
    const newWindow = window.open('about:blank', '_blank');
    try {
      let storagePath = document.file_path || document.file_url;
      if (!storagePath) throw new Error('This document has no stored file path.');

      // Older records may contain a Supabase object URL instead of a storage path.
      if (/^https?:\/\//i.test(storagePath)) {
        const bucketMarker = '/shipment-documents/';
        const bucketIndex = storagePath.indexOf(bucketMarker);
        if (bucketIndex >= 0) {
          storagePath = decodeURIComponent(storagePath.slice(bucketIndex + bucketMarker.length).split('?')[0]);
        } else {
          if (newWindow) newWindow.location.href = storagePath;
          else window.location.assign(storagePath);
          return;
        }
      }

      const { data, error } = await supabase.storage
        .from('shipment-documents')
        .createSignedUrl(storagePath, 300);
      if (error || !data?.signedUrl) throw error || new Error('Could not create a secure document link.');

      if (newWindow) newWindow.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch (error: any) {
      newWindow?.close();
      toast.error(`Could not open document: ${error?.message || 'Unexpected error'}`);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); 
    doc.text("MARCHLOG LOGISTICS", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Official Shipment Manifest", 14, 28);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`AWB Number: ${shipment.awb_number}`, 14, 45);
    doc.text(`Client: ${shipment.clients?.client_name}`, 14, 52);
    doc.text(`Type: ${shipment.shipment_type} (${shipment.service_type})`, 14, 59);
    
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

    if (shipment.agreed_amount) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Financials', 'Amount']],
        body: [
          ["Agreed Amount", `${shipment.currency} ${agreedAmount.toLocaleString()}`],
          ["Total Paid", `${shipment.currency} ${totalPaid.toLocaleString()}`],
          ["Outstanding Balance", `${shipment.currency} ${balance.toLocaleString()}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, 
      });
    }

    doc.save(`Manifest_${shipment.awb_number}.pdf`);
    toast.success("PDF Downloaded successfully");
  };

  const handleFreightBooked = async () => {
    if (!actionBy) return alert('Please enter your name in the "Action By" field.');
    setIsSubmitting(true);
    try {
      const { error: statusError } = await supabase
        .from('shipments')
        .update({ current_status: 'Booked' })
        .eq('id', shipment.id);
      if (statusError) throw statusError;

      const { error: timelineError } = await supabase.from('shipment_timeline').insert([{
        shipment_id: shipment.id,
        status_dropdown: 'Booked',
        status_notes: 'Freight space secured.',
        updated_by_role: userRole,
        action_by_name: actionBy,
      }]);
      if (timelineError) throw timelineError;

      const { error: notificationError } = await supabase.from('notifications').insert([{
        role_target: 'ALL',
        title: 'Shipment Booked',
        message: `Freight (${actionBy}) booked space for AWB ${shipment.awb_number}. Ready for RFS pickup.`,
        shipment_awb: shipment.awb_number,
      }]);
      if (notificationError) toast.warning('Shipment booked, but the team notification could not be created.');

      setActionBy('');
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to book this shipment.');
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (statusToApply = newStatus, notesToApply = statusNotes) => {
    if (!statusToApply) return alert('Please select a status.');
    if (!actionBy) return alert('Please enter your name.');
    setIsSubmitting(true);
    try {
      const { error: statusError } = await supabase
        .from('shipments')
        .update({ current_status: statusToApply })
        .eq('id', shipment.id);
      if (statusError) throw statusError;

      const { error: timelineError } = await supabase.from('shipment_timeline').insert([{
        shipment_id: shipment.id,
        status_dropdown: statusToApply,
        status_notes: notesToApply,
        updated_by_role: userRole,
        action_by_name: actionBy,
      }]);
      if (timelineError) {
        toast.error('Shipment status changed, but its timeline entry could not be saved. Contact an administrator.');
        await fetchData();
        return;
      }

      const { error: notificationError } = await supabase.from('notifications').insert([{
        role_target: 'ALL',
        title: `Shipment Update: ${statusToApply}`,
        message: `${userRole} (${actionBy}) updated AWB ${shipment.awb_number} to: ${statusToApply}.`,
        shipment_awb: shipment.awb_number,
      }]);
      if (notificationError) toast.warning('Status and timeline saved, but the team notification could not be created.');

      setNewStatus('');
      setStatusNotes('');
      setActionBy('');
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update shipment status.');
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
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
    const { error } = await supabase.from('shipments').delete().eq('id', shipment.id);
    if (error) {
      toast.error(error.message);
      setIsSubmitting(false);
      return;
    }
    router.push('/dashboard/shipments');
    router.refresh(); 
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.from('shipments').update({
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
        currency: editFormData.currency,
      }).eq('id', shipment.id);
      if (updateError) throw updateError;

      const { error: timelineError } = await supabase.from('shipment_timeline').insert([{
        shipment_id: shipment.id,
        status_dropdown: 'Details Edited',
        status_notes: 'Shipment info corrected.',
        updated_by_role: userRole,
        action_by_name: actionBy || userRole,
      }]);
      if (timelineError) toast.warning('Shipment details saved, but the timeline entry could not be created.');

      setIsEditing(false);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save shipment changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePayment = async () => {
    if (!actionBy) return alert('Please enter your name.');
    setIsSubmitting(true);
    try {
      const { data: updatedShipment, error: approvalError } = await supabase
        .from('shipments')
        .update({ payment_status: 'Approved' })
        .eq('id', shipment.id)
        .eq('payment_status', 'Pending')
        .select('id')
        .maybeSingle();
      if (approvalError) throw approvalError;
      if (!updatedShipment) throw new Error('Payment was already approved or the shipment could not be updated.');

      const { error: timelineError } = await supabase.from('shipment_timeline').insert([{
        shipment_id: shipment.id,
        status_dropdown: 'Finance Approved',
        status_notes: 'Payment confirmed.',
        updated_by_role: userRole,
        action_by_name: actionBy,
      }]);
      if (timelineError) {
        toast.error('Payment was approved, but its timeline entry could not be saved. Contact an administrator.');
        await fetchData();
        return;
      }

      const messages = [
        {
          role_target: 'Freight',
          title: 'Action Needed: Book Shipment',
          message: `Finance (${actionBy}) approved AWB ${shipment.awb_number}. Please book space.`,
          shipment_awb: shipment.awb_number,
        },
        {
          role_target: 'Customer Service',
          title: 'Payment Approved',
          message: `Finance (${actionBy}) approved AWB ${shipment.awb_number}. Awaiting Freight booking.`,
          shipment_awb: shipment.awb_number,
        },
      ];
      const { error: notificationError } = await supabase.from('notifications').insert(messages);
      if (notificationError) toast.warning('Payment approved, but team notifications could not be created.');

      setActionBy('');
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve payment.');
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading...</div>;
  if (!shipment) return <div className="p-10 text-center text-red-500 font-bold">Shipment not found.</div>;

  const canEditOrDelete = userRole === 'Super Admin' || userRole === 'Customer Service';
  const canSeeFinancials = userRole === 'Super Admin' || userRole === 'Customer Service' || userRole === 'Finance' || userRole === 'Freight';
  const canRecordPayment = userRole === 'Super Admin' || userRole === 'Finance';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />
      
      {!isOnline && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-md flex items-center gap-3 shadow-sm">
          <WifiOff size={20} /> <p className="font-medium text-sm">You are offline. Changes will sync when connection returns.</p>
        </div>
      )}

      {/* HEADER */}
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

          {/* FINANCIAL LEDGER */}
          {canSeeFinancials && !isEditing && (
            <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><DollarSign size={20} className="text-emerald-500"/> Financial Ledger</h2>
                {canRecordPayment && (
                  <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md">
                    <Plus size={16} /> Record Payment
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Agreed Amount</p>
                  <p className="text-lg font-extrabold text-slate-900">{shipment.currency} {agreedAmount.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Total Paid</p>
                  <p className="text-lg font-extrabold text-emerald-700">{shipment.currency} {totalPaid.toLocaleString()}</p>
                </div>
                <div className={`p-4 rounded-xl border ${balance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs font-bold uppercase mb-1 ${balance > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Outstanding</p>
                  <p className={`text-lg font-extrabold ${balance > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{shipment.currency} {balance.toLocaleString()}</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-800 mb-3">Payment History</h3>
              <div className="space-y-2">
                {payments.length === 0 && <p className="text-sm text-slate-500 italic">No payments recorded yet.</p>}
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.currency} {parseFloat(p.amount).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{p.payment_method} • Ref: {p.reference || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-600">{new Date(p.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-400">By: {p.recorded_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

                {/* RFS SPECIFIC ACTIONS */}
                {userRole === 'RFS' && shipment.current_status === 'Booked' && (
                  <div className="mb-6 p-4 bg-white border border-blue-200 rounded-xl shadow-sm">
                    <p className="text-blue-700 font-bold mb-3 flex items-center gap-2"><Plane size={18}/> Shipment Ready for Pickup</p>
                    <div className="flex flex-col gap-2">
                       <button onClick={() => handleUpdateStatus('Picked Up', 'Picked up by RFS')} disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 w-full">Confirm Pickup</button>
                    </div>
                  </div>
                )}

                {userRole === 'RFS' && shipment.current_status === 'Picked Up' && (
                  <div className="mb-6 p-4 bg-white border border-purple-200 rounded-xl shadow-sm">
                    <p className="text-purple-700 font-bold mb-3 flex items-center gap-2"><Anchor size={18}/> Routing Decision</p>
                    <p className="text-xs text-slate-500 mb-3">Did you deliver this locally or are you handing it to Operations for export?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStatus('Delivered', 'Delivered locally by RFS') disabled={isSubmitting} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 w-1/2">Delivered (Local)</button>
                      <button onClick={() => handleUpdateStatus('Handed to Ops', 'Handed to Ops for export') disabled={isSubmitting} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 w-1/2">Handover to Ops</button>
                    </div>
                  </div>
                )}

                {/* OPS SPECIFIC ACTIONS */}
                {userRole === 'Operations' && (shipment.current_status === 'Handed to Ops' || shipment.current_status === 'Export Cleared') && (
                  <div className="mb-6 p-4 bg-white border border-amber-200 rounded-xl shadow-sm">
                    <p className="text-amber-700 font-bold mb-3 flex items-center gap-2"><Plane size={18}/> Operations Processing</p>
                    <div className="flex flex-col gap-2">
                      {shipment.current_status === 'Handed to Ops' && (
                        <button onClick={() => handleUpdateStatus('Export Cleared', 'Customs/Export formalities cleared') disabled={isSubmitting} className="bg-amber-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-amber-700 w-full">Mark Export Cleared</button>
                      )}
                      <button onClick={() => handleUpdateStatus('Handed to Airline', 'Handed over to Airline') disabled={isSubmitting} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 w-full">Handover to Airline</button>
                    </div>
                  </div>
                )}

                {/* FALLBACK / ADMIN ACTION PANEL */}
                {userRole === 'Super Admin' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Manual Override Status</label>
                      <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-sm">
                        <option value="">Select Status...</option>
                        <option value="Registered">Registered</option>
                        <option value="Booked">Booked</option>
                        <option value="Picked Up">Picked Up</option>
                        <option value="Handed to Ops">Handed to Ops</option>
                        <option value="Export Cleared">Export Cleared</option>
                        <option value="Handed to Airline">Handed to Airline</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Additional Notes</label>
                      <input type="text" placeholder="Optional details..." value={statusNotes} onChange={e => setStatusNotes(e.target.value)} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <button onClick={handleUpdateStatus} disabled={isSubmitting} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md">
                        {isSubmitting ? 'Updating...' : 'Force Update Status'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Paperclip size={20} className="text-indigo-500"/> Documents & Attachments</h2>
                
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl border-dashed flex flex-col items-center justify-center text-center">
                  <Upload className="text-slate-400 mb-2" size={32} />
                  <p className="text-sm text-slate-600 font-medium mb-2">Upload proof of pickup, customs forms, or invoices.</p>
                  <input type="file" id="file-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handleFileUpload} disabled={uploading} />
                  <label htmlFor="file-upload" className={`cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-slate-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? 'Uploading...' : 'Select File to Upload'}
                  </label>
                </div>

                <div className="space-y-3">
                  {documents.length === 0 && <p className="text-slate-500 text-sm italic">No documents uploaded yet.</p>}
                  {documents.map((doc) => (
                    <button key={doc.id} type="button" onClick={() => handleOpenDocument(doc)} className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors group text-left">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={20} /></div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">{doc.file_name}</p>
                          <p className="text-xs text-slate-500">Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600">Open</span>
                    </button>
                  ))}
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

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount Paid ({shipment.currency})</label>
                <input type="number" step="0.01" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 font-bold" placeholder={`Max: ${balance}`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 bg-white">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="POS">POS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transaction Reference</label>
                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="Optional e.g. GTB-12345" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recorded By (Your Name)</label>
                <input type="text" required value={actionBy} onChange={e => setActionBy(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="e.g. Jane Doe" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 mt-2">
                {isSubmitting ? 'Processing...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}