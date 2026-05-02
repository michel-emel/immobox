import "./globals.css";

export const metadata = {
  title:       "IMMOBOX — Immobilier Cameroun",
  description: "Chambres, studios, appartements, hôtels, terrains et commerces — directement chez les propriétaires.",
  keywords:    "immobilier,cameroun,douala,yaounde,location,vente,appartement,maison",
  themeColor:  "#1a5c38",
};

export const viewport = {
  width:          "device-width",
  initialScale:   1,
  maximumScale:   1,
};

// Prevent flash of wrong theme
const DARK_INIT = `(function(){try{var t=localStorage.getItem('immo-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DARK_INIT }} />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
