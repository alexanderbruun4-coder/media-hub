/* ==================================================================
   All tekst på nettsiden, på norsk (no) og engelsk (en).
   All text on the site, in Norwegian (no) and English (en).
   Endre teksten her hvis du vil skrive noe annet.
   ================================================================== */
window.I18N = {
  no: {
    // meny
    "nav.home": "Hjem", "nav.shop": "Butikk", "nav.new": "Nyheter", "nav.request": "Ønsk en vare", "nav.about": "Om oss",
    "nav.faq": "FAQ", "nav.contact": "Kontakt", "nav.saved": "Lagrede varer",
    "a11y.menu": "Åpne meny", "a11y.search": "Søk", "a11y.saved": "Lagrede varer", "a11y.bag": "Handlekurv", "a11y.close": "Lukk",
    "a11y.lang": "Bytt språk",

    announce: ["Billig og god kvalitet", "Kjapp shipping i hele Norge", "Selling whatever u want"],

    // forside
    "hero.eyebrow": "Norges nye favorittbutikk",
    "hero.title": "Billig. God kvalitet. Kjapp shipping.",
    "hero.text": "Vi selger det du vil ha, til priser som faktisk gir mening. Sendes kjapt, rett hjem til deg.",
    "hero.cta": "Se butikken", "hero.cta2": "Ønsk en vare",
    "hero.badge": "Selling whatever u want",
    "f1.t": "Billig og god kvalitet", "f1.d": "Lave priser uten å gå på akkord med kvaliteten.",
    "f2.t": "Kjapp shipping", "f2.d": "Vi sender raskt, så du får varene dine fort.",
    "f3.t": "Vi selger det du vil ha", "f3.d": "Finner du det ikke? Si ifra, så skaffer vi det.",
    "home.products.eyebrow": "Butikken", "home.products.title": "Siste nytt", "home.viewAll": "Se alle",
    "vault.eyebrow": "I 3D", "vault.title": "Utforsk utvalget.", "vault.text": "Dra eller sveip for å snurre. Trykk på en vare for å se den.",
    "vault.prev": "Forrige vare", "vault.next": "Neste vare",
    "req.eyebrow": "Selling whatever u want", "req.title": "Finner du ikke det du leter etter?",
    "req.text": "Si hva du vil ha, så prøver vi å skaffe det til deg. Billig, i god kvalitet og med kjapp levering.",
    "req.cta": "Ønsk en vare",

    // tomt
    "empty.title": "Ingen produkter enda", "empty.text": "Nye varer kommer snart. Følg med!",

    // butikk
    "shop.title": "Butikk", "shop.new": "Nyheter", "shop.lead": "Billig, god kvalitet og kjapp shipping.",
    "shop.newLead": "De nyeste varene i butikken.", "shop.searchTitle": "Søk: «{q}»",
    "shop.all": "Alle", "shop.allItems": "Alle varer", "shop.inStock": "Kun på lager", "shop.allShop": "Hele butikken",
    "sort.featured": "Utvalgte", "sort.newest": "Nyeste", "sort.asc": "Pris: lav til høy", "sort.desc": "Pris: høy til lav",
    "shop.count1": "{n} vare", "shop.countN": "{n} varer",
    "shop.noMatch": "Ingen varer her", "shop.noMatchText": "Prøv å fjerne et filter, eller kom tilbake snart.", "shop.clear": "Fjern filtre",
    "tag.sold": "Utsolgt", "tag.sale": "Salg", "tag.new": "Ny",
    "save": "Lagre", "unsave": "Fjern fra lagrede", "saved.on": "Lagret til senere", "saved.off": "Fjernet fra lagrede",

    // produkt
    "pd.size": "Velg størrelse", "pd.sizeOne": "Størrelse", "pd.oneSize": "Én størrelse", "pd.sizeErr": "Velg en størrelse først.",
    "pd.add": "Legg i handlekurv", "pd.sold": "Utsolgt", "pd.buy": "Kjøp nå", "pd.share": "Del varen", "pd.copied": "Lenke kopiert",
    "pd.left1": "Kun 1 igjen", "pd.leftN": "Kun {n} igjen", "pd.save": "Spar {x}",
    "pd.desc": "Beskrivelse", "pd.ship": "Frakt og retur",
    "pd.perk1": "Billig og god kvalitet", "pd.perk2": "Kjapp shipping", "pd.perk3": "14 dagers angrerett",
    "pd.related": "Du vil kanskje også like", "pd.gone": "Denne varen finnes ikke lenger.",
    "pd.only": "Bare {n} på lager, og alle er i handlekurven",

    // handlekurv
    "bag.title": "Handlekurv", "bag.empty": "Handlekurven er tom", "bag.emptyText": "Finn noe du liker.", "bag.toShop": "Til butikken",
    "bag.subtotal": "Delsum", "bag.note": "Frakt og rabattkoder legges til i kassen.", "bag.checkout": "Til kassen",
    "bag.remove": "Fjern", "bag.away": "{x} igjen til gratis frakt", "bag.free": "Du har fått gratis frakt!",
    "bag.less": "Færre", "bag.more": "Flere", "bag.qty": "Antall {n}", "bag.secure": "Trygg handel · Kjapp shipping",

    // kasse
    "co.title": "Kasse", "co.contact": "Kontakt", "co.email": "E-post", "co.first": "Fornavn", "co.last": "Etternavn",
    "co.phone": "Telefon", "co.optional": "(valgfritt)", "co.address": "Leveringsadresse", "co.street": "Adresse",
    "co.zip": "Postnummer", "co.city": "Sted", "co.country": "Land", "co.countryDefault": "Norge",
    "co.delivery": "Levering", "co.standard": "Standard", "co.standardTime": "2–5 virkedager", "co.express": "Ekspress",
    "co.expressTime": "1–2 virkedager", "co.payment": "Betaling",
    "co.payNote": "Når du har bestilt, sender vi deg betalingsinfo på e-post innen 24 timer. Du kan betale med Vipps eller betalingslenke.",
    "co.note": "Melding", "co.place": "Send bestilling",
    "co.help": "Når du bestiller åpnes e-postappen din med alt ferdig utfylt. Bare trykk send.",
    "co.summary": "Ordresammendrag", "co.code": "Rabattkode", "co.apply": "Bruk", "co.removeCode": "Fjern",
    "co.discount": "Rabatt", "co.shipping": "Frakt", "co.free": "Gratis", "co.total": "Totalt",
    "co.codeOk": "{code} brukt: {p}% avslag", "co.codeBad": "Den koden fungerer ikke", "co.codeRemoved": "Koden er fjernet",
    "co.codeEmpty": "Skriv inn en kode", "co.secure": "Opplysningene dine sendes bare til {name}",
    "co.emptyTitle": "Handlekurven er tom", "co.emptyText": "Legg til noe du liker, og kom tilbake hit.",

    // ordre
    "ord.eyebrow": "Bestilling {n}", "ord.title": "Takk!", "ord.titleName": "Takk, {name}!",
    "ord.lead": "E-postappen din skal ha åpnet seg med bestillingen. Trykk send for å bekrefte den.",
    "ord.vipps": "Betal med Vipps til {num}", "ord.pay": "Betal nå", "ord.resend": "Åpne e-post igjen", "ord.copy": "Kopier bestilling",
    "ord.copied": "Bestillingen er kopiert", "ord.help": "Åpnet ikke e-posten seg? Kopier bestillingen og send den til {email}.",
    "ord.missing": "Vi finner ikke den bestillingen på denne enheten. Sjekk e-posten din.",
    "ord.mailSubject": "Bestilling {n} – {total}",

    // ønsk en vare
    "rq.title": "Ønsk en vare", "rq.lead": "Selling whatever u want. Fortell oss hva du leter etter, så sjekker vi om vi kan skaffe det. Billig og i god kvalitet.",
    "rq.s1": "Si hva du vil ha", "rq.s1d": "Fyll ut skjemaet under.", "rq.s2": "Vi finner det", "rq.s2d": "Vi svarer med pris innen 48 timer.",
    "rq.s3": "Kjapp levering", "rq.s3d": "Du får det rett hjem.",
    "rq.name": "Navn", "rq.email": "E-post", "rq.item": "Hva vil du ha?", "rq.itemPh": "f.eks. hettegenser, sneakers, øreplugger",
    "rq.link": "Lenke eller bilde", "rq.size": "Størrelse eller farge", "rq.budget": "Budsjett", "rq.more": "Noe mer vi bør vite?",
    "rq.send": "Send ønske", "rq.sent": "E-postappen din åpnet seg. Trykk send.", "rq.subject": "Ønske: {item}",

    // om, kontakt, faq
    "about.title": "Om {name}",
    "about.text": "{name} er en norsk nettbutikk med én enkel idé: ting du faktisk vil ha, til en pris som gir mening. Vi holder prisene lave, passer på kvaliteten og sender kjapt, rett hjem til deg.\n\nFinner du ikke det du leter etter? Selling whatever u want. Bare si ifra.",
    "about.v1": "Billig", "about.v1d": "Priser som gir mening.", "about.v2": "God kvalitet", "about.v2d": "Vi sjekker varene før de sendes.",
    "about.v3": "Kjapt", "about.v3d": "Rask shipping i hele Norge.",
    "ct.title": "Kontakt oss", "ct.lead": "Spørsmål om en vare eller en bestilling? Vi svarer vanligvis innen én dag.",
    "ct.name": "Navn", "ct.email": "E-post", "ct.order": "Ordrenummer", "ct.msg": "Melding", "ct.send": "Send melding",
    "ct.sent": "E-postappen din åpnet seg. Trykk send.", "ct.subject": "Melding fra {name}",
    "faq.title": "Ofte stilte spørsmål", "faq.more": "Fant du ikke svaret?", "faq.contact": "Kontakt oss",
    faq: [
      ["Hvor lang tid tar frakten?", "Vi sender bestillinger kjapt, vanligvis innen 1–2 virkedager. Standard levering tar 2–5 virkedager i Norge, og ekspress tar 1–2 virkedager."],
      ["Hvordan betaler jeg?", "Når du har bestilt, sender vi deg betalingsinfo på e-post innen 24 timer. Du kan betale med Vipps eller betalingslenke. Varene holdes av til deg."],
      ["Kan jeg ønske meg en vare?", "Ja! Selling whatever u want. Bruk siden «Ønsk en vare», så sjekker vi om vi kan skaffe det du vil ha."],
      ["Kan jeg returnere en vare?", "Ja. Du har 14 dagers angrerett. Ubrukte varer kan returneres innen 14 dager etter at du fikk dem. Send oss en e-post for å starte en retur."],
      ["Sender dere utenfor Norge?", "Send oss en e-post, så finner vi en løsning."],
    ],

    // vilkår
    "pol.eyebrow": "Vilkår og info", "pol.shipping": "Frakt", "pol.returns": "Retur og angrerett", "pol.privacy": "Personvern", "pol.terms": "Kjøpsvilkår",
    "pol.shippingText": "Vi pakker og sender bestillinger kjapt, vanligvis innen 1–2 virkedager. Standard levering tar 2–5 virkedager. Ekspress tar 1–2 virkedager. Du får sporingsnummer på e-post når pakken er sendt. Frakten er gratis over beløpet som vises i kassen.",
    "pol.returnsText": "Du har 14 dagers angrerett etter at du har mottatt varen. Varen må være ubrukt og i samme stand som da du fikk den. Send oss en e-post for å starte en retur, så sender vi deg instruksjoner. Pengene betales tilbake senest 14 dager etter at vi har fått varen tilbake.",
    "pol.privacyText": "Vi samler bare inn det vi trenger for å behandle bestillingen din: navn, e-post og leveringsadresse. Vi selger eller deler aldri opplysningene dine. Handlekurven og lagrede varer lagres bare på din egen enhet.",
    "pol.termsText": "Prisene og lagerbeholdningen kan endre seg uten varsel. Når du sender en bestilling, godtar du å betale totalbeløpet som vises i kassen. Hvis en vare blir utsolgt, kan vi kansellere bestillingen og betale tilbake hele beløpet.",
    "pol.questions": "Spørsmål? Send en e-post til {email}.",

    // søk og annet
    "search.ph": "Søk etter varer…", "search.none": "Ingen treff for «{q}».", "search.all": "Se alle {n} treff",
    "search.hint": "Skriv for å søke i butikken.",
    "nf.title": "Siden finnes ikke", "nf.text": "Siden du leter etter finnes ikke.", "nf.back": "Tilbake til butikken",
    "sv.title": "Lagrede varer", "sv.lead": "Varer du har lagret til senere. De lagres på denne enheten.",
    "sv.empty": "Ingen lagrede varer enda", "sv.emptyText": "Trykk på hjertet på en vare for å lagre den her.", "sv.browse": "Se butikken",
    "ft.shop": "Butikk", "ft.help": "Hjelp", "ft.info": "Info", "ft.all": "Alle varer", "ft.rights": "Alle rettigheter forbeholdt.",
    "ft.tag": "Billig og god kvalitet. Kjapp shipping. Selling whatever u want.",
    "load.fail": "Butikken kunne ikke lastes", "load.failText": "Prøv å laste inn siden på nytt om litt.",
    "preview": "Forhåndsvisning: viser endringer som ikke er publisert",
    "skip": "Hopp til innhold",

    cat: { clothing: "Klær", shoes: "Sko", bags: "Vesker", accessories: "Tilbehør", electronics: "Elektronikk", home: "Hjem", other: "Annet" },
  },

  en: {
    "nav.home": "Home", "nav.shop": "Shop", "nav.new": "New in", "nav.request": "Request an item", "nav.about": "About",
    "nav.faq": "FAQ", "nav.contact": "Contact", "nav.saved": "Saved items",
    "a11y.menu": "Open menu", "a11y.search": "Search", "a11y.saved": "Saved items", "a11y.bag": "Shopping bag", "a11y.close": "Close",
    "a11y.lang": "Change language",

    announce: ["Cheap and good quality", "Fast shipping all over Norway", "Selling whatever u want"],

    "hero.eyebrow": "Norway's new favourite shop",
    "hero.title": "Cheap. Good quality. Fast shipping.",
    "hero.text": "We sell whatever you want, at prices that actually make sense. Shipped fast, straight to your door.",
    "hero.cta": "Shop now", "hero.cta2": "Request an item",
    "hero.badge": "Selling whatever u want",
    "f1.t": "Cheap and good quality", "f1.d": "Low prices without cutting corners on quality.",
    "f2.t": "Fast shipping", "f2.d": "We ship quickly, so your order arrives fast.",
    "f3.t": "Selling whatever u want", "f3.d": "Can't find it? Tell us, and we'll get it for you.",
    "home.products.eyebrow": "The shop", "home.products.title": "Latest drops", "home.viewAll": "View all",
    "vault.eyebrow": "In 3D", "vault.title": "Explore the collection.", "vault.text": "Drag or swipe to spin. Tap an item to see it.",
    "vault.prev": "Previous item", "vault.next": "Next item",
    "req.eyebrow": "Selling whatever u want", "req.title": "Can't find what you're looking for?",
    "req.text": "Tell us what you want, and we'll try to get it for you. Cheap, good quality and shipped fast.",
    "req.cta": "Request an item",

    "empty.title": "No products yet", "empty.text": "New products are coming soon. Stay tuned!",

    "shop.title": "Shop", "shop.new": "New in", "shop.lead": "Cheap, good quality and fast shipping.",
    "shop.newLead": "The newest items in the shop.", "shop.searchTitle": "Search: “{q}”",
    "shop.all": "All", "shop.allItems": "All items", "shop.inStock": "In stock only", "shop.allShop": "Whole shop",
    "sort.featured": "Featured", "sort.newest": "Newest", "sort.asc": "Price: low to high", "sort.desc": "Price: high to low",
    "shop.count1": "{n} item", "shop.countN": "{n} items",
    "shop.noMatch": "Nothing here", "shop.noMatchText": "Try removing a filter, or check back soon.", "shop.clear": "Clear filters",
    "tag.sold": "Sold out", "tag.sale": "Sale", "tag.new": "New",
    "save": "Save", "unsave": "Remove from saved", "saved.on": "Saved for later", "saved.off": "Removed from saved",

    "pd.size": "Select size", "pd.sizeOne": "Size", "pd.oneSize": "One size", "pd.sizeErr": "Please select a size first.",
    "pd.add": "Add to bag", "pd.sold": "Sold out", "pd.buy": "Buy now", "pd.share": "Share this item", "pd.copied": "Link copied",
    "pd.left1": "Only 1 left", "pd.leftN": "Only {n} left", "pd.save": "Save {x}",
    "pd.desc": "Description", "pd.ship": "Shipping & returns",
    "pd.perk1": "Cheap and good quality", "pd.perk2": "Fast shipping", "pd.perk3": "14-day returns",
    "pd.related": "You may also like", "pd.gone": "This item is no longer available.",
    "pd.only": "Only {n} in stock, and they're all in your bag",

    "bag.title": "Your bag", "bag.empty": "Your bag is empty", "bag.emptyText": "Find something you like.", "bag.toShop": "Go to shop",
    "bag.subtotal": "Subtotal", "bag.note": "Shipping and discount codes are added at checkout.", "bag.checkout": "Checkout",
    "bag.remove": "Remove", "bag.away": "{x} away from free shipping", "bag.free": "You've unlocked free shipping!",
    "bag.less": "Fewer", "bag.more": "More", "bag.qty": "Qty {n}", "bag.secure": "Safe shopping · Fast shipping",

    "co.title": "Checkout", "co.contact": "Contact", "co.email": "Email", "co.first": "First name", "co.last": "Last name",
    "co.phone": "Phone", "co.optional": "(optional)", "co.address": "Shipping address", "co.street": "Address",
    "co.zip": "Postal code", "co.city": "City", "co.country": "Country", "co.countryDefault": "Norway",
    "co.delivery": "Delivery", "co.standard": "Standard", "co.standardTime": "2–5 business days", "co.express": "Express",
    "co.expressTime": "1–2 business days", "co.payment": "Payment",
    "co.payNote": "After you order, we'll email you payment details within 24 hours. You can pay with Vipps or a payment link.",
    "co.note": "Note", "co.place": "Place order",
    "co.help": "Placing your order opens your email app with everything filled in. Just press send.",
    "co.summary": "Order summary", "co.code": "Discount code", "co.apply": "Apply", "co.removeCode": "Remove",
    "co.discount": "Discount", "co.shipping": "Shipping", "co.free": "Free", "co.total": "Total",
    "co.codeOk": "{code} applied: {p}% off", "co.codeBad": "That code isn't valid", "co.codeRemoved": "Code removed",
    "co.codeEmpty": "Enter a code", "co.secure": "Your details are only sent to {name}",
    "co.emptyTitle": "Your bag is empty", "co.emptyText": "Add something you like, then come back here.",

    "ord.eyebrow": "Order {n}", "ord.title": "Thank you!", "ord.titleName": "Thank you, {name}!",
    "ord.lead": "Your email app should have opened with your order. Press send to confirm it.",
    "ord.vipps": "Pay with Vipps to {num}", "ord.pay": "Pay now", "ord.resend": "Open email again", "ord.copy": "Copy order",
    "ord.copied": "Order copied", "ord.help": "Email didn't open? Copy your order and send it to {email}.",
    "ord.missing": "We couldn't find that order on this device. Check your email.",
    "ord.mailSubject": "Order {n} – {total}",

    "rq.title": "Request an item", "rq.lead": "Selling whatever u want. Tell us what you're looking for, and we'll check if we can get it for you. Cheap and in good quality.",
    "rq.s1": "Tell us what you want", "rq.s1d": "Fill in the form below.", "rq.s2": "We find it", "rq.s2d": "We reply with a price within 48 hours.",
    "rq.s3": "Fast delivery", "rq.s3d": "Straight to your door.",
    "rq.name": "Name", "rq.email": "Email", "rq.item": "What do you want?", "rq.itemPh": "e.g. hoodie, sneakers, earbuds",
    "rq.link": "Link or picture", "rq.size": "Size or colour", "rq.budget": "Budget", "rq.more": "Anything else we should know?",
    "rq.send": "Send request", "rq.sent": "Your email app opened. Press send.", "rq.subject": "Request: {item}",

    "about.title": "About {name}",
    "about.text": "{name} is a Norwegian online shop with one simple idea: things you actually want, at a price that makes sense. We keep prices low, look after quality and ship fast, straight to your door.\n\nCan't find what you're looking for? Selling whatever u want. Just ask.",
    "about.v1": "Cheap", "about.v1d": "Prices that make sense.", "about.v2": "Good quality", "about.v2d": "We check items before they ship.",
    "about.v3": "Fast", "about.v3d": "Quick shipping all over Norway.",
    "ct.title": "Contact us", "ct.lead": "Questions about an item or an order? We usually reply within one day.",
    "ct.name": "Name", "ct.email": "Email", "ct.order": "Order number", "ct.msg": "Message", "ct.send": "Send message",
    "ct.sent": "Your email app opened. Press send.", "ct.subject": "Message from {name}",
    "faq.title": "Frequently asked questions", "faq.more": "Didn't find your answer?", "faq.contact": "Contact us",
    faq: [
      ["How long does shipping take?", "We ship orders fast, usually within 1–2 business days. Standard delivery takes 2–5 business days in Norway, and express takes 1–2 business days."],
      ["How do I pay?", "After you order, we'll email you payment details within 24 hours. You can pay with Vipps or a payment link. Your items are held for you."],
      ["Can I request an item?", "Yes! Selling whatever u want. Use the “Request an item” page and we'll check if we can get it for you."],
      ["Can I return an item?", "Yes. You have a 14-day right of withdrawal. Unused items can be returned within 14 days of delivery. Email us to start a return."],
      ["Do you ship outside Norway?", "Send us an email and we'll work something out."],
    ],

    "pol.eyebrow": "Policies", "pol.shipping": "Shipping", "pol.returns": "Returns", "pol.privacy": "Privacy", "pol.terms": "Terms of sale",
    "pol.shippingText": "We pack and ship orders fast, usually within 1–2 business days. Standard delivery takes 2–5 business days. Express takes 1–2 business days. You'll get a tracking number by email once your parcel ships. Shipping is free over the amount shown at checkout.",
    "pol.returnsText": "You have a 14-day right of withdrawal after you receive your item. Items must be unused and in the condition they arrived. Email us to start a return and we'll send instructions. Refunds are paid no later than 14 days after we receive the item.",
    "pol.privacyText": "We only collect what we need to process your order: your name, email and shipping address. We never sell or share your information. Your bag and saved items are stored only on your own device.",
    "pol.termsText": "Prices and stock can change without notice. By placing an order you agree to pay the total shown at checkout. If an item sells out, we may cancel the order and refund the full amount.",
    "pol.questions": "Questions? Email {email}.",

    "search.ph": "Search products…", "search.none": "No results for “{q}”.", "search.all": "View all {n} results",
    "search.hint": "Type to search the shop.",
    "nf.title": "Page not found", "nf.text": "The page you're looking for doesn't exist.", "nf.back": "Back to the shop",
    "sv.title": "Saved items", "sv.lead": "Items you've saved for later. They're stored on this device.",
    "sv.empty": "Nothing saved yet", "sv.emptyText": "Tap the heart on any item to keep it here.", "sv.browse": "Browse the shop",
    "ft.shop": "Shop", "ft.help": "Help", "ft.info": "Info", "ft.all": "All products", "ft.rights": "All rights reserved.",
    "ft.tag": "Cheap and good quality. Fast shipping. Selling whatever u want.",
    "load.fail": "The shop couldn't load", "load.failText": "Please refresh the page in a moment.",
    "preview": "Preview mode: showing unpublished changes",
    "skip": "Skip to content",

    cat: { clothing: "Clothing", shoes: "Shoes", bags: "Bags", accessories: "Accessories", electronics: "Electronics", home: "Home", other: "Other" },
  },
};
