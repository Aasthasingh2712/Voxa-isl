import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display, Inter, Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import './embed-theme.css'

// Self-hosted at build time by next/font; the stylesheets reference these
// variables wherever they previously named the families directly.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dm-serif', display: 'swap' })

// Voxa fonts, used only in embed mode (see embed-theme.css).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap', preload: false })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap', preload: false })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false })

export const metadata: Metadata = {
  title: 'Yap & Render — Language, without limits',
  description: 'Yap & Render translates spoken language into Indian Sign Language, making more conversations possible.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f1e9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} ${inter.variable} ${outfit.variable} ${jetbrains.variable} bg-background`} suppressHydrationWarning>
      <head>
        {/* Embed mode: ?embed=text (avatar only) or ?embed=sign (camera Sign to Text only) - used by the Voxa website. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var m=new URLSearchParams(location.search).get('embed');if(m)document.documentElement.setAttribute('data-embed',m)}catch(e){}" }} />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
