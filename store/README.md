# 🛍️ Your Online Store

A simple, ready-to-use online store. No coding needed to change it.

**Live link (after it deploys):** https://alexanderbruun4-coder.github.io/media-hub/store/

## How to make it yours (5 minutes)

Open **`products.js`**. That is the only file you need to touch.

1. Change `name`, `tagline` and `accentColor` at the top.
2. Put your email in `orderEmail`. Orders get sent there.
3. Edit, delete or copy the product blocks to make your own products.
4. Save. Refresh the page. Done.

### Adding real photos

1. Make a folder called `images` inside the `store` folder.
2. Put your photo in it, for example `keychain.jpg`.
3. In the product, add `image: "images/keychain.jpg",`

Square photos look best.

## How orders work

1. A customer adds items to their cart and presses **Checkout**.
2. They type their name, email and address.
3. Their email app opens with the whole order written out, sent to you.
4. You reply with a payment link, then ship the item once they pay.

Want a "Buy now" button that takes payment right away? Add a `buyLink`
to a product. It can be a Stripe, PayPal or Gumroad payment link.

## ⚠️ Important: ask a parent first

Payment services like PayPal, Stripe and Gumroad require you to be 18.
Ask a parent or guardian to set up the payment account and help you
handle money, shipping addresses and customer emails.

## Product ideas that are easy to resell

- **Stickers.** Buy in bulk online, sell in packs. Cheap to ship in an envelope.
- **Beaded or name bracelets.** Cheap beads, you make them, sell custom ones.
- **Keychains and phone grips.** Small, light, and popular.
- **Fidget toys.** Buy wholesale packs, sell individually.

Tip: buy a small amount first, see what sells, then buy more of the winners.
Always charge more than what the item **plus shipping and packaging** cost you.

## Selling this website to someone else

This store works for any small business. To make a copy for a customer:

1. Copy the whole `store` folder.
2. Change `products.js` to their name, colors, email and products.
3. Host it for free on GitHub Pages, Netlify or Cloudflare Pages.

## Files

| File | What it does | Edit it? |
| --- | --- | --- |
| `products.js` | Store name, settings, products | ✅ Yes |
| `index.html` | Page layout and FAQ text | Only to change wording |
| `style.css` | Colors and design | Optional |
| `store.js` | Cart and checkout logic | No |
