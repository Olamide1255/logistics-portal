'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Upload, ShieldAlert, Bell, Volume2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function CompanySettings() {
  const [company, setCompany] = useState<any>(null);
  const [profileId, setProfileId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '',
    sound_alerts: true, push_notifications: true
  });

  useEffect(() => {
    const fetchCompany = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setProfileId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id, is_platform_admin, sound_alerts, push_notifications')
        .eq('id', user.id)
        .single();
      
      if (profile?.role !== 'Super Admin' && !profile?.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      
      if (profile?.company_id) {
        const { data: compData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
        
        if (compData) {
          let displayLogo = '/icon-192.png';
          if (compData.logo_url) {
            if (compData.logo_url.startsWith('http')) {
              displayLogo = compData.logo_url;
            } else {
              const { data: signedData } = await supabase.storage.from('shipment-documents').createSignedUrl(compData.logo_url, 3600);
              if (signedData?.signedUrl) displayLogo = signedData.signedUrl;
            }
          }

          setCompany({ ...compData, logo_url: displayLogo, logo_path: compData.logo_url?.startsWith('http') ? null : compData.logo_url || null });
          setFormData({
            name: compData.name || '',
            email: compData.email || '',
            phone: compData.phone || '',
            address: compData.address || '',
            sound_alerts: profile.sound_alerts !== false,
            push_notifications: profile.push_notifications !== false
          });
        }
      }
      
      setLoading(false);
    };
    fetchCompany();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return toast.error("No company data loaded.");
    
    setSaving(true);
    
    // 1. Update Company Info
    const { error: compError } = await supabase.from('companies').update({
      name: formData.name, 
      email: formData.email, 
      phone: formData.phone, 
      address: formData.address
    }).eq('id', company.id);
    
    // 2. Update User Preferences
    const { error: profError } = await supabase.from('profiles').update({
      sound_alerts: formData.sound_alerts,
      push_notifications: formData.push_notifications
    }).eq('id', profileId);
    
    if (compError || profError) {
      toast.error("Failed to save: " + (compError?.message || profError?.message));
    } else {
      toast.success("Settings updated successfully!");
    }
    
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Logo must be a PNG or JPEG image.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Logo must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      const fileExt = file.type === 'image/png' ? 'png' : 'jpg';
      const filePath = `${company.id}/company-logo/logo-${crypto.randomUUID()}.${fileExt}`;
      uploadedPath = filePath;

      const { error: uploadError } = await supabase.storage.from('shipment-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedUrlError } = await supabase.storage
        .from('shipment-documents')
        .createSignedUrl(filePath, 3600);
      if (signedUrlError || !signedData?.signedUrl) {
        throw signedUrlError || new Error('The new logo could not be previewed securely.');
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: filePath })
        .eq('id', company.id);
      if (updateError) throw updateError;

      const previousPath = typeof company.logo_path === 'string' ? company.logo_path : null;
      setCompany({ ...company, logo_url: signedData.signedUrl, logo_path: filePath });
      uploadedPath = null;
      toast.success('Company logo updated successfully.');

      if (previousPath && previousPath !== filePath && !previousPath.startsWith('http')) {
        const { error: cleanupError } = await supabase.storage.from('shipment-documents').remove([previousPath]);
        if (cleanupError) toast.warning('Logo updated, but the previous logo file could not be cleaned up.');
      }
    } catch (error: unknown) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('shipment-documents').remove([uploadedPath]);
        if (cleanupError) console.error('Temporary company logo cleanup failed:', cleanupError);
      }
      toast.error(error instanceof Error ? error.message : 'Unable to upload the company logo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading settings...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldAlert/> Access Denied. Only Company Admins can view this.</div>;
  
  if (!company) return <div className="p-10 text-center text-amber-500 font-bold">No company record found for this account. Please contact the platform administrator.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="text-indigo-600" size={32} /> Company Settings
        </h1>
        <p className="text-slate-500 mt-1 font-medium">Manage your brand identity and contact information.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LOGO UPLOAD */}
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 h-fit flex flex-col items-center text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Company Logo</h2>
          <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden mb-4 relative group">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Upload className="text-slate-400" size={32} />
            )}
          </div>
          <input type="file" id="logo-upload" className="hidden" accept="image/png,image/jpeg" onChange={handleLogoUpload} disabled={uploading} />
          <label htmlFor="logo-upload" className={`cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-indigo-100 transition-colors ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload Logo'}
          </label>
        </div>

        {/* COMPANY DETAILS & PREFERENCES FORM */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="company-name" className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
              <input type="text" id="company-name" name="name" value={formData.name} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 font-medium" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="company-email" className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Email</label>
                <input type="email" id="company-email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="info@company.com" />
              </div>
              <div>
                <label htmlFor="company-phone" className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input type="text" id="company-phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="+234..." />
              </div>
            </div>
            <div>
              <label htmlFor="company-address" className="block text-xs font-bold text-slate-500 uppercase mb-1">Office Address</label>
              <input type="text" id="company-address" name="address" value={formData.address} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="123 Logistics Way, Lagos" />
            </div>
            
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Bell size={16}/> Notification Preferences</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="sound_alerts" checked={formData.sound_alerts} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2"><Volume2 size={14}/> Play sound for new alerts</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="push_notifications" checked={formData.push_notifications} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Receive background push notifications</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md">
                <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}