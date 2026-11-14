// Prices (₹ per 1000). Edit the numbers here. This one file is used by the website AND the server.
(function (root, data) {
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.SITE_RATES = data;
})(this, {
  "minQty": 100,
  "maxQty": 1000000,
  "rates": {
    "Instagram": {
      "Followers": 320,
      "Likes": 120,
      "Views": 60
    },
    "Facebook": {
      "Followers": 300,
      "Likes": 150,
      "Views": 80
    },
    "YouTube": {
      "Subscribers": 1200,
      "Likes": 200,
      "Views": 400
    },
    "Telegram": {
      "Members": 200,
      "Views": 40
    },
    "X": {
      "Followers": 500,
      "Likes": 250,
      "Views": 100
    },
    "WhatsApp": {
      "Channel followers": 400
    }
  }
});
