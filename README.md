# laylatul-code

The website for **laylatul-code**, a studio that designs and builds websites for customers. Visitors pick the kind of website they need, choose features and a package, and send the request to us on WhatsApp or by email.

The site is plain HTML, CSS and JavaScript. There is no framework, no build step and no `npm install`.

## What's in here

| Path | What it is |
|---|---|
| `laylatul-code/index.html` | The whole page: hero, sections, request form, FAQ, footer |
| `laylatul-code/assets/style.css` | All styles. Colours live as variables at the top (`:root`) |
| `laylatul-code/assets/app.js` | All behaviour (see the map below) |
| `design-package.md` | The original design plan: copy, section order, pacing. The colours have since changed from cyan to black and orange |
| `.claude/launch.json` | Local preview server config for Claude Code |

### Map of `app.js`

1. **Settings** at the very top: WhatsApp number, email, AI video switch
2. **Hero captions** that fade in and out as you scroll
3. **Data-centre journey** (`drawNight`, `drawHall`, `drawGate`): fly down a glowing server hall with a gate at each bay, drawn on a canvas
4. **Optional scroll video** loader, switched off until a video exists (`HAS_VIDEO`)
5. **Static hero rules** for reduced motion, short landscape phones, and phones too slow for the journey (`slowPhone`). The `GATES` list must match the CSS media query exactly
6. **Section animations**: strike-throughs, timeline line, reveals
7. **Request builder**: the live blueprint sketch, and sending to WhatsApp or email
8. **Solar orb** (`drawOrb`): the golden orb at the end of the hero
9. **Tech layer**: data rain, code characters, network, atoms across the page
10. **Custom cursor**: glowing core, ring and sparks (mouse devices only)

## Run it locally

You need [Node.js](https://nodejs.org). From the repository folder:

```bash
npx http-server laylatul-code -p 8080 -c-1
```

Then open http://localhost:8080 in Chrome. Double-clicking `index.html` also works, but use the server to see everything exactly as visitors will.

## Before going live

- [ ] Put the real WhatsApp number in `WHATSAPP_NUMBER` at the top of `app.js` (digits only, with country code, for example `919876543210`)
- [ ] Confirm the promises written on the site are true: delivery times (about 7 days, 2 to 3 weeks, 3 to 6 weeks), 50% to start and 50% before launch, free small edits for 30 days, a reply within one working day
- [ ] Replace `og:url` and `og:image` in `index.html` (marked `DEPLOY STEP`) with the live address
- [ ] Add real past work and real customer reviews when we have them. There are none on the site on purpose, so nothing is made up

## Working together

- `main` is the version that can go live. Don't commit straight to it.
- For each change, make a branch (`git switch -c fix-pricing-text`), commit there, push it, and open a pull request.
- One other person reviews and approves the pull request, then it gets merged into `main`.
- Pull often (`git pull`) so you're working on the latest version.
- Keep big files (raw videos, design source files) out of the repository.

### House rules for the code and copy

- Animate only `transform` and `opacity` in CSS, so things stay smooth.
- Every animation must respect `prefers-reduced-motion` (there are examples throughout).
- Site copy: no em dashes, and none of these words: leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions. Write plainly.
- Test on a phone width (375px) as well as desktop before opening a pull request.

## Deploying

The site is static. To publish, upload the **contents** of the `laylatul-code` folder (`index.html` and `assets/`) to any static host, not the folder itself.
