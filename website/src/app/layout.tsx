import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ChatWidget } from "@/components/ChatWidget";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: {
    default: `HappyCake — ${BRAND.tagline}`,
    template: "%s · HappyCake",
  },
  description: BRAND.shortPitch,
  openGraph: {
    title: `HappyCake — ${BRAND.tagline}`,
    description: BRAND.shortPitch,
    url: `https://${BRAND.domain}`,
    siteName: "HappyCake",
    locale: "en_US",
    type: "website",
  },
  alternates: {
    canonical: `https://${BRAND.domain}`,
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "Bakery",
  name: "HappyCake",
  description: BRAND.shortPitch,
  url: `https://${BRAND.domain}`,
  telephone: BRAND.phoneE164,
  email: BRAND.email,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: BRAND.address.street,
    addressLocality: BRAND.address.city,
    addressRegion: BRAND.address.region,
    postalCode: BRAND.address.postalCode,
    addressCountry: BRAND.address.country,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "19:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "10:00",
      closes: "19:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Sunday",
      opens: "11:00",
      closes: "17:00",
    },
  ],
  sameAs: [BRAND.social.instagram, BRAND.social.google],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="antialiased min-h-screen bg-cream-50 text-text-primary font-body flex flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <ChatWidget />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </body>
    </html>
  );
}
