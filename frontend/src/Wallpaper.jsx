// Decorative sky wallpaper behind the glass cards (Liquid Glass design).
// Lives in its own module so App.jsx stays lean. wallpaperImage.js snapshots
// these layers (plus their index.css rules) live, so design edits here reach
// the refraction surfaces automatically.
export default function Wallpaper() {
  return (
    <>
      <div className="wallpaper" />
      <svg className="ribbons" viewBox="0 0 820 980" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ribbonA" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#edf8ff" />
            <stop offset=".28" stopColor="#7fc7e8" />
            <stop offset=".62" stopColor="#095fe0" />
            <stop offset="1" stopColor="#04166f" />
          </linearGradient>
          <linearGradient id="ribbonB" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f7f4d6" stopOpacity=".9" />
            <stop offset=".52" stopColor="#2f9cdc" stopOpacity=".88" />
            <stop offset="1" stopColor="#0630b8" stopOpacity=".82" />
          </linearGradient>
          <filter id="softGlass" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
        </defs>
        <path d="M-76 398C104 250 202 183 346 244c118 50 169 163 298 150 94-10 145-84 227-172v162c-112 101-225 149-352 85-141-72-198-128-328-52C91 476 9 563-76 626Z" fill="url(#ribbonA)" opacity=".92" />
        <path d="M-104 538C76 426 208 376 370 431c138 47 208 148 338 109 80-24 120-86 188-157v224c-99 70-210 115-336 65-174-69-251-104-381-25C74 711-3 778-104 817Z" fill="url(#ribbonB)" opacity=".88" filter="url(#softGlass)" />
        <path d="M-48 354C150 244 291 185 437 196c142 11 210 78 338 6" fill="none" stroke="#f8fbef" strokeOpacity=".65" strokeWidth="5" />
        <path d="M-54 708C96 601 217 538 363 551c128 12 222 96 393 12" fill="none" stroke="#eaf8ff" strokeOpacity=".34" strokeWidth="4" />
        <path d="M196 94c110 52 178 132 181 244 3 105-62 180-162 219" fill="none" stroke="#0444bd" strokeOpacity=".44" strokeWidth="18" />
      </svg>
      <div className="grain" />
      <div className="glow" />
    </>
  )
}
