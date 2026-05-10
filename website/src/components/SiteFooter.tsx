import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-happy-blue-900 text-cream-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <p className="font-display text-3xl">HappyCake</p>
          <p className="mt-3 max-w-md text-cream-200/90">
            {BRAND.shortPitch}
          </p>
          <p className="mt-6 text-sm text-cream-200/80">
            {BRAND.closingLine}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cream-200/70">
            Visit
          </p>
          <address className="mt-3 not-italic text-sm leading-relaxed text-cream-50">
            {BRAND.address.street}
            <br />
            {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
          </address>
          <p className="mt-3 text-sm">
            <a
              href={`tel:${BRAND.phoneE164}`}
              className="underline-offset-2 hover:underline"
            >
              {BRAND.phoneDisplay}
            </a>
          </p>
          <p className="mt-1 text-sm">
            <a
              href={BRAND.whatsappLink}
              className="underline-offset-2 hover:underline"
            >
              WhatsApp
            </a>{" "}
            ·{" "}
            <a
              href={BRAND.social.instagram}
              className="underline-offset-2 hover:underline"
            >
              Instagram
            </a>
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cream-200/70">
            Hours
          </p>
          <ul className="mt-3 space-y-1 text-sm text-cream-50">
            {BRAND.hours.map((row) => (
              <li key={row.day} className="flex justify-between gap-4">
                <span>{row.day}</span>
                <span className="text-cream-200/80">
                  {row.open} – {row.close}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-cream-50/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-cream-200/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} HappyCake · {BRAND.city}</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/policies" className="hover:text-cream-50">
              Policies
            </Link>
            <Link href="/about" className="hover:text-cream-50">
              About
            </Link>
            <Link href="/visit" className="hover:text-cream-50">
              Visit
            </Link>
            <Link href="/api/products" className="hover:text-cream-50">
              Catalog API
            </Link>
            <Link href="/llms.txt" className="hover:text-cream-50">
              llms.txt
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
