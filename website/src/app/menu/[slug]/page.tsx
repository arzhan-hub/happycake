import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG, findProduct, priceUSD, categoryLabel } from "@/lib/catalog";
import { BRAND } from "@/lib/brand";

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate static params for all catalog items so Next.js pre-renders them
export function generateStaticParams() {
  return CATALOG.map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = await params;
  const product = findProduct(resolvedParams.slug);
  if (!product) return { title: "Not Found" };
  
  return {
    title: product.name,
    description: product.blurb,
  };
}

export default async function ProductPage({ params }: Props) {
  const resolvedParams = await params;
  const product = findProduct(resolvedParams.slug);
  
  if (!product) {
    notFound();
  }

  // Product JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.gallery,
    description: product.blurb,
    sku: product.squareItemId,
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
  };

  return (
    <main className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-8 flex items-center gap-2 text-sm text-text-primary/60 font-medium">
        <Link href="/menu" className="hover:text-happy-blue-700 transition-colors">Menu</Link>
        <span>/</span>
        <Link href={`/menu#${product.category}`} className="hover:text-happy-blue-700 transition-colors">
          {categoryLabel(product.category)}
        </Link>
        <span>/</span>
        <span className="text-happy-blue-900">{product.name}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-16 items-start">
        {/* Gallery */}
        <div className="space-y-6">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-cream-200 border border-happy-blue-900/10 shadow-sm">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
          {product.gallery.length > 1 && (
            <div className="grid grid-cols-2 gap-4">
              {product.gallery.slice(1).map((img, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-cream-200 border border-happy-blue-900/10 shadow-sm">
                  <Image
                    src={img}
                    alt={`${product.name} photo ${idx + 2}`}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-5xl sm:text-6xl font-display text-happy-blue-900 mb-4">
            {product.name}
          </h1>
          <p className="text-2xl font-medium text-happy-blue-900 mb-6">
            {priceUSD(product.priceCents)}
          </p>

          <p className="text-lg leading-relaxed text-text-primary/80 mb-8 pb-8 border-b border-happy-blue-900/10">
            {product.blurb}
          </p>

          <dl className="grid grid-cols-2 gap-y-6 gap-x-4 mb-10">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-happy-blue-700/70 mb-1">Weight</dt>
              <dd className="font-medium text-text-primary">{product.weight}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-happy-blue-700/70 mb-1">Serves</dt>
              <dd className="font-medium text-text-primary">{product.serves}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-happy-blue-700/70 mb-1">Notice Required</dt>
              <dd className="font-medium text-text-primary">
                {product.leadTimeHours === 0 ? "Available today" : `${product.leadTimeHours} Hours`}
              </dd>
            </div>
          </dl>

          <div className="space-y-6 mb-12">
            <div>
              <h3 className="text-sm font-medium text-happy-blue-900 mb-2">Ingredients</h3>
              <p className="text-sm text-text-primary/70 leading-relaxed capitalize">
                {product.ingredients.join(", ")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-happy-blue-900 mb-2">Allergens</h3>
              <p className="text-sm text-text-primary/70 leading-relaxed capitalize">
                {product.allergens.join(", ")}
              </p>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row gap-4">
            <Link 
              href={`/order?cake=${product.slug}`}
              className="flex-1 bg-happy-blue-900 hover:bg-happy-blue-700 text-cream-50 font-medium px-8 py-4 rounded-full transition-colors duration-200 text-lg text-center"
            >
              Order Online
            </Link>
            {product.approvalRequired && (
              <div className="flex-1 bg-cream-100 text-happy-blue-900 px-6 py-4 rounded-full text-sm text-center flex items-center justify-center border border-happy-blue-900/20">
                Requires kitchen approval
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
