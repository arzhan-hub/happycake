import type { Metadata } from "next";
import Image from "next/image";
import { ASSET_BASE, BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description:
    "HappyCake is a neighbourhood bakery in Sugar Land, Texas. Hand-baked classics, the same recipes since the day we opened.",
};

export default function AboutPage() {
  return (
    <main>
      <header className="border-b border-happy-blue-900/15 bg-cream-100">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
            ◆ About HappyCake
          </p>
          <h1 className="mt-3 font-display text-5xl text-happy-blue-900">
            It started with a phrase.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-text-primary/85">
            <em>It&apos;s just like homemade.</em> People kept saying it after
            the first bite. We realised that homemade taste was the centre of
            what we wanted to make — and we&apos;ve been making it ever since.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="prose-lg max-w-none space-y-6 text-text-primary/85">
          <p>
            Every ingredient is carefully selected. Every cake is hand-decorated
            and hand-packed. Every recipe was perfected over years until it
            earned its name.
          </p>
          <p>
            When customers choose our cakes for the moments that matter —
            birthdays, anniversaries, the quiet week-night dinner — our hearts
            cheer and sink at once. That mix of pride and responsibility is what
            keeps us improving every day.
          </p>
          <p>
            We love watching people be happy. We love making delicious things.
            The combination is HappyCake.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream-200">
            <Image
              src={`${ASSET_BASE}/hero/happy-cake-hero-02.webp`}
              alt="Behind the counter at HappyCake"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream-200">
            <Image
              src={`${ASSET_BASE}/hero/happy-cake-hero-04.webp`}
              alt="A whole honey cake on the counter"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-happy-blue-900 text-cream-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cream-200/70">
            ◆ What we believe
          </p>
          <h2 className="mt-3 font-display text-4xl">
            What we&apos;re not, and what we are.
          </h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              {
                k: "Not a candy store.",
                v: "We sell traditional, time-tested cakes — the kind handed down through families.",
              },
              {
                k: "Not custom-only.",
                v: "Decoration is a small, optional service. The offering is the ready-made line — proven recipes, instant availability.",
              },
              {
                k: "Not exclusive.",
                v: "HappyCake is for families who care about substance over presentation. The cake is for dinner, not the feed.",
              },
              {
                k: "Enthusiastic professionals.",
                v: "Everyone at HappyCake actually loves HappyCake cakes. It shows up in every detail.",
              },
            ].map((row) => (
              <div key={row.k}>
                <dt className="font-display text-2xl text-cream-50">{row.k}</dt>
                <dd className="mt-2 text-cream-200/85">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="font-display text-3xl text-happy-blue-900">
          {BRAND.tagline}
        </p>
        <p className="mt-4 text-text-primary/80">{BRAND.closingLine}</p>
      </section>
    </main>
  );
}
