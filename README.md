# ARNZO PDF Toolkit

Free, privacy-first PDF utilities that run entirely in your browser.

**Live site:** https://pdf.arnzo.com/

## Privacy by design

PDF files are processed locally on the user's device. The application does not upload PDF contents to an ARNZO server and does not require an account or backend. ZIP archives and converted files are generated locally in the browser.

## Tools

- Merge multiple PDF files
- Compress PDFs by rasterizing pages at a selectable JPEG quality (text and links are not preserved)
- Split selected pages into individual PDFs (ZIP download)
- Rotate PDF pages
- Delete selected pages
- Extract selected pages into a new PDF
- Convert JPG and PNG images to PDF
- Export PDF pages as PNG images (ZIP download)

## Technology

- React + TypeScript + Vite
- [pdf-lib](https://pdf-lib.js.org/) for PDF editing
- [PDF.js](https://mozilla.github.io/pdf.js/) for browser-side page rendering
- [JSZip](https://stuk.github.io/jszip/) for local ZIP exports
- Browser File API, Canvas, Blob and object URLs

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

Pull requests are welcome. The GitHub Actions build workflow checks production compilation on pushes and pull requests to `main`.

## License

MIT
