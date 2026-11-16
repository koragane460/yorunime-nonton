# YoruNime — Late-night cinema

## Design read

Reading this as a mobile-first anime streaming app for Indonesian fans who watch at night, in a cinematic editorial style, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

The app is dark because it is a video product used in low light, not because dark is a trend. It should feel like a printed film programme under a dim lamp: calm, precise, and image-led.

## Identity

- **Palette:** ink `#0A0B0D`, raised ink `#121417`, bone `#F5F0E8`, vermilion `#D33E30`, mint `#74DFC2`, muted gold `#E6C47C`.
- **One accent:** vermilion marks action, selection, and attention. Mint is reserved for real progress and live state. Gold is reserved for premium and level, never for ordinary navigation.
- **Type:** Manrope for interface text; Bricolage Grotesque for display weights; Instrument Serif only for large cinematic titles. Space Mono keeps numbers, time, and IDs aligned.
- **Motif:** the Yoru slash. A small vermilion `/` precedes editorial section labels. It is a typographic signature, not decoration on every card.
- **Shape:** cards use a 14 px radius. Controls use 12 px. Chips alone are pill-shaped. Media cards get a single cut corner on the top-right, like a film still torn from a contact sheet.
- **Motion:** state transitions and page entrances only. No endless glow, floating, pulsing, or ambient ornament. Reduced motion is respected.

## Layout

- Mobile is the primary canvas, clamped to 430 px on wider screens.
- Header: identity and progress first, search second, actions third.
- Home order: account, hero, continue watching, discovery, ongoing, reading, film, community, optional premium.
- Bottom navigation: five labelled destinations, solid surface, clear active state, no glass gradients.
- Touch targets at least 44 px.
- Full-screen routes keep the same 430 px width and safe-area insets.

## Rules

1. Use tokens, not new one-off gradients.
2. A card earns elevation through a hairline and one shadow, not glow.
3. Empty, loading, and error states name the cause and the next action.
4. Numbers are real or absent.
5. Every visual change has a one-line reason in the code or here.
