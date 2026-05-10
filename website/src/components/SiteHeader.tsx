import Image from "next/image";
import Link from "next/link";
import { ASSET_BASE, BRAND } from "@/lib/brand";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/visit", label: "Visit" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-happy-blue-900/10 bg-cream-50/80 backdrop-blur-md shadow-sm transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-4 transition-transform hover:scale-[1.02] active:scale-95" aria-label="HappyCake home">
          <Image
            src={`${ASSET_BASE}/logo/happy-cake-logo-256.png`}
            alt="HappyCake"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
          <span className="hidden text-xs uppercase tracking-[0.18em] text-happy-blue-700/70 sm:inline mt-1">
            ◆ {BRAND.city}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-happy-blue-900/80 transition-colors hover:text-happy-blue-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/order"
          className="hidden rounded-full bg-happy-blue-900 px-6 py-2.5 text-sm font-medium text-cream-50 shadow-sm transition-all hover:bg-happy-blue-700 hover:shadow-md hover:-translate-y-0.5 active:scale-95 md:inline-flex"
        >
          Start an order
        </Link>
      </div>

      <nav
        aria-label="Mobile"
        className="flex items-center justify-center gap-6 border-t border-happy-blue-900/10 bg-cream-50/90 backdrop-blur-md py-3 md:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-happy-blue-900/80 transition-colors hover:text-happy-blue-700"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
