import { ASSET_BASE } from "./brand";

// Source of truth for products on happycake.us.
// IDs and prices mirror the HappyCake POS catalog exposed via the
// `square_list_catalog` MCP tool. Update both sides together.

export type ProductCategory = "whole-cakes" | "slices" | "custom" | "catering";

export type Product = {
  slug: string;
  squareItemId: string;
  variationId: string;
  name: string; // brand-form display name, e.g. cake "Honey"
  shortName: string; // for crumbs and lists
  category: ProductCategory;
  priceCents: number;
  weight: string; // e.g. "1.2 kg"
  serves: string; // e.g. "10–12 guests"
  leadTimeHours: number; // 0 = available today
  approvalRequired: boolean;
  image: string;
  gallery: string[];
  blurb: string; // 1–2 sentences, brandbook style
  ingredients: string[];
  allergens: string[];
  pairsWith?: string[]; // related slugs
};

const img = (path: string) => `${ASSET_BASE}/${path}`;

export const CATALOG: Product[] = [
  {
    slug: "honey",
    squareItemId: "sq_item_whole_honey_cake",
    variationId: "sq_var_whole_honey_cake",
    name: 'cake "Honey"',
    shortName: "Honey",
    category: "whole-cakes",
    priceCents: 5500,
    weight: "1.2 kg",
    serves: "10–12 guests",
    leadTimeHours: 24,
    approvalRequired: false,
    image: img("products/happy-cake-product-08.webp"),
    gallery: [
      img("products/happy-cake-product-08.webp"),
      img("social/happy-cake-social-01.webp"),
    ],
    blurb:
      'Six layers of golden honey biscuit, soft custard between every one, walnuts pressed lightly into the top. Same recipe as the day we opened.',
    ingredients: [
      "honey biscuit",
      "vanilla custard",
      "walnuts",
      "wheat flour",
      "butter",
      "eggs",
      "sugar",
    ],
    allergens: ["wheat", "eggs", "milk", "tree nuts (walnut)"],
    pairsWith: ["napoleon", "milk-maiden"],
  },
  {
    slug: "honey-slice",
    squareItemId: "sq_item_honey_cake_slice",
    variationId: "sq_var_honey_cake_slice",
    name: 'cake "Honey" — single slice',
    shortName: "Honey slice",
    category: "slices",
    priceCents: 850,
    weight: "150 g",
    serves: "1 guest",
    leadTimeHours: 0,
    approvalRequired: false,
    image: img("products/happy-cake-product-08.webp"),
    gallery: [
      img("products/happy-cake-product-08.webp"),
      img("social/happy-cake-social-03.webp"),
    ],
    blurb:
      'A single slice of cake "Honey" — the same six layers, the same custard, ready on the counter for walk-ins.',
    ingredients: ["honey biscuit", "vanilla custard", "walnuts"],
    allergens: ["wheat", "eggs", "milk", "tree nuts (walnut)"],
    pairsWith: ["pistachio-roll"],
  },
  {
    slug: "pistachio-roll",
    squareItemId: "sq_item_pistachio_roll",
    variationId: "sq_var_pistachio_roll",
    name: 'cake "Pistachio Roll"',
    shortName: "Pistachio Roll",
    category: "slices",
    priceCents: 950,
    weight: "180 g",
    serves: "1 guest",
    leadTimeHours: 0,
    approvalRequired: false,
    image: img("products/happy-cake-product-05.webp"),
    gallery: [
      img("products/happy-cake-product-05.webp"),
      img("products/happy-cake-product-06.webp"),
      img("social/happy-cake-social-05.webp"),
    ],
    blurb:
      'Light meringue, butter cream, the sour-sweet of fresh raspberry, finished with toasted pistachio.',
    ingredients: [
      "meringue",
      "butter cream",
      "raspberry",
      "pistachio",
      "egg whites",
      "sugar",
    ],
    allergens: ["eggs", "milk", "tree nuts (pistachio)"],
    pairsWith: ["honey-slice", "tiramisu-box"],
  },
  {
    slug: "custom-birthday",
    squareItemId: "sq_item_custom_birthday_cake",
    variationId: "sq_var_custom_birthday_cake",
    name: "Custom birthday cake",
    shortName: "Custom birthday",
    category: "custom",
    priceCents: 9500,
    weight: "1.5 kg",
    serves: "12–16 guests",
    leadTimeHours: 72,
    approvalRequired: true,
    image: img("products/happy-cake-product-03.webp"),
    gallery: [
      img("products/happy-cake-product-03.webp"),
      img("products/happy-cake-product-04.webp"),
      img("social/happy-cake-social-07.webp"),
    ],
    blurb:
      "A celebration cake decorated for your day — name, age, a small theme. We confirm details with you before the kitchen starts.",
    ingredients: [
      "honey biscuit or vanilla biscuit (your choice)",
      "vanilla custard",
      "fresh berries",
      "fondant lettering",
    ],
    allergens: ["wheat", "eggs", "milk", "may contain tree nuts"],
    pairsWith: ["office-dessert-box"],
  },
  {
    slug: "office-dessert-box",
    squareItemId: "sq_item_office_dessert_box",
    variationId: "sq_var_office_dessert_box",
    name: "Office dessert box",
    shortName: "Office box",
    category: "catering",
    priceCents: 12000,
    weight: "1.6 kg assorted",
    serves: "10–14 guests",
    leadTimeHours: 24,
    approvalRequired: false,
    image: img("products/happy-cake-product-01.webp"),
    gallery: [
      img("products/happy-cake-product-01.webp"),
      img("products/happy-cake-product-02.webp"),
      img("social/happy-cake-social-08.webp"),
    ],
    blurb:
      'An assorted box for the office afternoon — slices of cake "Honey", cake "Pistachio Roll", and a few seasonal pieces. We pack it in a cream box ready to share.',
    ingredients: [
      "assorted slices",
      "honey biscuit",
      "meringue",
      "butter cream",
      "raspberry",
      "pistachio",
    ],
    allergens: ["wheat", "eggs", "milk", "tree nuts"],
    pairsWith: ["custom-birthday"],
  },
];

export const CATEGORIES: { id: ProductCategory; label: string; blurb: string }[] = [
  {
    id: "whole-cakes",
    label: "Whole cakes",
    blurb: "Family-size, 24 hours' notice. The classics, baked to order.",
  },
  {
    id: "slices",
    label: "Slices",
    blurb: "Ready on the counter for walk-ins and quick pickup.",
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Birthday and celebration cakes. We confirm details before baking.",
  },
  {
    id: "catering",
    label: "Catering",
    blurb: "Boxes for offices, gatherings, and team afternoons.",
  },
];

export function findProduct(slug: string): Product | undefined {
  return CATALOG.find((p) => p.slug === slug);
}

export function priceUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function categoryLabel(id: ProductCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
