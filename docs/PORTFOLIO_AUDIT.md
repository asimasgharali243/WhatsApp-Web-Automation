# Documentation and portfolio improvement plan

> **Review status:** This document is an audit note, not evidence that the application has been executed. Documentation work is isolated to `docs/portfolio-professionalization-2026`; the default branch remains unchanged.

## Purpose

WhatsApp invoice automation server using Express and whatsapp-web.js.

## Repository structure observed

`src/, package.json, ecosystem.config.js`

## How to run / verify

npm ci; npm run dev for development or npm start. Requires authorized WhatsApp session and configured external services.

**Verification:** Startup commands above are preliminary and must be checked against the exact project version, lockfiles, configuration, database requirements, and OS before being presented as verified instructions. Never commit actual `.env` files or credentials.

## Documentation deliverables

- [ ] Rewrite the root README with purpose, audience, features confirmed in source, tech stack and repository map
- [ ] Add prerequisites, environment variable names (no values), install, database/migration and startup steps
- [ ] Document architecture, major modules, data flow, API surfaces and important design decisions
- [ ] Add tests, build, packaging and troubleshooting instructions based on actual scripts
- [ ] Add security, privacy, licensing and deployment caveats as applicable
- [ ] Capture **real application screenshots** after successfully running the project; place in `docs/screenshots/`
- [ ] Add meaningful captions and alt text, explain each real screen and note capture conditions
- [ ] Review screenshots for personal data, credentials, QR codes, user identities and private business records
- [ ] Verify README links, commands and screenshots before merging

## Screenshot evidence protocol

Screenshots must be produced by running the application, not generated mockups. Record the operating system, launch command, app version/commit, and whether test/demo data was used. If a required service, credential or GUI runtime is unavailable, mark screenshots **not captured** rather than substituting fabricated images.

## Review checklist

- [ ] Every described feature is supported by code or a verified demo
- [ ] No secrets, session files, private data or credentials included
- [ ] All instructions tested in a clean environment where practical
- [ ] Existing application behavior preserved
- [ ] README is accurate, readable and accessible

This checklist is a starting point for the project-specific documentation review.