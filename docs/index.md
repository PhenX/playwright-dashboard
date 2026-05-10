---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Playwright Dashboard"
  text: "Store and visualise your Playwright test results"
  tagline: A modern dashboard built with Nuxt 4. Organise runs by project, drill down into failures, view traces, compare performance, and analyse network requests — all in one place.

  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/PhenX/playwright-dashboard

features:
  - icon: 📊
    title: Test results storage
    details: Store complete Playwright test run data — status, duration, retries, errors, and more — in a lightweight SQLite database.
  - icon: 🎯
    title: Project organisation
    details: Tests are organised by project. Unknown projects are automatically created when results are submitted via API.
  - icon: 📈
    title: Performance tracking
    details: Step-level timing, avg/P90 duration trends, slowest-tests analysis, and side-by-side run comparison.
  - icon: 🌐
    title: Network request analysis
    details: Find slow API endpoints grouped by HTTP method and normalised route (e.g. `/api/users/:id`).
  - icon: 🔬
    title: Browser Web Vitals
    details: Capture TTFB, DOMContentLoaded, FCP and more via the Performance API, displayed with colour-coded thresholds.
  - icon: 🔌
    title: Playwright reporter
    details: Drop-in custom reporter that automatically uploads results, HTML reports, and trace files after each run.
  - icon: 🔐
    title: Authentication
    details: Optional role-based access control with administrator, reporter, and user roles.
  - icon: ☁️
    title: Flexible storage
    details: Local file storage by default, or S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces, Cloudflare R2).
  - icon: 🐳
    title: Docker support
    details: Pre-built multi-platform container images (~200 MB) available on GitHub Container Registry.
---
