# Security policy

## Supported versions

idocs is early software (0.x). Security fixes go into the latest release only.

| Version | Supported |
|---|---|
| Latest 0.x release | Yes |
| Anything older | No: please upgrade |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/The-Package-Labs/idocs/security/advisories/new)). If that option is not available, open a public issue that says only that you have a security report, with no details, and a maintainer will arrange a private channel.

Please include:

- what you found and why it matters
- the smallest diagram, page or command that reproduces it
- the version of each `@packagelab/idocs-*` package, `idocs` and `create-idocs` you used, plus Node and browser versions

You can expect an acknowledgement within a few days. We will keep you informed, agree a fix and a disclosure date with you, and credit you in the release notes unless you prefer otherwise.

## What counts

idocs turns text you control into HTML and JavaScript on your site, so these are the things we care most about:

- **Script injection.** Markdown in diagrams and node docs is rendered at build time with raw HTML dropped, and the result is injected into the page. Any way for diagram content to run script is a vulnerability.
- **Reading files it should not.** The loader reads `nodes/*.md`, `scenarios/*.yaml` and local icon files relative to a diagram's folder and refuses paths that escape it. A way around that is a vulnerability.
- **The scaffolder and CLI** writing outside the folder you asked for, or running something you did not ask for.
- **Supply chain** problems in what we publish: tampered packages, unexpected install scripts, a dependency pulled in by mistake.

Diagrams are written by the people who run the site. Treat YAML from an untrusted source the way you would treat any other code you build and publish.
