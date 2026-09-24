type BrandProps={href?:string;className?:string};

export function BrandMark(){
  return <span className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 48 48" role="img">
      <rect x="1" y="1" width="46" height="46" rx="13" fill="currentColor"/>
      <circle cx="13.5" cy="13.5" r="3" className="brand-sun"/>
      <path className="brand-skyline" d="M8 35.5h4.25v-5.25h3V23.5h2.5v-3.25h2.5v3.25h2.5v8.75h3v-4.5c0-4.2 2.35-7.75 5.25-8.85v-2.4h2v2.4c2.9 1.1 5.25 4.65 5.25 8.85v4.5h2.5V25h2.5v10.5H47v4H8v-4Z"/>
      <path className="brand-water" d="M8 42c5-1.55 9.7-1.55 14.1 0 4.45 1.55 9.1 1.55 13.95 0 3.65-1.2 7.3-1.4 10.95-.55"/>
    </svg>
  </span>;
}

export default function Brand({href='/',className=''}:BrandProps){
  return <a className={`brand ${className}`.trim()} href={href} aria-label="Ownly Malta home"><BrandMark/><span className="brand-word">Ownly Malta</span></a>;
}
