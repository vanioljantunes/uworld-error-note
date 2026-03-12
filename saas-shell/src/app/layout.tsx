import type { Metadata } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono, Fira_Code } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-fira-code', display: 'swap' })

export const metadata: Metadata = {
  title: 'GapStrike — Master Your Mistakes',
  description: 'GapStrike transforms every incorrect answer into structured, permanent knowledge.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${firaCode.variable}`}>{children}</body>
    </html>
  )
}
