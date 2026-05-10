import Image from "next/image";
import Link from "next/link";
import { ASSET_BASE, BRAND } from "@/lib/brand";
import { CATALOG, priceUSD } from "@/lib/catalog";

const FEATURED = ["honey", "pistachio-roll", "office-dessert-box"];

export default function Home() {
  const featured = FEATURED.map(
    (slug) => CATALOG.find((c) => c.slug === slug)!
  );

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-happy-blue-900 text-text-on-blue">
        <div className="absolute inset-0 opacity-30">
          <Image
            src={`${ASSET_BASE}/hero/happy-cake-hero-01.webp`}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-happy-blue-900/60 via-happy-blue-900/40 to-happy-blue-900/90" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 py-28 text-center sm:px-6 sm:py-40 lg:px-8">
          <p className="text-xs uppercase tracking-widest text-cream-200/80 mb-2">
            ◆ HappyCake · {BRAND.city}
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl leading-tight tracking-tight sm:text-7xl">
            {BRAND.tagline}
          </h1>
          <p className="mt-8 max-w-xl text-lg text-cream-200/90 leading-relaxed font-light">
            Hand-baked cakes from our Sugar Land kitchen. Every recipe perfected
            over years until it earned its name.
          </p>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/menu"
              className="rounded-full bg-cream-50 px-8 py-4 text-base font-medium text-happy-blue-900 transition-all hover:bg-white hover:scale-105 hover:shadow-lg active:scale-95"
            >
              See today&apos;s bake
            </Link>
            <Link
              href="/order"
              className="rounded-full border border-cream-200/40 px-8 py-4 text-base font-medium text-cream-50 transition-all hover:bg-cream-50/10 hover:border-cream-50 hover:scale-105 active:scale-95"
            >
              Start an order
            </Link>
          </div>
        </div>
      </section>

      {/* Featured cakes */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-12">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
              ◆ The classics
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight text-happy-blue-900">
              On the counter today
            </h2>
            <p className="mt-4 max-w-xl text-text-primary/70 leading-relaxed">
              Recipes handed down through families. The taste your grandmother
              would recognise.
            </p>
          </div>
          <Link
            href="/menu"
            className="text-sm font-medium text-happy-blue-700 hover:text-happy-blue-500 flex items-center gap-1 transition-colors"
          >
            See full menu <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <ul className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {featured.map((cake) => (
            <li
              key={cake.slug}
              className="group rounded-3xl border border-happy-blue-900/10 bg-cream-50 overflow-hidden shadow-sm transition-all duration-500 hover:shadow-xl hover:-translate-y-2"
            >
              <Link href={`/menu/${cake.slug}`} className="block h-full flex flex-col">
                <div className="relative aspect-square overflow-hidden bg-cream-200 shrink-0">
                  <Image
                    src={cake.image}
                    alt={cake.name}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-happy-blue-900/0 transition-colors duration-500 group-hover:bg-happy-blue-900/5"></div>
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-happy-blue-700/70">
                    {cake.weight} · {cake.serves}
                  </p>
                  <h3 className="mt-3 font-display text-3xl text-happy-blue-900 group-hover:text-happy-blue-700 transition-colors">
                    {cake.name}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-text-primary/70 flex-1">
                    {cake.blurb}
                  </p>
                  <div className="mt-8 flex items-center justify-between pt-4 border-t border-happy-blue-900/5">
                    <span className="font-medium text-happy-blue-900 text-lg">
                      {priceUSD(cake.priceCents)}
                    </span>
                    <span className="text-sm font-medium text-happy-blue-700 group-hover:text-happy-blue-500 flex items-center gap-1">
                      Order now <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">&rarr;</span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Story strip */}
      <section className="bg-cream-100 py-24 border-y border-happy-blue-900/5">
        <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-6 md:grid-cols-2 md:items-center lg:px-8">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cream-200 shadow-xl transition-transform hover:scale-[1.02] duration-500">
            <Image
              src={`${ASSET_BASE}/hero/happy-cake-hero-03.webp`}
              alt="The HappyCake kitchen in Sugar Land"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
              ◆ A Tuesday in Sugar Land
            </p>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight text-happy-blue-900">
              It started with a phrase: <br /><em className="font-light">it&apos;s just like homemade.</em>
            </h2>
            <div className="mt-8 space-y-6 text-lg text-text-primary/75 leading-relaxed font-light">
              <p>
                Saule starts the honey biscuit at 6:30. The walnuts are toasted
                in small batches. By 9:00 the first cake &quot;Honey&quot; is
                cooling on the rack and the shop opens.
              </p>
              <p>
                Every ingredient is carefully selected. Every cake is
                hand-decorated and hand-packed. No shortcuts. No mixes.
              </p>
            </div>
            <Link
              href="/about"
              className="mt-10 inline-flex items-center gap-2 text-sm uppercase tracking-widest font-medium text-happy-blue-700 hover:text-happy-blue-500 transition-colors"
            >
              Read our story <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Visit / how to order */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              eyebrow: "Walk in",
              title: "Open today",
              body: `Slices are out from 9:00. Whole cakes available with 24 hours' notice.`,
              link: { href: "/visit", label: "Hours and address" },
            },
            {
              eyebrow: "Order online",
              title: "Pickup or delivery",
              body: "Pick a cake from the menu, choose your day, and we'll confirm within the hour during open hours.",
              link: { href: "/order", label: "Start an order" },
            },
            {
              eyebrow: "WhatsApp",
              title: "Talk to us directly",
              body: "Custom dates, dietary questions, or a same-day pickup — message us and a person replies.",
              link: { href: BRAND.whatsappLink, label: "Open WhatsApp" },
            },
          ].map((card) => (
            <article
              key={card.title}
              className="group rounded-3xl border border-happy-blue-900/10 bg-cream-50 p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
                ◆ {card.eyebrow}
              </p>
              <h3 className="mt-4 font-display text-3xl text-happy-blue-900 group-hover:text-happy-blue-700 transition-colors">
                {card.title}
              </h3>
              <p
                className="mt-4 text-sm leading-relaxed text-text-primary/70"
                dangerouslySetInnerHTML={{ __html: card.body }}
              />
              <Link
                href={card.link.href}
                className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-happy-blue-700 hover:text-happy-blue-500"
              >
                {card.link.label} <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Closing band */}
      <section className="border-t border-happy-blue-900/10 bg-cream-100">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <p className="font-display text-4xl text-happy-blue-900 sm:text-5xl tracking-tight">
            The fond-memories cake.
          </p>
          <p className="mt-6 text-lg text-text-primary/70 max-w-2xl mx-auto font-light leading-relaxed">
            {BRAND.closingLine}
          </p>
        </div>
      </section>
    </main>
  );
}
