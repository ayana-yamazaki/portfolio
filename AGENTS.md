## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)


## Editing workflow

This site is developed through frequent, small design iterations.

For ordinary copy, styling, spacing, layout, and content changes:

- Make only the requested changes.
- Preserve everything not mentioned by the user.
- Do not run `npm run build`.
- Do not run tests, lint, browser QA, screenshots, or deployment.
- Do not start or restart the development server.
- Do not inspect unrelated files.
- Keep responses concise.

Run build, tests, visual QA, or deployment only when the user explicitly
requests that action in the current message.

When multiple changes are requested together, apply all changes in one patch.

## Deployment

When the user instructs you to deploy:

- Treat the instruction as standing authorization to publish the site externally.
- Complete the deployment with public access; do not stop at a private or owner-only deployment.
- After deployment, verify that the site's access mode is public.
- Return the public production URL.
