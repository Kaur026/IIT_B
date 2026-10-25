import React from 'react';

export const GrowthMonitoringIllustration: React.FC = () => (
  <div className="welcome-growth-scene relative aspect-[4/5] overflow-hidden">
    <svg
      viewBox="0 0 400 500"
      role="img"
      aria-labelledby="growth-scene-title growth-scene-description"
      className="absolute inset-0 h-full w-full"
    >
      <title id="growth-scene-title">Nourishing every child</title>
      <desc id="growth-scene-description">An Anganwadi worker records a child’s height beside a growth measurement chart.</desc>
      <defs>
        <linearGradient id="growth-scene-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF2F6" />
          <stop offset="100%" stopColor="#D6E4EC" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="364" height="464" rx="24" fill="url(#growth-scene-bg)" />
      <text x="194" y="42" textAnchor="middle" fill="#172B4D" fontSize="9" fontWeight="700" letterSpacing="1.1">NOURISHING EVERY CHILD</text>
      <text x="194" y="56" textAnchor="middle" fill="#2457F5" fontSize="8" fontWeight="500">Nutrition, care and follow-up</text>
      <path d="M19 350h362v108a24 24 0 0 1-24 24H43a24 24 0 0 1-24-24z" fill="#E8D9C7" />
      <rect x="270" y="56" width="74" height="92" rx="12" fill="#FFFFFF" fillOpacity=".68" />
      <path d="M307 56v92m-37-46h74" stroke="#D4E3E7" strokeWidth="5" />
      <path d="M265 57q16 8 16 20v68h-12V77q0-10-8-15zm80 0q-16 8-16 20v68h12V77q0-10 8-15z" fill="#C6A987" fillOpacity=".75" />
      <path d="M123 120h112v9H123z" fill="#9C7755" />
      <path d="M132 130v40m94-40v40" stroke="#9C7755" strokeWidth="5" />
      <rect x="143" y="91" width="24" height="27" rx="5" fill="#D6B889" />
      <path d="M155 91q-1-18 10-23m-8 23q-14-16-23-10m23 10q4-16 16-17" fill="none" stroke="#6A8A6D" strokeWidth="4" strokeLinecap="round" />
      <path d="M189 111q10-12 20 0v7h-20z" fill="#C97F54" />
      <ellipse cx="199" cy="109" rx="13" ry="5" fill="#E7BF85" />

      {/* Wall-mounted height chart */}
      <rect x="48" y="112" width="58" height="254" rx="12" fill="#FFFDF8" stroke="#D5DED2" strokeWidth="2" />
      <text x="77" y="99" textAnchor="middle" fill="#293F59" fontSize="9" fontWeight="700" letterSpacing=".8">HEIGHT</text>
      <path d="M91 136v203" stroke="#477F9B" strokeWidth="5" strokeLinecap="round" />
      <path d="M77 154h14m-9 22h9m-14 22h14m-9 22h9m-14 22h14m-9 22h9m-14 22h14m-9 22h9" stroke="#63857D" strokeWidth="2" strokeLinecap="round" />
      <text x="59" y="158" fill="#71847E" fontSize="8">100</text>
      <text x="59" y="224" fill="#71847E" fontSize="8">80</text>
      <text x="59" y="290" fill="#71847E" fontSize="8">60</text>

      {/* Child */}
      <path d="M166 327l-4 54h17l10-49m5-5 7 54h17l-3-55" fill="#375B78" />
      <path d="M163 274q25-15 51 0l5 57q-31 12-61 0z" fill="#E8A45D" />
      <path d="M168 281l-18 29m57-29 14 22" stroke="#D69A5B" strokeWidth="9" strokeLinecap="round" />
      <circle cx="187" cy="238" r="24" fill="#B97850" />
      <path d="M164 236q1-28 25-27 20 1 23 23l-8-8-6 1-5-7-11 8-14 1z" fill="#263B42" />
      <circle cx="179" cy="240" r="2" fill="#263238" />
      <circle cx="195" cy="240" r="2" fill="#263238" />
      <path d="M181 250q6 5 12 0" fill="none" stroke="#7D4436" strokeWidth="2" strokeLinecap="round" />

      {/* Anganwadi worker with a record board */}
      <path d="M281 287l-7 95h20l13-71 12 71h20l-13-98" fill="#315A68" />
      <path d="M277 196q28-16 55 2l11 94q-36 17-74 0z" fill="#477F9B" />
      <path d="M280 205l-20 40m63-42 9 37" stroke="#B97850" strokeWidth="11" strokeLinecap="round" />
      <circle cx="304" cy="164" r="27" fill="#B97850" />
      <path d="M277 164q1-33 29-34 26 2 27 34l-9-10-7 1-8-10-12 12-18 1z" fill="#263B42" />
      <circle cx="295" cy="166" r="2" fill="#263238" />
      <circle cx="312" cy="166" r="2" fill="#263238" />
      <path d="M298 177q6 4 12 0" fill="none" stroke="#7D4436" strokeWidth="2" strokeLinecap="round" />
      <rect x="326" y="228" width="31" height="41" rx="4" fill="#FFFDF8" stroke="#C7D9D0" strokeWidth="2" transform="rotate(8 326 228)" />
      <path d="M333 239l15 2m-14 6 13 2m-14 6 8 1" stroke="#477F9B" strokeWidth="2" strokeLinecap="round" />

      {/* A small bowl of fruit adds a nutrition cue without crowding the scene. */}
      <ellipse cx="246" cy="365" rx="21" ry="5" fill="#FFFFFF" stroke="#172B4D" strokeWidth="1.5" />
      <path d="M227 365q3 15 19 15t19-15" fill="#FFFFFF" stroke="#172B4D" strokeWidth="1.5" />
      <circle cx="237" cy="358" r="5" fill="#2457F5" />
      <circle cx="248" cy="356" r="5" fill="#C9DCCF" stroke="#477F9B" strokeWidth="1" />
      <path d="M255 360q-1-9 6-10 1 7-6 10z" fill="#C9DCCF" stroke="#477F9B" strokeWidth="1" />

      {/* Height guide animates from the chart toward the child */}
      <path className="growth-guide" d="M96 214h69" fill="none" stroke="#477F9B" strokeWidth="3" strokeDasharray="76" strokeDashoffset="76" strokeLinecap="round" />
      <circle className="growth-marker" cx="165" cy="214" r="5" fill="#477F9B" />
      <path d="M47 383h306" stroke="#D5C6AE" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>
);
