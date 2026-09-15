# Vendored dependencies

Served locally; the deployed page does not depend on a CDN at runtime.

- Marked 18.0.11 — https://github.com/markedjs/marked — MIT. See marked-LICENSE.md.
- DOMPurify 3.4.15 — https://github.com/cure53/DOMPurify — Apache-2.0 OR MPL-2.0. See DOMPurify-LICENSE.

Markdown is parsed by Marked then sanitized by DOMPurify before display. Major headlines use Helvetica Neue / Helvetica / Arial at weight 700, with system Chinese fallbacks. No font binaries are distributed.
