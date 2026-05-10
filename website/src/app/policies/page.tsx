import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "HappyCake order policies — lead times, pickup and delivery, allergens, custom orders, and cancellations.",
};

const POLICIES = [
  {
    id: "lead-times",
    title: "Lead times",
    body: [
      "Slices and the office box are usually ready the same day during open hours.",
      "Whole cakes need 24 hours' notice so we can bake to you, not from stock.",
      "Custom birthday cakes need 72 hours and we confirm details — name, theme, dietary notes — before the kitchen starts.",
    ],
  },
  {
    id: "pickup-delivery",
    title: "Pickup and delivery",
    body: [
      "Pickup at the shop is free. We hold the cake at the counter from your chosen time; later pickup is fine — message us if your day shifts.",
      "Local delivery within ten miles of Sugar Land is a $12 flat fee.",
      "Same-day delivery is possible for slices and the office box during open hours, subject to courier availability.",
    ],
  },
  {
    id: "allergens",
    title: "Allergens and ingredients",
    body: [
      "Every cake page lists ingredients and allergens. We bake in a kitchen that handles wheat, eggs, milk, and tree nuts; cross-contact is possible.",
      "Tell us about an allergy in the order notes and we'll confirm what's safe before we bake.",
      "We don't currently offer gluten-free or vegan options. We say so up front rather than improvise.",
    ],
  },
  {
    id: "custom",
    title: "Custom and decorated cakes",
    body: [
      "Custom cakes go into an approval queue. The owner reviews details before the kitchen begins.",
      "We don't take on highly custom designs that require us to invent recipes — our offering is the ready-made line, decorated thoughtfully.",
      "If we can't make exactly what you're imagining, we'll say so and suggest the closest classic.",
    ],
  },
  {
    id: "changes-cancellations",
    title: "Changes and cancellations",
    body: [
      "You can change or cancel any order up to 12 hours before pickup at no charge.",
      "Inside 12 hours we charge 50% on whole cakes and 100% on custom cakes — the kitchen has already started.",
      "If something is wrong with the cake on pickup, tell us at the counter or message us right away. We'll make it right that day.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    body: [
      "We accept card and cash at the counter, and card via the order link we send back after we confirm your order.",
      "We don't accept tips for the kitchen — we pay the team properly. If you want to leave a note, the order notes go straight to the baker.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "We use your name and phone number to confirm orders and reach you about pickup. That's it.",
      "We don't sell or share customer data. If you opted in to the email digest, you can unsubscribe in any message.",
    ],
  },
];

export default function PoliciesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
        ◆ Policies
      </p>
      <h1 className="mt-3 font-display text-5xl text-happy-blue-900">
        Plain English. No surprises.
      </h1>
      <p className="mt-4 text-text-primary/80">
        These are the rules we run the shop by. If anything here is unclear,
        message us — we&apos;d rather rewrite the line than have you guess.
      </p>

      <nav aria-label="On this page" className="mt-8 rounded-2xl border border-happy-blue-900/15 bg-cream-100 p-5 text-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-happy-blue-700/70">
          On this page
        </p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {POLICIES.map((p) => (
            <li key={p.id}>
              <a className="text-happy-blue-700 hover:underline" href={`#${p.id}`}>
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12 space-y-12">
        {POLICIES.map((p) => (
          <section key={p.id} id={p.id} className="scroll-mt-24">
            <h2 className="font-display text-3xl text-happy-blue-900">
              {p.title}
            </h2>
            <ul className="mt-4 space-y-3 text-text-primary/85">
              {p.body.map((line, i) => (
                <li key={i}>— {line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-16 text-sm text-text-primary/60">
        Questions? Call {BRAND.phoneDisplay} or email{" "}
        <a className="text-happy-blue-700 hover:underline" href={`mailto:${BRAND.email}`}>
          {BRAND.email}
        </a>
        .
      </p>
    </main>
  );
}
