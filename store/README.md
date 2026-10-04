# 🛍️ Your Online Clothing Store

A clean, luxury-style clothing store that's ready to use. No coding needed to change it.

**Live link (after it deploys):** https://alexanderbruun4-coder.github.io/media-hub/store/

## How to make it yours (5 minutes)

Open **`products.js`**. That is the only file you need to touch.

1. Change `name`, `tagline`, `season` and `heroTitle` at the top.
2. Put your email in `orderEmail`. Orders get sent there.
3. Edit, delete or copy the product blocks to make your own products.
4. Save. Refresh the page. Done.

### Colors and sizes

Each product has a list of `colors` and `sizes`. Shoppers must pick a size
before they can add something to their bag. The color and size show up in
the order email, so you know exactly what to send.

Until you have photos, each product shows a drawing that matches its
`type`, such as "hoodie" or "tee". The drawing changes color when the
shopper picks a different color.

To change the store's overall look, edit the color list at the top of
`style.css`.

### Adding real photos

1. Make a folder called `images` inside the `store` folder.
2. Put your photo in it, for example `hoodie-black.jpg`.
3. Add it to the matching color, like this:
   `{ name: "Black", hex: "#1f1e1d", image: "images/hoodie-black.jpg" },`

Tall photos, 4 wide by 5 high, look best. A plain light background
looks the most "luxury".

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

## Clothing that's easy to resell

- **Blank basics.** Buy plain heavyweight tees, hoodies and crewnecks from a
  wholesale "blanks" supplier. Neutral colors like black, cream and grey look the most luxury.
- **Your own brand.** Add a small embroidered or printed logo to blanks.
  Print-on-demand services do this for you and ship each order, so you don't need stock.
- **Accessories.** Beanies, caps and tote bags are cheap, come in one size, and are easy to ship.
- **Thrift flips.** Find good brand-name pieces at thrift stores, wash and steam
  them, take nice photos and resell them.

Tips:
- Start with a few items, see what sells, then buy more of the winners.
- Always charge more than what the item **plus shipping and packaging** cost you.
- Only sell your own designs or plain items. Never sell fake copies of real
  brands like Nike or Supreme, because that's illegal.

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
