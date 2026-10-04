/* ==================================================================
   ✏️  THIS IS THE ONLY FILE YOU NEED TO EDIT.
   Change your store name, colors, contact info and products here.
   Save the file, refresh the page, done.
   ================================================================== */

const STORE = {
  name: "Drift Goods",                       // your store name
  tagline: "Cool little things, shipped fast.",
  currency: "$",                             // shown before every price
  accentColor: "#ff5a36",                    // main brand color (any hex color)

  // Where orders get sent. When someone checks out, their email app opens
  // with the whole order already written out, addressed to this email.
  orderEmail: "orders@example.com",

  // Shown at checkout so buyers know how to pay you.
  paymentNote: "After you send your order we'll reply within 24 hours with a payment link.",

  freeShippingOver: 25,                      // set to 0 to turn this off
  shippingCost: 4.99,

  instagram: "",                             // e.g. "https://instagram.com/yourname"
  tiktok: "",                                // e.g. "https://tiktok.com/@yourname"
};

/* ------------------------------------------------------------------
   PRODUCTS
   Copy one block { ... }, paste it, and change the details.

   id        → any unique short word, no spaces
   name      → product name
   price     → number, no $ sign
   oldPrice  → optional "was" price to show a sale (or leave it out)
   category  → anything you want; filter buttons are made automatically
   emoji     → shown as the picture if you don't have a photo yet
   image     → optional photo, e.g. "images/keychain.jpg" (put the file
               in the store/images folder)
   badge     → optional little label like "New" or "Best seller"
   buyLink   → optional direct payment link (Stripe, PayPal, Gumroad…).
               If set, the product gets a "Buy now" button.
   ------------------------------------------------------------------ */

const PRODUCTS = [
  {
    id: "sticker-pack",
    name: "Retro Sticker Pack (20)",
    price: 6.99,
    category: "Stickers",
    emoji: "🌈",
    badge: "Best seller",
    description: "20 waterproof vinyl stickers. Perfect for laptops, water bottles and phone cases.",
  },
  {
    id: "frog-sticker",
    name: "Mini Frog Stickers (10)",
    price: 3.99,
    category: "Stickers",
    emoji: "🐸",
    description: "Ten tiny frogs with big personalities. Glossy, waterproof and scratch resistant.",
  },
  {
    id: "beaded-bracelet",
    name: "Beaded Name Bracelet",
    price: 8.0,
    category: "Jewelry",
    emoji: "📿",
    badge: "Custom",
    description: "Handmade bracelet with any name or word up to 8 letters. Tell us the word in your order note.",
  },
  {
    id: "smiley-ring",
    name: "Smiley Ring Set (3)",
    price: 7.5,
    oldPrice: 10,
    category: "Jewelry",
    emoji: "💍",
    description: "Three colorful stackable rings. Adjustable, so they fit almost everyone.",
  },
  {
    id: "keychain",
    name: "Squishy Keychain",
    price: 5.0,
    category: "Accessories",
    emoji: "🔑",
    description: "Soft, squeezable keychain. Clips onto backpacks, keys and pencil cases.",
  },
  {
    id: "phone-grip",
    name: "Phone Grip & Stand",
    price: 9.99,
    oldPrice: 12.99,
    category: "Accessories",
    emoji: "📱",
    badge: "Sale",
    description: "Sticks to the back of any phone. Pops out to grip, flips to become a stand.",
  },
  {
    id: "fidget-cube",
    name: "Fidget Cube",
    price: 6.5,
    category: "Fidgets",
    emoji: "🎲",
    description: "Six sides of clicking, rolling and spinning. Quiet enough for class.",
  },
  {
    id: "pop-it",
    name: "Rainbow Pop-It",
    price: 4.5,
    category: "Fidgets",
    emoji: "🫧",
    badge: "New",
    description: "The classic bubble popper in a bright rainbow. Washable silicone.",
  },
];
