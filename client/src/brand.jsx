// LocalSaaS brand: the logo and the illustrations used on the landing, login and sign-up pages.
// All drawn here as plain SVG (no image files), so they stay sharp and load instantly.
// The mobile app uses PNG copies of these, rendered by scripts/render-brand.mjs in the mobile folder.

export const BRAND = { name: 'LocalSaaS', purple: '#5B3DF5' };

// A house with a keyhole: "your place, kept safe"
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3.5 4.5 15.2A3 3 0 0 0 3.3 17.6V33a3.5 3.5 0 0 0 3.5 3.5h26.4a3.5 3.5 0 0 0 3.5-3.5V17.6a3 3 0 0 0-1.2-2.4Z" fill="#5B3DF5" />
      <circle cx="20" cy="19.5" r="5.2" fill="#fff" />
      <path d="M17.6 22.6h4.8l1.4 9.4h-7.6Z" fill="#fff" />
      <circle cx="20" cy="19.5" r="2" fill="#5B3DF5" />
    </svg>
  );
}

export function Logo({ size = 30, className = '' }) {
  return (
    <span className={`brand-logo ${className}`}>
      <LogoMark size={size} />
      <span className="brand-word">Local<b>SaaS</b></span>
    </span>
  );
}

const Tree = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-2.5" y="0" width="5" height="26" rx="2" fill="#8A5A3B" />
    <circle cx="0" cy="-10" r="17" fill="#22C55E" />
    <circle cx="-9" cy="-2" r="11" fill="#16A34A" />
    <circle cx="9" cy="-4" r="12" fill="#2BD46A" />
    <circle cx="2" cy="-22" r="10" fill="#4ADE80" />
  </g>
);

const Window = ({ x, y, w = 22, h = 26, lit = true }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="1.5" fill="#26215C" />
    <rect x={x + 2} y={y + 2} width={w / 2 - 3} height={h - 4} fill={lit ? '#FCD34D' : '#93C5FD'} />
    <rect x={x + w / 2 + 1} y={y + 2} width={w / 2 - 3} height={h - 4} fill={lit ? '#F59E0B' : '#BFDBFE'} />
  </g>
);

const Railing = ({ x, y, w }) => (
  <g stroke="#26215C" strokeWidth="1.6">
    <line x1={x} y1={y} x2={x + w} y2={y} />
    {Array.from({ length: Math.floor(w / 6) + 1 }, (_, i) => (
      <line key={i} x1={x + i * 6} y1={y} x2={x + i * 6} y2={y + 12} />
    ))}
  </g>
);

// The hero: a purple-framed PG building next to a little "₹ collected" card
export function HeroArt({ className = '', title = 'A PG building with a payments summary card' }) {
  return (
    <svg className={className} viewBox="0 0 420 300" role="img" aria-label={title}>
      <circle cx="205" cy="150" r="128" fill="#5B3DF5" opacity="0.1" />
      <circle cx="318" cy="70" r="46" fill="#5B3DF5" opacity="0.07" />
      <ellipse cx="200" cy="268" rx="165" ry="12" fill="#5B3DF5" opacity="0.12" />

      {/* building body with a shaded side */}
      <path d="M150 104h138l14 8v152H150Z" fill="#E7E4F7" />
      <rect x="140" y="104" width="148" height="160" fill="#FFFFFF" />
      <rect x="132" y="96" width="166" height="12" rx="2" fill="#F4F2FD" />
      <rect x="132" y="150" width="160" height="7" fill="#F4F2FD" />
      <rect x="132" y="204" width="160" height="7" fill="#F4F2FD" />

      {/* windows and balconies, three floors */}
      {[114, 166, 218].map((y) => (
        <g key={y}>
          <Window x={168} y={y} w={30} h={30} />
          <Window x={214} y={y} w={30} h={30} lit={y !== 166} />
          <Window x={256} y={y} w={22} h={30} />
        </g>
      ))}
      <Railing x={208} y={136} w={78} />
      <Railing x={208} y={188} w={78} />
      <rect x="214" y="236" width="30" height="28" fill="#26215C" />
      <rect x="217" y="239" width="24" height="25" fill="#FBBF24" />

      {/* the purple frame */}
      <path d="M104 62h44l10 6v196h-54Z" fill="#4328D9" />
      <rect x="96" y="62" width="48" height="202" rx="3" fill="#5B3DF5" />
      <rect x="110" y="92" width="20" height="158" rx="2" fill="#4A2EE6" />
      {[100, 140, 180, 220].map((y) => (
        <rect key={y} x="113" y={y} width="14" height="24" rx="1" fill="#7C66FF" />
      ))}

      {/* steps and plants */}
      <rect x="150" y="262" width="110" height="6" rx="2" fill="#D9D5F0" />
      <Tree x={74} y={236} s={1.15} />
      <Tree x={318} y={240} s={0.95} />
      <circle cx="140" cy="262" r="8" fill="#22C55E" />
      <circle cx="292" cy="262" r="7" fill="#16A34A" />

      {/* payments card */}
      <g transform="translate(286 42)">
        <rect x="4" y="6" width="116" height="122" rx="14" fill="#5B3DF5" opacity="0.12" />
        <rect width="116" height="122" rx="14" fill="#FFFFFF" />
        <circle cx="24" cy="26" r="13" fill="#EDE9FE" />
        <text x="24" y="31.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#26215C" fontFamily="Inter, Arial, sans-serif">₹</text>
        <rect x="44" y="18" width="52" height="6" rx="3" fill="#E4E0F7" />
        <rect x="44" y="30" width="36" height="6" rx="3" fill="#EEEBFB" />
        <rect x="14" y="52" width="88" height="6" rx="3" fill="#EEEBFB" />
        <rect x="14" y="64" width="60" height="6" rx="3" fill="#EEEBFB" />
        <rect x="18" y="96" width="14" height="14" rx="3" fill="#C4B8FF" />
        <rect x="40" y="86" width="14" height="24" rx="3" fill="#9D8CFF" />
        <rect x="62" y="78" width="14" height="32" rx="3" fill="#7C66FF" />
        <rect x="84" y="70" width="14" height="40" rx="3" fill="#5B3DF5" />
      </g>
    </svg>
  );
}

