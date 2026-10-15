# What owners and members hate, what's missing, and what we build

**Sample: 252 reviews from 2 sources.** 249 come from the Apple App Store (India and US storefronts, through Apple's official RSS feed) and 3 from Hacker News (through the Algolia API).
By app: myBillBook 100, Account Manager – Ledger Book 81, RentOk Tenant 50, DGymbook 9, GymOps 7, My PG Mitra 3.

**Read this first: the evidence is thin.**
- Apple's feed returned no reviews for Khatabook, OkCredit, Vyapar, Classplus, Teachmint, RentOk (owner app), GymBook or Mess Book.
- Reddit, Capterra, G2 and Trustpilot all returned 403 to direct requests.
- Google Play is where most Indian users write reviews, and its terms don't allow scraping it.
- There is **no tuition or mess evidence at all**. Gym evidence is 16 short, mostly positive reviews.
- Before betting money on any of this, read 50 or more Google Play reviews per competitor in a browser and add them to `reviews.csv`.

Counts come from targeted regexes over `reviews.csv`, then a read by hand. A count can include a few positive mentions; for example, "support" also matches DGymbook reviews praising its support.

## 1. What they hate

1. **Support disappears once you've paid.** About 43 matches across 5 apps; mostly myBillBook.
   - "The customer support team is only active while purchasing the membership and after that the don't care at all" ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-13185641805))
   - "It is now almost entirely AI-based, making it very difficult to connect with a human support representative." ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-14272594870))
2. **Billing traps: price hikes, limits changed after purchase, no way to cancel.** About 18 matches across 3 apps.
   - "Now they are saying you can run only 2 businesses and if you want to add another business you have to buy subscription" ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-14532051046))
   - "बिना information दिए subscription का price ₹800 से बढ़ाकर ₹4000+GST कर दिया" ("raised the subscription price from ₹800 to ₹4000+GST without telling us") ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-13143073578))
3. **The member side gets a raw deal: deposits, notice periods, extra fees.** 14 matches, almost all from RentOk Tenant (1 app, so treat as thin).
   - "Later, when I tried to submit notice on the app, the app did not allow me to do so. Now the management is claiming that notice was not submitted" ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-13787370850))
   - "They have convince charge. Useless app. I would much rather pay the landlord" ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-14422655510))
   - "It's just an app which benefits the pg owners only but the tenets are always in loss" ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-14369964771))
4. **Forced KYC, OTP and login steps before you can do anything.** 13 matches from 1 app (thin).
   - "I've done kyc almost 30 times, the pop up still doesn't go" ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-12738242107))
5. **Ads in a money app.** 12 matches.
   - "You click once on something to actually use the app and it's straight to another long commercial." ([Account Manager](https://apps.apple.com/in/app/id1609755155?see-all=reviews#review-13934450471))
6. **Receipts and PDFs that won't download.** 8 matches across 3 apps.
   - "I raised a ticket 1723741420711 for unable to download rent receipt. No resolution even after a week." ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-11653621198))
   - "Everytime i try to download invoice it keeps loading and loading and loading." ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-12660976367))
7. **Lost data.** 3 matches from 1 app (thin).
   - "my old phone which had the app stopped working and i lost all my backup" ([Account Manager](https://apps.apple.com/in/app/id1609755155?see-all=reviews#review-11201791955))
8. **Charged twice for the same thing.** 2 matches (thin).
   - "Two time same bill got for gas. I have already paid November gas bill then also you send link again." ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-13550342707))

## 2. What is missing

