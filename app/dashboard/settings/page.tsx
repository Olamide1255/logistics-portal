'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Upload, ShieldAlert } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function CompanySettings() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: ''
  });

  useEffect(() => {
    const fetchCompany = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Added is_platform_admin to the query to prevent TS errors
      const { data: profile } = await supabase.from('profiles').select('role, company_id, is_platform_admin').eq('id', user.id).single();
      
      if (profile?.role !== 'Super Admin' && !profile?.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      
      if (profile?.company_id) {
        const { data: compData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
        
        if (compData) {
          setCompany(compData);
          setFormData({
            name: compData.name || '',
            email: compData.email || '',
            phone: compData.phone || '',
            address: compData.address || ''
          });
        }
      }
      
      setLoading(false);
    };
    fetchCompany();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return toast.error("No company data loaded.");
    
    setSaving(true);
    const { error } = await supabase.from('companies').update(formData).eq('id', company.id);
    
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Company settings updated!");
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logos/${company.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('shipment-documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('shipment-documents').getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('companies').update({ logo_url: urlData.publicUrl }).eq('id', company.id);
      if (updateError) throw updateError;

      setCompany({ ...company, logo_url: urlData.publicUrl });
      toast.success("Logo updated successfully!");
    } catch (error: any) {
      toast.error("Error uploading logo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading settings...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldAlert/> Access Denied. Only Company Admins can view this.</div>;
  
  // If authorized but no company record was found
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
            {/* FIXED: Using optional chaining here so it doesn't crash if company is null */}
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Upload className="text-slate-400" size={32} />
            )}
          </div>
          <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
          <label htmlFor="logo-upload" className={`cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-indigo-100 transition-colors ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload Logo'}
          </label>
        </div>

        {/* COMPANY DETAILS FORM */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 font-medium" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="info@company.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="+234..." />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Office Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="123 Logistics Way, Lagos" />
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