// The four business types, each as a small scene on a soft purple cloud
const Cloud = () => (
  <g fill="#5B3DF5" opacity="0.1">
    <circle cx="70" cy="62" r="40" />
    <circle cx="118" cy="56" r="34" />
    <circle cx="150" cy="70" r="26" />
    <rect x="34" y="62" width="140" height="40" rx="20" />
  </g>
);

export function HostelArt() {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <Cloud />
      <ellipse cx="100" cy="112" rx="72" ry="5" fill="#5B3DF5" opacity="0.12" />
      <path d="M86 40h60l7 4v66H86Z" fill="#E7E4F7" />
      <rect x="80" y="40" width="66" height="70" fill="#fff" />
      <rect x="76" y="36" width="76" height="6" rx="1" fill="#F4F2FD" />
      {[48, 72].map((y) => (
        <g key={y}>
          <Window x={92} y={y} w={16} h={16} />
          <Window x={114} y={y} w={16} h={16} />
          <Window x={134} y={y} w={10} h={16} />
        </g>
      ))}
      <Railing x={112} y={60} w={36} />
      <rect x="114" y="94" width="14" height="16" fill="#26215C" />
      <rect x="116" y="96" width="10" height="14" fill="#FBBF24" />
      <rect x="62" y="22" width="22" height="88" rx="2" fill="#5B3DF5" />
      <rect x="69" y="34" width="8" height="70" rx="1" fill="#4A2EE6" />
      <Tree x={46} y={96} s={0.55} />
      <Tree x={164} y={98} s={0.5} />
    </svg>
  );
}

export function TuitionArt() {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <Cloud />
      <ellipse cx="100" cy="112" rx="72" ry="5" fill="#5B3DF5" opacity="0.12" />
      {/* blackboard */}
      <rect x="58" y="14" width="88" height="56" rx="3" fill="#B7793F" />
      <rect x="62" y="18" width="80" height="48" rx="2" fill="#24435A" />
      <rect x="70" y="26" width="28" height="3" rx="1.5" fill="#CFE3EE" opacity="0.8" />
      <rect x="70" y="34" width="40" height="3" rx="1.5" fill="#CFE3EE" opacity="0.6" />
      <rect x="70" y="42" width="20" height="3" rx="1.5" fill="#CFE3EE" opacity="0.6" />
      <circle cx="124" cy="40" r="9" fill="none" stroke="#CFE3EE" strokeWidth="2.5" opacity="0.7" />
      {/* desk with a laptop */}
      <rect x="52" y="84" width="100" height="7" rx="2" fill="#C98A4B" />
      <rect x="58" y="91" width="6" height="21" fill="#A8703C" />
      <rect x="140" y="91" width="6" height="21" fill="#A8703C" />
      <rect x="64" y="91" width="34" height="16" rx="2" fill="#B7793F" />
      <rect x="92" y="70" width="28" height="15" rx="2" fill="#5B3DF5" />
      <rect x="86" y="84" width="40" height="3" rx="1.5" fill="#4328D9" />
      {/* plant and chair */}
      <rect x="34" y="96" width="12" height="16" rx="2" fill="#A8703C" />
      <ellipse cx="40" cy="84" rx="7" ry="14" fill="#22C55E" />
      <ellipse cx="33" cy="90" rx="5" ry="9" fill="#16A34A" />
      <rect x="158" y="86" width="16" height="4" rx="2" fill="#4A5568" />
      <rect x="164" y="90" width="3" height="22" fill="#4A5568" />
      <ellipse cx="170" cy="74" rx="6" ry="13" fill="#4ADE80" />
    </svg>
  );
}

