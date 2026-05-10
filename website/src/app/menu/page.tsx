import Image from "next/image";
import Link from "next/link";
import { CATALOG, CATEGORIES, priceUSD } from "@/lib/catalog";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Menu",
  description: "Browse our fresh, hand-baked cakes, slices, and custom orders.",
};

export default function MenuPage() {
  // Generate Product JSON-LD for the whole catalog
  const productsJsonLd = CATALOG.map((product) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.blurb,
    sku: product.slug,
    brand: {
      "@type": "Brand",
      name: BRAND.name,
    },
    offers: {
      "@type": "Offer",
      url: `https://${BRAND.domain}/menu/${product.slug}`,
      priceCurrency: "USD",
      price: (product.priceCents / 100).toFixed(2),
      availability: "https://schema.org/InStock",
    },
  }));

  return (
    <main className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productsJsonLd) }}
      />
      
      <div className="text-center mb-16">
        <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70 mb-4">
          ◆ Our Menu
        </p>
        <h1 className="text-5xl font-display text-happy-blue-900 mb-6">
          Fresh from the Sugar Land kitchen
        </h1>
        <p className="text-lg text-text-primary/80 max-w-2xl mx-auto">
          Every layer baked, filled, and decorated by hand.
        </p>
      </div>

      <div className="space-y-24">
        {CATEGORIES.map((category) => {
          const categoryProducts = CATALOG.filter((p) => p.category === category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <section key={category.id} className="scroll-mt-24" id={category.id}>
              <div className="mb-10 border-b border-happy-blue-900/10 pb-6">
                <h2 className="text-3xl font-display text-happy-blue-900 mb-3">{category.label}</h2>
                <p className="text-text-primary/70">{category.blurb}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {categoryProducts.map((product) => (
                  <Link 
                    key={product.slug} 
                    href={`/menu/${product.slug}`}
                    className="group rounded-2xl border border-happy-blue-900/15 bg-cream-50 overflow-hidden flex flex-col transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-cream-200 shrink-0">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-display text-2xl text-happy-blue-900 group-hover:text-happy-blue-700 transition-colors">
                          {product.name}
                        </h3>
                        <span className="font-medium text-happy-blue-900 mt-1 whitespace-nowrap ml-4">
                          {priceUSD(product.priceCents)}
                        </span>
                      </div>
                      
                      <p className="text-[11px] uppercase tracking-[0.16em] text-happy-blue-700/70 mb-3">
                        {product.weight} · {product.serves}
                      </p>
                      
                      <p className="text-sm leading-relaxed text-text-primary/80 mb-6 flex-1">
                        {product.blurb}
                      </p>
                      
                      <div className="mt-auto flex items-center justify-between border-t border-happy-blue-900/10 pt-4">
                        <span className="text-xs font-medium text-happy-blue-700/80">
                          {product.leadTimeHours === 0 ? "Available today" : `${product.leadTimeHours}h notice`}
                        </span>
                        <span className="text-sm font-medium text-happy-blue-700 group-hover:text-happy-blue-500 flex items-center gap-1">
                          View details <span aria-hidden="true">&rarr;</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
