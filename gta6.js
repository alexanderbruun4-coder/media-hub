/* ============================================================
   GTA6.JS — behaviour for gta6.html

   Four small things, no dependencies:
     1. live countdown to launch
     2. the Leonida region tab panel
     3. gameplay-system category filter
     4. nav scroll-spy + mobile nav toggle
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     1. COUNTDOWN
     Local midnight on launch day, so the number matches
     whatever timezone the reader is actually in.
     ---------------------------------------------------------- */

  var LAUNCH = new Date(2026, 10, 19, 0, 0, 0); // month is 0-indexed: 10 = November

  var els = {
    days: document.getElementById("cdDays"),
    hours: document.getElementById("cdHours"),
    mins: document.getElementById("cdMins"),
    secs: document.getElementById("cdSecs"),
    note: document.getElementById("countdownNote"),
    navDays: document.getElementById("navDays")
  };

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function tick() {
    var diff = LAUNCH - new Date();

    if (diff <= 0) {
      els.days.textContent = "00";
      els.hours.textContent = "00";
      els.mins.textContent = "00";
      els.secs.textContent = "00";
      els.note.textContent = "Grand Theft Auto VI is out. Go play it.";
      els.navDays.textContent = "Out now";
      clearInterval(timer);
      return;
    }

    var secs = Math.floor(diff / 1000);
    var d = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;

    els.days.textContent = String(d);
    els.hours.textContent = pad(h);
    els.mins.textContent = pad(m);
    els.secs.textContent = pad(s);
    els.navDays.textContent = d + (d === 1 ? " day left" : " days left");
  }

  tick();
  var timer = setInterval(tick, 1000);

  /* ----------------------------------------------------------
     2. REGIONS
     Content lives here rather than in the HTML because only one
     panel is ever visible; keeping it as data avoids shipping
     six hidden copies of the same markup.
     ---------------------------------------------------------- */

  var REGIONS = {
    "vice-city": {
      name: "Vice City",
      real: "Inspired by Miami, Florida",
      blurb:
        "The heart of the map and the series' first return to Vice City since 2002. Previews put it at roughly twice the size of GTA 5's Los Santos on its own, before the rest of Leonida is counted.",
      points: [
        "Beachfront strips, art-deco frontages and high-rise waterfront towers",
        "Nightlife is a genuine system: clubs, strip clubs and the music scene that Boobie Ike and Dre'Quan operate in",
        "Dense enough that Rockstar rebuilt crowd tech for it — 600,000+ NPC animations against GTA 5's ~55,000",
        "Rockstar has not named individual districts beyond the city itself"
      ]
    },
    keys: {
      name: "Leonida Keys",
      real: "Inspired by the Florida Keys",
      blurb:
        "An island chain trailing off the southern tip of the state, connected by long causeway bridges. This is where Jason lives when the story opens, running work for local traffickers.",
      points: [
        "Marinas, stilt houses and small coastal communities strung between bridges",
        "Boats, jet skis and SCUBA diving are all shown here",
        "Brian Heder's operation is based in the Keys",
        "Featured heavily in both Trailer 1 and Trailer 2"
      ]
    },
    grassrivers: {
      name: "Grassrivers",
      real: "Inspired by the Everglades",
      blurb:
        "Wetlands, sawgrass and slow brown water. The most obviously lawless part of the map — the place things get taken to when they need to disappear.",
      points: [
        "Fan boats are the way through it, and they're playable",
        "Wildlife is a tracked system here: you can study animals and fill in a checklist",
        "Rivers, channels and rural back roads rather than highway",
        "Shown in Trailer 2 and again in the Extended Look"
      ]
    },
    "port-gellhorn": {
      name: "Port Gellhorn",
      real: "Inspired by the Florida Panhandle coast",
      blurb:
        "A working port town on the other end of the state's fortunes from Vice City — industrial waterfront, faded shopfronts and neighbourhoods built around jobs that left.",
      points: [
        "Introduced properly in Trailer 2",
        "Industrial docks, warehouses and a run-down commercial strip",
        "Reads as the map's blue-collar counterweight to Vice City's excess"
      ]
    },
    ambrosia: {
      name: "Ambrosia",
      real: "Rural inland Leonida",
      blurb:
        "Old-school Americana near Lake Leonida: sugar refineries, biker bars, county sheriffs and long straight roads between them.",
      points: [
        "Agricultural and industrial interior — refineries and processing plants",
        "Biker culture and small-town law enforcement",
        "Backyard wrestling, one of the odder confirmed activities, fits this part of the state"
      ]
    },
    kalaga: {
      name: "Mount Kalaga National Park",
      real: "Northern Leonida wilderness",
      blurb:
        "Forested high ground in the north of the state and the closest thing GTA 6 has to Red Dead Redemption 2's mountains — the map's one genuine break from the coast.",
      points: [
        "Elevation, dense forest and hiking country",
        "Canoeing, kayaking and wildlife study belong here",
        "Named directly by Rockstar as a confirmed region"
      ]
    }
  };

  var regionPanel = document.getElementById("regionPanel");
  var regionBtns = Array.prototype.slice.call(document.querySelectorAll(".region-btn"));

  function renderRegion(key) {
    var r = REGIONS[key];
    if (!r) return;

    var list = new Array(r.points.length + 1).join("<li></li>");

    regionPanel.innerHTML =
      "<h3></h3><p class='region-real'></p><p></p><ul class='region-points'>" +
      list +
      "</ul>";

    // Fill via textContent so nothing in the data can inject markup
    regionPanel.querySelector("h3").textContent = r.name;
    regionPanel.querySelector(".region-real").textContent = r.real;
    regionPanel.querySelectorAll("p")[1].textContent = r.blurb;
    regionPanel.querySelectorAll(".region-points li").forEach(function (li, i) {
      li.textContent = r.points[i];
    });
  }

  regionBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      regionBtns.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      renderRegion(btn.dataset.region);
    });
  });

  renderRegion("vice-city");

  /* ----------------------------------------------------------
     3. GAMEPLAY FILTER
     Cards can carry several categories in data-cat, space
     separated, so "Focus" shows under both World and Crime.
     ---------------------------------------------------------- */

  var filters = Array.prototype.slice.call(document.querySelectorAll(".filter"));
  var sysCards = Array.prototype.slice.call(document.querySelectorAll(".sys"));
  var sysEmpty = document.getElementById("sysEmpty");

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var want = btn.dataset.filter;
      var shown = 0;

      filters.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");

      sysCards.forEach(function (card) {
        var cats = (card.dataset.cat || "").split(/\s+/);
        var match = want === "all" || cats.indexOf(want) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });

      sysEmpty.hidden = shown > 0;
    });
  });

  /* ----------------------------------------------------------
     4. NAV — scroll-spy + mobile toggle
     ---------------------------------------------------------- */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".g6-links a"));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (a) {
            a.classList.toggle(
              "is-current",
              a.getAttribute("href") === "#" + entry.target.id
            );
          });
        });
      },
      // Trigger when a section crosses the upper third of the viewport
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  }

  var navToggle = document.getElementById("navToggle");
  var linksWrap = document.getElementById("g6links");

  navToggle.addEventListener("click", function () {
    var open = linksWrap.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  linksWrap.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      linksWrap.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
})();
