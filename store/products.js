/* ==================================================================
   ✏️  THIS IS THE ONLY FILE YOU NEED TO EDIT.
   Change your store name, contact info and products here.
   Save the file, refresh the page, done.
   ================================================================== */

const STORE = {
  name: "Maison Vale",                       // your brand name
  tagline: "Quiet essentials, made to last.",
  season: "Autumn / Winter 2026",            // small line above the big headline
  heroTitle: "The Essentials Collection",
  currency: "$",                             // shown before every price

  // Where orders get sent. When someone checks out, their email app opens
  // with the whole order already written out, addressed to this email.
  orderEmail: "orders@example.com",

  // Shown at checkout so buyers know how to pay you.
  paymentNote: "Once your order is received, we'll email you a secure payment link within 24 hours.",

  freeShippingOver: 100,                     // set to 0 to turn this off
  shippingCost: 8,

  instagram: "",                             // e.g. "https://instagram.com/yourbrand"
  tiktok: "",                                // e.g. "https://tiktok.com/@yourbrand"
};

/* ------------------------------------------------------------------
   PRODUCTS
   Copy one block { ... }, paste it, and change the details.

   id        → any unique short word, no spaces
   name      → product name
   price     → number, no $ sign
   oldPrice  → optional "was" price to show a sale (or leave it out)
   category  → anything you want; filter links are made automatically
   type      → which drawing to show until you have photos:
               "tee", "pocket-tee", "hoodie", "sweater", "overshirt",
               "trousers",
               "cap", "beanie" or "tote"
   colors    → each color has a name and a hex color code.
               Add  image: "images/hoodie-black.jpg"  to a color to use a
               real photo (put the file in the store/images folder).
   sizes     → the sizes you sell. Use ["One size"] for accessories.
   badge     → optional tiny label like "New" or "Low stock"
   details   → bullet points shown on the product page
   buyLink   → optional direct payment link (Stripe, PayPal, Gumroad…)
   ------------------------------------------------------------------ */

const PRODUCTS = [
  {
    id: "essential-hoodie",
    name: "Essential Hoodie",
    price: 95,
    category: "Tops",
    type: "hoodie",
    badge: "Bestseller",
    colors: [
      { name: "Oatmeal", hex: "#d9cfc1" },
      { name: "Black", hex: "#1f1e1d" },
      { name: "Heather Grey", hex: "#b4b2ae" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "Heavyweight brushed fleece in a relaxed fit. Soft inside, structured outside, and built to get better with every wash.",
    details: ["400 gsm cotton fleece", "Relaxed fit, true to size", "Double-layer hood", "Machine wash cold"],
  },
  {
    id: "heavyweight-tee",
    name: "Heavyweight Tee",
    price: 45,
    category: "Tops",
    type: "tee",
    colors: [
      { name: "Ivory", hex: "#f1ece3" },
      { name: "Black", hex: "#1f1e1d" },
      { name: "Stone", hex: "#a79e90" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "The perfect everyday tee. Dense cotton jersey with a boxy shoulder and a ribbed collar that keeps its shape.",
    details: ["240 gsm combed cotton", "Boxy fit, dropped shoulder", "Pre-shrunk", "Machine wash cold"],
  },
  {
    id: "crewneck",
    name: "Classic Crewneck",
    price: 85,
    category: "Tops",
    type: "sweater",
    badge: "New",
    colors: [
      { name: "Sage", hex: "#a9b39c" },
      { name: "Navy", hex: "#2b3341" },
      { name: "Cream", hex: "#ece4d4" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "A clean crewneck sweatshirt with ribbed cuffs and hem. Easy to dress up or down.",
    details: ["360 gsm loopback cotton", "Regular fit", "Ribbed collar, cuffs and hem", "Machine wash cold"],
  },
  {
    id: "overshirt",
    name: "Cotton Twill Overshirt",
    price: 120,
    category: "Outerwear",
    type: "overshirt",
    colors: [
      { name: "Camel", hex: "#b8946a" },
      { name: "Olive", hex: "#6b6a4b" },
    ],
    sizes: ["S", "M", "L", "XL"],
    description: "A sturdy twill overshirt to layer over tees and hoodies. Two chest pockets and horn-effect buttons.",
    details: ["100% cotton twill", "Relaxed fit, layer-friendly", "Two chest pockets", "Machine wash cold"],
  },
  {
    id: "lounge-trousers",
    name: "Relaxed Lounge Trousers",
    price: 80,
    oldPrice: 95,
    category: "Bottoms",
    type: "trousers",
    badge: "Sale",
    colors: [
      { name: "Charcoal", hex: "#45464a" },
      { name: "Oatmeal", hex: "#d9cfc1" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    description: "Wide-leg fleece trousers with an elastic waist and hidden drawcord. Made to match the Essential Hoodie.",
    details: ["400 gsm cotton fleece", "Wide straight leg", "Side and back pockets", "Machine wash cold"],
  },
  {
    id: "wool-beanie",
    name: "Merino Rib Beanie",
    price: 38,
    category: "Accessories",
    type: "beanie",
    colors: [
      { name: "Black", hex: "#1f1e1d" },
      { name: "Camel", hex: "#b8946a" },
      { name: "Cream", hex: "#ece4d4" },
    ],
    sizes: ["One size"],
    description: "A fine-rib beanie in soft merino wool. Warm, breathable and never itchy.",
    details: ["100% merino wool", "Fold-over cuff", "One size fits most", "Hand wash cold"],
  },
  {
    id: "canvas-cap",
    name: "Washed Canvas Cap",
    price: 35,
    category: "Accessories",
    type: "cap",
    colors: [
      { name: "Cream", hex: "#ece4d4" },
      { name: "Navy", hex: "#2b3341" },
    ],
    sizes: ["One size"],
    description: "A six-panel cap in garment-washed canvas with an adjustable brass buckle.",
    details: ["100% cotton canvas", "Adjustable strap", "Embroidered eyelets", "Spot clean"],
  },
  {
    id: "canvas-tote",
    name: "Heavy Canvas Tote",
    price: 40,
    category: "Accessories",
    type: "tote",
    colors: [
      { name: "Natural", hex: "#e3d8c3" },
      { name: "Black", hex: "#1f1e1d" },
    ],
    sizes: ["One size"],
    description: "A roomy everyday tote in thick 16 oz canvas. Fits a laptop, books and a change of clothes.",
    details: ["16 oz cotton canvas", "Inner zip pocket", "40 × 38 × 12 cm", "Spot clean"],
  },
  {
    id: "boxy-tee",
    name: "Boxy Pocket Tee",
    price: 48,
    category: "Tops",
    type: "pocket-tee",
    badge: "Low stock",
    colors: [
      { name: "Navy", hex: "#2b3341" },
      { name: "Sage", hex: "#a9b39c" },
    ],
    sizes: ["S", "M", "L", "XL"],
    description: "Our heavyweight tee with a cropped boxy body and a single chest pocket.",
    details: ["240 gsm combed cotton", "Cropped boxy fit", "Chest pocket", "Machine wash cold"],
  },
];
