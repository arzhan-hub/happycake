// Brand constants — used by metadata, footer, JSON-LD, llms.txt, etc.
// Source of truth: HCU_BRANDBOOK.md.

export const BRAND = {
  name: "HappyCake",
  tagline: "The original taste of happiness.",
  shortPitch: "Hand-baked cakes from our Sugar Land kitchen. It's just like homemade.",
  city: "Sugar Land, Texas",
  domain: "happycake.us",
  email: "hello@happycake.us",
  phoneDisplay: "(281) 555-0142",
  phoneE164: "+12815550142",
  whatsappLink: "https://wa.me/12815550142",
  address: {
    street: "16110 Kensington Dr, Suite 600",
    city: "Sugar Land",
    region: "TX",
    postalCode: "77479",
    country: "US",
  },
  hours: [
    { day: "Mon–Fri", open: "9:00 AM", close: "7:00 PM" },
    { day: "Saturday", open: "10:00 AM", close: "7:00 PM" },
    { day: "Sunday", open: "11:00 AM", close: "5:00 PM" },
  ],
  social: {
    instagram: "https://instagram.com/happycake.us",
    google: "https://maps.google.com/?q=HappyCake+Sugar+Land",
  },
  closingLine:
    "Order on the site at happycake.us or send a message on WhatsApp.",
} as const;


export const ASSET_BASE = "/hackathon-assets/happy-cake";
