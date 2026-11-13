'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Search, Plane, Anchor, Loader2 } from 'lucide-react';

export default function ShipmentsList() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 15;

  // Fetch User Role
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        let role = 'Unknown';
        if (prefix.includes('admin') || prefix.includes('it')) role = 'Super Admin';
        else if (prefix.includes('finance')) role = 'Finance';
        else if (prefix.includes('cs') || prefix.includes('info')) role = 'Customer Service';
        else if (prefix.includes('rfs')) role = 'RFS';
        else if (prefix.includes('ops')) role = 'Operations';
        else if (prefix.includes('freight')) role = 'Freight';
        setUserRole(role);
      }
    };
    getUser();
  }, []);

  // Fetch Data (Server-side search and pagination)
  const fetchShipments = async (currentPage: number, search: string) => {
    setLoading(true);
    
    let query = supabase
      .from('shipments')
      .select(`*, clients!inner (client_name)`)
      .order('created_at', { ascending: false });

    // Apply Search (AWB or Client Name)
    if (search) {
      query = query.or(`awb_number.ilike.%${search}%,clients.client_name.ilike.%${search}%`);
    }

    // Apply Pagination (from -> to)
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error } = await query;
    
    if (data) {
      if (currentPage === 0) {
        setShipments(data);
      } else {
        setShipments((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    if (error) console.error(error);
    setLoading(false);
  };

  // Debounce search input so it doesn't query on every keystroke
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(0);
      fetchShipments(0, searchTerm);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchShipments(nextPage, searchTerm);
  };

  const canCreateShipment = userRole === 'Super Admin' || userRole === 'Customer Service' || userRole === 'Freight';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">All Shipments</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage and track every shipment in the system.</p>
        </div>
        {canCreateShipment && (
          <Link href="/dashboard/register" className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 font-semibold shadow-md shadow-indigo-600/20 transition-all w-full sm:w-auto"><Plus size={18} /> New Shipment</Link>
        )}
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search AWB or Client..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">AWB Number</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Client</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Destination</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {shipments.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No shipments found matching your search.</td></tr>
              )}
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap"><Link href={`/dashboard/shipments/${encodeURIComponent(shipment.awb_number.trim())}`} className="font-bold text-indigo-600 hover:text-indigo-800">{shipment.awb_number}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{shipment.clients?.client_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${shipment.shipment_type === 'Import' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}`}>
                      {shipment.shipment_type === 'Import' ? <Anchor size={12} /> : <Plane size={12} />} {shipment.shipment_type || 'Export'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{shipment.destination}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${shipment.current_status === 'Registered' ? 'bg-blue-50 text-blue-700 ring-blue-200' : shipment.current_status === 'Booked' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : shipment.current_status === 'Finance Approved' ? 'bg-purple-50 text-purple-700 ring-purple-200' : shipment.current_status === 'Handed to Airline' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${shipment.current_status === 'Registered' ? 'bg-blue-500' : shipment.current_status === 'Booked' ? 'bg-indigo-500' : shipment.current_status === 'Finance Approved' ? 'bg-purple-500' : shipment.current_status === 'Handed to Airline' ? 'bg-emerald-500' : 'bg-slate-500'}`}></span> {shipment.current_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><Link href={`/dashboard/shipments/${encodeURIComponent(shipment.awb_number.trim())}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 group-hover:text-indigo-600 transition-colors">View Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION / LOAD MORE */}
        {hasMore && (
          <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50">
            <button onClick={loadMore} disabled={loading} className="flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
              {loading ? <><Loader2 className="animate-spin" size={18} /> Loading...</> : 'Load More Shipments'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}