export function GymArt() {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <Cloud />
      <ellipse cx="100" cy="110" rx="70" ry="6" fill="#5B3DF5" opacity="0.14" />
      <g transform="rotate(-18 100 70)">
        <rect x="58" y="64" width="84" height="12" rx="6" fill="#C9C3E8" />
        <rect x="58" y="64" width="84" height="5" rx="2.5" fill="#E4E0F7" />
        {/* plates, each with a lit edge */}
        <rect x="40" y="38" width="20" height="64" rx="9" fill="#3D27B8" />
        <rect x="44" y="38" width="16" height="64" rx="8" fill="#5B3DF5" />
        <rect x="26" y="46" width="18" height="48" rx="8" fill="#3D27B8" />
        <rect x="29" y="46" width="15" height="48" rx="7.5" fill="#4A2EE6" />
        <rect x="140" y="38" width="20" height="64" rx="9" fill="#3D27B8" />
        <rect x="140" y="38" width="16" height="64" rx="8" fill="#5B3DF5" />
        <rect x="156" y="46" width="18" height="48" rx="8" fill="#3D27B8" />
        <rect x="156" y="46" width="15" height="48" rx="7.5" fill="#4A2EE6" />
        <rect x="48" y="44" width="4" height="40" rx="2" fill="#9D8CFF" opacity="0.7" />
        <rect x="148" y="44" width="4" height="40" rx="2" fill="#9D8CFF" opacity="0.7" />
      </g>
    </svg>
  );
}

export function MessArt() {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true">
      <Cloud />
      <ellipse cx="100" cy="112" rx="64" ry="5" fill="#5B3DF5" opacity="0.14" />
      {/* steam */}
      <g fill="none" stroke="#9D8CFF" strokeWidth="3" strokeLinecap="round" opacity="0.7">
        <path d="M88 20c-6 6 6 10 0 16" />
        <path d="M100 14c-6 6 6 10 0 16" />
        <path d="M112 20c-6 6 6 10 0 16" />
      </g>
      {/* a three-tier tiffin */}
      <path d="M78 40h44v8H78Z" fill="#4328D9" />
      <rect x="92" y="32" width="16" height="8" rx="3" fill="#5B3DF5" />
      {[48, 68, 88].map((y, i) => (
        <g key={y}>
          <rect x="72" y={y} width="56" height="18" rx="5" fill={i === 1 ? '#7C66FF' : '#5B3DF5'} />
          <rect x="72" y={y} width="56" height="5" rx="2.5" fill="#fff" opacity="0.25" />
          <rect x="70" y={y + 16} width="60" height="3" rx="1.5" fill="#3D27B8" />
        </g>
      ))}
      <path d="M68 52v42M132 52v42" stroke="#C9C3E8" strokeWidth="3" strokeLinecap="round" />
      <rect x="42" y="98" width="22" height="12" rx="6" fill="#F59E0B" />
      <circle cx="154" cy="104" r="8" fill="#22C55E" />
    </svg>
  );
}

export const TYPE_ART = { hostel: HostelArt, tuition: TuitionArt, gym: GymArt, mess: MessArt };

// The four business types in the order the sign-up shows them
export const TYPES = [
  { key: 'hostel', title: 'PG & hostels', blurb: 'Rooms, beds, tenants and rent' },
  { key: 'tuition', title: 'Tuition & coaching', blurb: 'Batches, students and fees' },
  { key: 'gym', title: 'Gyms', blurb: 'Members, plans and attendance' },
  { key: 'mess', title: 'Mess & tiffin', blurb: 'Meal plans and monthly dues' },
];
