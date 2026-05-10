"use client";

import { useState, FormEvent, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { CATALOG, priceUSD } from "@/lib/catalog";
import { ASSET_BASE } from "@/lib/brand";

function OrderForm() {
  const searchParams = useSearchParams();
  const preselectedCake = searchParams.get("cake");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [todayDate, setTodayDate] = useState("");

  useEffect(() => {
    // Set today's date in YYYY-MM-DD format once mounted
    const today = new Date();
    // Adjust for local timezone
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - offset)).toISOString().split('T')[0];
    setTodayDate(localISOTime);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || "Failed to submit order");
        setStatus("error");
      }
    } catch (err) {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="text-center py-16 bg-cream-50 rounded-3xl border border-happy-blue-900/10">
        <div className="mx-auto w-16 h-16 bg-happy-blue-900 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-cream-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-display text-happy-blue-900 mb-4">Order Received!</h2>
        <p className="text-text-primary/80 max-w-md mx-auto mb-8">
          We've sent your request to the kitchen. We will confirm your order via WhatsApp shortly.
        </p>
        <button onClick={() => window.location.reload()} className="text-happy-blue-700 font-medium hover:text-happy-blue-500">
          Place another order &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-12 items-start">
      <div className="bg-cream-50 p-8 sm:p-10 rounded-3xl border border-happy-blue-900/10 shadow-sm">
        <h2 className="text-3xl font-display text-happy-blue-900 mb-6">Order Details</h2>
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-2">
            <label htmlFor="product" className="block text-sm font-medium text-happy-blue-900">
              Select your cake
            </label>
            <select
              id="product"
              name="product"
              defaultValue={preselectedCake || ""}
              required
              className="w-full bg-cream-100 border border-happy-blue-900/20 rounded-xl px-4 py-3 text-text-primary focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all"
            >
              <option value="" disabled>Choose a cake...</option>
              {CATALOG.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.name} ({priceUSD(product.priceCents)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-happy-blue-900">
                First Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full bg-cream-100 border border-happy-blue-900/20 rounded-xl px-4 py-3 text-text-primary focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-medium text-happy-blue-900">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                placeholder="(281) 555-0000"
                className="w-full bg-cream-100 border border-happy-blue-900/20 rounded-xl px-4 py-3 text-text-primary focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="date" className="block text-sm font-medium text-happy-blue-900">
              Pickup Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              required
              min={todayDate}
              defaultValue={todayDate}
              key={todayDate}
              className="w-full bg-cream-100 border border-happy-blue-900/20 rounded-xl px-4 py-3 text-text-primary focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all"
            />
            <p className="text-xs text-text-primary/60 mt-1">
              Please note our lead times: 24h for whole cakes, 72h for custom cakes. Slices available today.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-happy-blue-900">
              Special Requests (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full bg-cream-100 border border-happy-blue-900/20 rounded-xl px-4 py-3 text-text-primary focus:border-happy-blue-500 focus:outline-none focus:ring-2 focus:ring-happy-blue-500/20 transition-all resize-none"
            ></textarea>
          </div>

          {status === "error" && (
            <div className="p-3 bg-red-100 text-red-700 text-sm rounded-lg border border-red-200">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full bg-happy-blue-900 hover:bg-happy-blue-700 text-cream-50 font-medium px-8 py-4 rounded-xl transition-all duration-200 text-lg flex justify-center items-center disabled:opacity-70 active:scale-95 shadow-md hover:shadow-lg"
          >
            {status === "submitting" ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : "Place Order Request"}
          </button>
        </form>
      </div>

      <div className="hidden md:block sticky top-32">
        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl transition-transform duration-500 hover:scale-[1.02]">
          <Image
            src={`${ASSET_BASE}/hero/happy-cake-hero-02.webp`}
            alt="Baking fresh cakes"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-happy-blue-900/90 via-happy-blue-900/20 to-transparent flex items-end p-10">
            <div>
              <p className="text-cream-50/80 text-sm tracking-widest uppercase mb-3">Sugar Land Kitchen</p>
              <p className="text-cream-50 font-display text-3xl leading-tight">Baked fresh, <br/>just for your order.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <main className="py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-14">
        <p className="text-xs uppercase tracking-widest text-happy-blue-700/70 mb-4">
          ◆ Order Request
        </p>
        <h1 className="text-5xl sm:text-6xl font-display text-happy-blue-900 mb-6 tracking-tight">
          Start your order
        </h1>
        <p className="text-lg text-text-primary/80 max-w-2xl leading-relaxed font-light">
          Submit your order details below. Our kitchen AI assistant will verify availability and log the ticket directly to our Square system.
        </p>
      </div>

      <Suspense fallback={<div className="h-96 flex items-center justify-center text-happy-blue-900/50">Loading form...</div>}>
        <OrderForm />
      </Suspense>
    </main>
  );
}
