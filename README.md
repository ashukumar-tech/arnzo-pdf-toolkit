# ARNZO PDF Toolkit

Free, privacy-first PDF utilities that run entirely in your browser.

**Planned live site:** https://pdf.arnzo.com/

## Privacy by design

PDF files are processed locally on the user's device. The application does not upload PDF contents to an ARNZO server and does not require an account or backend.

## Available in the initial release

- Merge multiple PDF files
- Extract selected pages into a new PDF
- Delete selected pages
- Rotate PDF pages
- Convert JPG and PNG images to PDF

More tools will be added after browser-side testing.

## Technology

- React + TypeScript + Vite
- [pdf-lib](https://pdf-lib.js.org/) for PDF editing
- Browser File API, Blob and object URLs

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Contribution and security

Do not commit API keys, credentials, private documents, or secrets. Do not add server-side PDF uploads or analytics that inspect document contents. Large files may be limited by the memory available in the user's browser.

## License

MIT
