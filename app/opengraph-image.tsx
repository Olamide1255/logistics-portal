import { ImageResponse } from 'next/og';

export const alt = 'LogiFlow — logistics operations in one connected workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '66px 76px', background: 'linear-gradient(135deg, #0f172a 0%, #172554 58%, #312e81 100%)', color: 'white', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 58, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 18, background: '#4f46e5', fontSize: 32, fontWeight: 800 }}>L</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>LogiFlow</div>
          <div style={{ marginLeft: 8, padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(199,210,254,.35)', color: '#c7d2fe', fontSize: 16 }}>LOGISTICS OPERATIONS</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 970 }}>
          <div style={{ fontSize: 64, lineHeight: 1.08, fontWeight: 800, letterSpacing: -2 }}>Every shipment.</div>
          <div style={{ fontSize: 64, lineHeight: 1.08, fontWeight: 800, letterSpacing: -2, color: '#a5b4fc' }}>One connected workspace.</div>
          <div style={{ marginTop: 28, fontSize: 25, lineHeight: 1.4, color: '#dbeafe' }}>Bring teams, handovers, documents and financial operations together.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: 22, fontSize: 18, color: '#cbd5e1' }}>
          <span>Built for freight forwarders and clearing teams</span>
          <span>logistics-portal-ten.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
