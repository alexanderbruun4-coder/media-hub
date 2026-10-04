# Grail House: your resale store

A clean, high-end online store for reselling sneakers, clothes, bags and accessories.

- **Your store:** https://alexanderbruun4-coder.github.io/media-hub/store/
- **Your admin panel:** https://alexanderbruun4-coder.github.io/media-hub/store/admin.html

## Running your store from the admin panel

You never need to touch code. Everything happens in the admin panel.

### First time: connect to GitHub (5 minutes)

1. Open the admin panel link above.
2. Follow the 4 steps on the screen to make a GitHub token. The token is like a
   password that lets the admin panel save changes to your store.
3. Paste the token and press **Connect**.

Keep your token secret. Never share it or post it anywhere. If it ever leaks,
delete it on GitHub and make a new one.

### Adding a product

1. Press **Add product**.
2. Add photos. You can drag them in or tap the box to pick them from your phone.
   The first photo is the cover. Use the arrows to change the order.
3. Fill in the name, category, price, condition, sizes and description.
4. Press **Add product**, then press **Publish** at the top.

Your store updates about a minute after you publish.

### Other things you can change

| Section | What you can change |
| --- | --- |
| Products | Add, edit, copy, hide or delete products. Set stock to 0 when something sells. |
| Store settings | Store name, email, announcement bar, shipping prices, payment info, social links |
| Homepage & photos | The big banner photo and headline, plus the photos for other sections |
| Pages & FAQ | Your About story, FAQ questions, and shipping, returns, privacy and terms policies |
| Discounts & reviews | Discount codes like `WELCOME10`, and real customer reviews |

- **Preview** shows your changes before anyone else can see them.
- **Discard** throws away changes you haven't published yet.

## What the store includes

- Homepage with banner, categories, new arrivals, featured items and a "sell with us" section
- Shop page with category, condition, size and stock filters, plus sorting
- Product pages with a photo gallery, sizes, condition, stock and related items
- Search, saved items with a heart button, and a shopping bag
- Checkout with shipping options and discount codes
- Sell with us, About, Contact, FAQ, Shipping, Returns, Privacy and Terms pages
- Works on phones, tablets and computers

## How orders work

1. A customer checks out and presses **Place order**.
2. Their email app opens with the full order addressed to you. They press send.
3. You email them a payment link, then ship once they've paid.

Want customers to pay right away? Add a payment link in **Store settings**, or a
**Payment link** on a single product, such as a Stripe or PayPal link.

## Important

- **Put in your own email.** Change the order email in **Store settings**,
  otherwise orders won't reach you.
- **Ask a parent to handle payments.** PayPal, Stripe and similar services
  require you to be 18. A parent or guardian should own the payment account and
  help with shipping addresses.
- **Only sell real items.** Never sell fakes or replicas of real brands. It's
  illegal, and it's the fastest way to lose customers.
- **Use your own photos.** The sample products are placeholders with free stock
  photos from Unsplash. Delete them and add your real items with your own photos.
- **Only post real reviews.** Never make up reviews.

## Reselling tips

- Buy low and sell high: thrift stores, sales and online marketplaces are good places to find stock.
- Take photos in daylight on a plain background, and show any wear honestly.
- Grade the condition honestly. Buyers come back when the item matches the listing.
- Charge enough to cover what you paid, plus shipping, packaging and your time.

## Files, for the curious

| File | What it is |
| --- | --- |
| `index.html`, `js/app.js`, `css/store.css` | The store customers see |
| `admin.html`, `js/admin.js`, `css/admin.css` | Your admin panel |
| `data/store.json` | All your products and settings. The admin panel edits this file. |
| `images/` | Product and section photos. Uploads go in `images/uploads/`. |