1. **A running balance and a statement for a chosen date range.** 6 matches from 1 app.
   - "Instead of four columns (date, description, debit, credit), there should've been five (balance)." ([Account Manager](https://apps.apple.com/in/app/id1609755155?see-all=reviews#review-14478531930))
   - "a feature for displaying ledger from give date to following date With opening balance of last ledger so it can be short and easy to send to clients" ([Account Manager](https://apps.apple.com/in/app/id1609755155?see-all=reviews#review-14091895015))
2. **Monthly and Excel reports.** About 12 matches across 5 apps.
   - "Can't get monthly or weekly report. Can't get transaction in excel format" ([Account Manager](https://apps.apple.com/in/app/id1609755155?see-all=reviews#review--9459040308))
3. **The payment message should show the total still owed.** 1 match (thin).
   - "when we enter receive amount then customer not received total dues amount." ([myBillBook](https://apps.apple.com/in/app/id1612498254?see-all=reviews#review-13778994426))
4. **Multiple outlets and staff permissions.** 4 matches. Already built here.
   - "The ability to handle multiple outlets, track expenses, and manage staff permissions is just what I needed." ([GymOps](https://apps.apple.com/in/app/id6738783275?see-all=reviews#review-12187413758))
5. **A way to remove members who left.** 1 match. Already built here as "Mark as Left".
   - "one important feature I was expecting is the option to remove members who have quit the gym" ([DGymbook](https://apps.apple.com/in/app/id1615039772?see-all=reviews#review-13146736680))
6. **Reminders that aren't overwhelming.** 1 match (thin).
   - "Too aggressive in reminders" ([RentOk Tenant](https://apps.apple.com/in/app/id1498355410?see-all=reviews#review-13477915544))

## 3. What is unsolved

- **No record that both sides trust.** Owner apps treat the member, tenant or student as someone to collect from. Members then fight over deposits, notice dates and duplicate bills, and have no record of their own to point to. Nobody gives both sides the same view of the ledger. (Theme 3 above.)
- **Cash and direct UPI are how money actually moves.** "most people opt to do it in cash/check" ([HN, a landlord with 30 units](https://news.ycombinator.com/item?id=2144194)). Payment-gateway apps add convenience fees, and members resent them (theme 3). This app already does UPI-direct with no fee, which is right.
- **Gym, tuition and mess owners** are each served by many small apps, with no evidence here about what they hate. **Unknown until Google Play reviews are read.**

## 4. Fix plan

| # | Build | Size | Evidence | Skill |
|---|---|---|---|---|
| F1 | **Member statement link**: one read-only link per member, shared on WhatsApp. It shows every due and payment with a running balance and a tap-to-pay UPI button. No app, no login, no KYC, no fee. The owner can revoke it. | M | Unsolved #1; hate 3, 4, 6; missing 1 | replica-backend + replica-build |
| F2 | **Receipt per payment**: a printable receipt page and a WhatsApp "received ₹X, balance ₹Y" message. | S | Hate 6; missing 3 | replica-build |
| F3 | **Running balance** in the member ledger. | S | Missing 1 | replica-build |
| F4 | **Duplicate-due guard**: a unique index on subscription + period, so a cycle can never be billed twice even if the job runs twice at once. | S | Hate 8 | replica-backend |
| F5 | **Reminder spacing the owner controls** (every 3, 5 or 7 days) instead of a fixed 3. | S | Missing 6 | replica-backend |
| F6 | **Full backup export** of every member, due and payment as JSON, alongside the existing CSV. | S | Hate 7 | replica-backend |
| F7 | **Deposit and notice tracking (hostel)**: the deposit held and refunded, and the notice date stamped and visible on the member's statement link. | M | Hate 3 | replica-backend + replica-build |
| F8 | **Honest pricing**: flat price, no per-business upsell, cancel anytime, no ads. | n/a | Hate 1, 2, 5 | replica-launch |

## 5. The angle

**A.** For hostel, mess, gym and tuition owners who are tired of members arguing about what they owe, *[app]* gives each member a link to the same ledger the owner sees. One WhatsApp link, no app to download, no fee on UPI.
Evidence: the member-side complaints (theme 3, 14 reviews) and receipts (theme 6, 8 reviews). Mostly one source, so thin.

**B.** For small-business owners burned by billing apps that sell hard and then go silent, *[app]* has one flat price, no ads, no upsell per branch, and your data is exportable any day.
Evidence: support (about 43) and billing traps (about 18), almost all from myBillBook. Strong but from a single app.

**C.** For owners who collect in cash and UPI, not through gateways, *[app]* records it in two taps and reminds members without spamming them.
Evidence: thin (1 HN comment, 1 reminder complaint).

**Recommendation: A, with B as the pricing promise.** A is the only one competitors can't easily copy: their business model puts them on the owner's side and charges members fees. It's also cheap to build on this codebase because balances are already derived rather than stored. B costs nothing to promise.
