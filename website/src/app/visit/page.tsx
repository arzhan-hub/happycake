import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ASSET_BASE, BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Visit",
  description:
    "HappyCake is in Sugar Land, Texas. Hours, address, parking, pickup, and delivery details for the neighbourhood shop.",
};

export default function VisitPage() {
  return (
    <main>
      <header className="border-b border-happy-blue-900/15 bg-cream-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
            ◆ Visit the shop
          </p>
          <h1 className="mt-3 font-display text-5xl text-happy-blue-900">
            We&apos;re on Kensington Drive.
          </h1>
          <p className="mt-4 max-w-xl text-text-primary/80">
            A neighbourhood place that competes with the kitchen, not the
            bakery across town. Walk in for a slice or pick up a whole cake
            on your way home.
          </p>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-200">
          <Image
            src={`${ASSET_BASE}/hero/happy-cake-hero-01.webp`}
            alt="The HappyCake counter in Sugar Land"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
              ◆ Address
            </p>
            <address className="mt-3 not-italic text-lg leading-relaxed text-text-primary">
              {BRAND.address.street}
              <br />
              {BRAND.address.city}, {BRAND.address.region}{" "}
              {BRAND.address.postalCode}
            </address>
            <Link
              href={BRAND.social.google}
              className="mt-3 inline-flex text-sm font-medium text-happy-blue-700 hover:text-happy-blue-500"
            >
              Open in Google Maps →
            </Link>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
              ◆ Hours
            </p>
            <ul className="mt-3 space-y-1 text-base text-text-primary">
              {BRAND.hours.map((row) => (
                <li key={row.day} className="flex justify-between border-b border-happy-blue-900/10 py-2">
                  <span>{row.day}</span>
                  <span className="text-text-primary/70">
                    {row.open} – {row.close}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
              ◆ Reach us
            </p>
            <ul className="mt-3 space-y-2 text-base">
              <li>
                Phone:{" "}
                <a
                  href={`tel:${BRAND.phoneE164}`}
                  className="text-happy-blue-700 hover:underline"
                >
                  {BRAND.phoneDisplay}
                </a>
              </li>
              <li>
                WhatsApp:{" "}
                <a
                  href={BRAND.whatsappLink}
                  className="text-happy-blue-700 hover:underline"
                >
                  Send a message
                </a>
              </li>
              <li>
                Email:{" "}
                <a
                  href={`mailto:${BRAND.email}`}
                  className="text-happy-blue-700 hover:underline"
                >
                  {BRAND.email}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-cream-100">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            {
              t: "Pickup",
              b: "Free at the shop. We hold your cake at the counter from your chosen time. Late pickup is fine — message us.",
            },
            {
              t: "Local delivery",
              b: "Within ten miles of Sugar Land. $12 flat. Same-day delivery is possible for slices and the office box.",
            },
            {
              t: "Parking",
              b: "Free lot in front of the building. Curbside pickup on request — pull up and call from the car.",
            },
          ].map((row) => (
            <article key={row.t} className="rounded-2xl border border-happy-blue-900/15 bg-cream-50 p-6">
              <h2 className="font-display text-2xl text-happy-blue-900">
                {row.t}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-primary/80">
                {row.b}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
