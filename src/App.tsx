import { useRef, useState } from 'react'
import { FilePlus2, Files, Scissors, RotateCw, Trash2, FileImage, ShieldCheck, LockKeyhole, ArrowDownToLine, X, ChevronDown, Menu, CheckCircle2, AlertCircle, LoaderCircle, FileText, Sparkles } from 'lucide-react'
import { PDFDocument, degrees } from 'pdf-lib'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

type Tool = 'merge' | 'split' | 'rotate' | 'delete' | 'extract' | 'images' | 'pdfImages' | 'compress'
type Picked = { id: string; file: File }
const tools: { id: Tool; name: string; desc: string; icon: typeof Files }[] = [
  { id: 'merge', name: 'Merge PDF', desc: 'Combine multiple PDFs into one file', icon: Files },
  { id: 'split', name: 'Split PDF', desc: 'Save selected pages as separate PDFs', icon: Scissors },
  { id: 'rotate', name: 'Rotate PDF', desc: 'Rotate all pages in your document', icon: RotateCw },
  { id: 'delete', name: 'Delete pages', desc: 'Remove unwanted pages from a PDF', icon: Trash2 },
  { id: 'extract', name: 'Extract pages', desc: 'Create a PDF from selected pages', icon: FilePlus2 },
  { id: 'images', name: 'Images to PDF', desc: 'Turn JPG and PNG images into a PDF', icon: FileImage },
  { id: 'pdfImages', name: 'PDF to images', desc: 'Export PDF pages as PNG images', icon: FileImage },
  { id: 'compress', name: 'Compress PDF', desc: 'Reduce file size with image-based compression', icon: FileImage }
]
const uid = () => Math.random().toString(36).slice(2)
const save = (bytes: Uint8Array, name: string) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}
const pageIndexes = (input: string, total: number) => {
  const found = new Set<number>()
  input.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) throw new Error('Use page numbers like 1, 3-5, 8')
    const start = Number(m[1]), end = Number(m[2] || m[1])
    if (start < 1 || end < start || end > total) throw new Error('Page range is outside this PDF')
    for (let n = start; n <= end; n++) found.add(n - 1)
  })
  return [...found].sort((a,b) => a-b)
}
export default function App() {
  const [tool, setTool] = useState<Tool>(() => { const requested = new URLSearchParams(window.location.search).get('tool'); return tools.some(t => t.id === requested) ? requested as Tool : 'merge' })
  const [files, setFiles] = useState<Picked[]>([])
  const [pages, setPages] = useState('')
  const [rotation, setRotation] = useState('90')
  const [compressionQuality, setCompressionQuality] = useState('0.65')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const active = tools.find(t => t.id === tool)!
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const candidates = [...list]
    const accepted = candidates.filter(f => {
      const name = f.name.toLowerCase()
      return tool === 'images' ? (/\.(jpe?g|png)$/.test(name) || ['image/jpeg', 'image/png'].includes(f.type)) : (f.type === 'application/pdf' || name.endsWith('.pdf'))
    })
    const rejected = candidates.length - accepted.length
    setFiles(old => {
      const seen = new Set(old.map(x => `${x.file.name}:${x.file.size}:${x.file.lastModified}`))
      const fresh = accepted.filter(file => !seen.has(`${file.name}:${file.size}:${file.lastModified}`))
      return [...old, ...fresh.map(file => ({ id: uid(), file }))]
    })
    setError(rejected ? `${rejected} unsupported file(s) skipped. Choose ${tool === 'images' ? 'JPG or PNG' : 'PDF'} files.` : '')
    setMessage('')
  }
  const run = async () => {
    setError(''); setMessage(''); setProgress('')
    if (!files.length) { setError('Choose at least one file first.'); return }
    if (files.some(x => x.file.size > 100 * 1024 * 1024)) { setError('A file exceeds the 100 MB per-file limit.'); return }
    if (files.length > 40) { setError('Maximum 40 files per operation.'); return }
    setBusy(true)
    try {
      if (tool === 'compress') {
        if (files.length !== 1) throw new Error('Choose exactly one PDF to compress.')
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
        const pdf = await pdfjsLib.getDocument({ data: await files[0].file.arrayBuffer() }).promise
        const out = await PDFDocument.create()
        for (let n = 1; n <= pdf.numPages; n++) {
          setProgress(`Processing page ${n} of ${pdf.numPages}`)
          const page = await pdf.getPage(n)
          const baseViewport = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 1.25 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Your browser could not create an image canvas.')
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, viewport }).promise
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not compress this page.')), 'image/jpeg', Number(compressionQuality)))
          const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
          const newPage = out.addPage([baseViewport.width, baseViewport.height])
          newPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })
          canvas.width = 0; canvas.height = 0
        }
        save(await out.save({ useObjectStreams: true }), 'arnzo-compressed.pdf')
      } else if (tool === 'pdfImages') {
        if (files.length !== 1) throw new Error('Choose exactly one PDF to convert.')
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
        const pdf = await pdfjsLib.getDocument({ data: await files[0].file.arrayBuffer() }).promise
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        for (let n = 1; n <= pdf.numPages; n++) {
          setProgress(`Exporting page ${n} of ${pdf.numPages}`)
          const page = await pdf.getPage(n)
          const viewport = page.getViewport({ scale: 1.6 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Your browser could not create an image canvas.')
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, viewport }).promise
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not export page image.')), 'image/png'))
          zip.file('page-' + String(n).padStart(3, '0') + '.png', blob)
          canvas.width = 0; canvas.height = 0
        }
        const archive = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(archive)
        const link = document.createElement('a'); link.href = url; link.download = 'arnzo-pdf-images.zip'; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      } else if (tool === 'images') {
        const out = await PDFDocument.create()
        for (const item of files) {
          const bytes = await item.file.arrayBuffer()
          const isPng = item.file.name.toLowerCase().endsWith('.png') || item.file.type === 'image/png'\n          const valid = isPng ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 : bytes[0] === 0xff && bytes[1] === 0xd8\n          if (!valid) throw new Error(`${item.file.name} is not a valid JPG or PNG image.`)\n          setProgress(`Adding image ${files.indexOf(item)+1} of ${files.length}`)\n          const image = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes)
          const page = out.addPage([image.width, image.height])
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        }
        save(await out.save(), 'arnzo-images-to-pdf.pdf')
      } else if (tool === 'merge') {
        if (files.length < 2) throw new Error('Add at least two PDF files to merge.')
        const out = await PDFDocument.create()
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          setProgress(`Merging file ${fileIndex + 1} of ${files.length}`)
          const item = files[fileIndex]
          const raw = new Uint8Array(await item.file.slice(0, 5).arrayBuffer())\n          if (raw[0] !== 0x25 || raw[1] !== 0x50 || raw[2] !== 0x44 || raw[3] !== 0x46 || raw[4] !== 0x2d) throw new Error(`${item.file.name} is not a valid PDF file.`)\n          const src = await PDFDocument.load(await item.file.arrayBuffer())
          const copied = await out.copyPages(src, src.getPageIndices())
          copied.forEach(p => out.addPage(p))
        }
        save(await out.save(), 'arnzo-merged.pdf')
      } else {
        if (files.length !== 1) throw new Error('Choose exactly one PDF for this action.')
        const signature = new Uint8Array(await files[0].file.slice(0, 5).arrayBuffer())\n        if (signature[0] !== 0x25 || signature[1] !== 0x50 || signature[2] !== 0x44 || signature[3] !== 0x46 || signature[4] !== 0x2d) throw new Error('This file is not a valid PDF.')\n        const src = await PDFDocument.load(await files[0].file.arrayBuffer())
        const total = src.getPageCount()
        if (tool === 'rotate') {
          const angle = Number(rotation)
          src.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + angle) % 360)))
          save(await src.save(), 'arnzo-rotated.pdf')
        } else if (tool === 'split') {
          const { default: JSZip } = await import('jszip')
          const selected = pageIndexes(pages, total)
          if (!selected.length) throw new Error('Enter at least one page number.')
          const zip = new JSZip()
          for (const index of selected) {
            const out = await PDFDocument.create()
            const [page] = await out.copyPages(src, [index])
            out.addPage(page)
            zip.file('page-' + String(index + 1).padStart(3, '0') + '.pdf', await out.save())
          }
          const archive = await zip.generateAsync({ type: 'blob' })
          const url = URL.createObjectURL(archive)
          const link = document.createElement('a'); link.href = url; link.download = 'arnzo-split-pages.zip'; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1500)
        } else {
          const selected = pageIndexes(pages, total)
          if (!selected.length) throw new Error('Enter at least one page number.')
          const indexes = tool === 'delete' ? src.getPageIndices().filter(i => !selected.includes(i)) : selected
          if (!indexes.length) throw new Error('You cannot delete every page from a PDF.')
          const out = await PDFDocument.create()
          const copied = await out.copyPages(src, indexes)
          copied.forEach(p => out.addPage(p))
          save(await out.save(), tool === 'delete' ? 'arnzo-pages-removed.pdf' : 'arnzo-extracted-pages.pdf')
        }
      }
      setProgress(''); setMessage('Your PDF is ready. The file was processed on this device.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not process this file. Check that it is a valid PDF.') }
    finally { setBusy(false); setProgress('') }
  }
  const switchTool = (id: Tool) => { setTool(id); setFiles([]); setError(''); setMessage(''); setPages(''); setMenuOpen(false) }
  const moveFile = (index: number, direction: number) => setFiles(old => {
    const next = [...old], target = index + direction
    if (target < 0 || target >= next.length) return old
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">A</span><span>ARNZO<span className="brand-sub">PDF TOOLKIT</span></span></a><nav className={menuOpen ? 'nav-open' : ''}><a href="#tools" onClick={() => setMenuOpen(false)}>All tools</a><a href="#privacy" onClick={() => setMenuOpen(false)}>Privacy</a><a href="https://arnzo.com" target="_blank" rel="noreferrer">ARNZO.com <ArrowDownToLine size={13}/></a></nav><button className="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu/></button></header>
    <main>
      <section className="hero"><div className="eyebrow"><span className="pulse"/> FREE ONLINE PDF TOOLS</div><h1>PDF work. <span>Made simple.</span></h1><p>Everything you need to organize PDF files — fast, free, and private.<br className="desktop"/> Your files stay on your device. Always.</p><div className="trust-row"><span><ShieldCheck size={15}/> 100% browser-based</span><span><LockKeyhole size={15}/> No file uploads</span><span><Sparkles size={15}/> No account needed</span></div></section>
      <section className="workspace" id="tools"><aside className="tool-list"><div className="section-label">PDF TOOLS <span>08</span></div>{tools.map(t => { const Icon=t.icon; return <button key={t.id} className={tool===t.id?'tool-item selected':'tool-item'} onClick={()=>switchTool(t.id)}><Icon size={18}/><span><b>{t.name}</b><small>{t.desc}</small></span><ChevronDown className="tool-chevron" size={15}/></button> })}</aside>
      <section className="panel"><div className="panel-head"><div><div className="panel-kicker">ARNZO WORKSPACE</div><h2>{active.name}</h2><p>{active.desc}</p></div><span className="local-pill"><span/> LOCAL PROCESSING</span></div>
        <div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inputRef.current?.click()}}}><input ref={inputRef} type="file" hidden multiple={tool==='merge'||tool==='images'} accept={tool==='images'?'.jpg,.jpeg,.png':'application/pdf,.pdf'} onChange={e=>{addFiles(e.target.files);e.target.value=''}}/><div className="upload-icon"><FilePlus2 size={23}/></div><b>Drop your {tool==='images'?'images':'PDF'} here</b><span>or <u>browse files</u> from your device</span><small>{tool==='images'?'JPG and PNG supported':'PDF files only'} · Files stay on this device</small></div>
        {files.length>0&&<div className="file-list"><div className="file-list-title">Selected files <span>{files.length}</span></div>{files.map((f, index) => <div className="file-row" key={f.id}><FileText size={17}/><span>{f.file.name}<small>{(f.file.size/1024/1024).toFixed(2)} MB</small></span>{tool === 'merge' && <><button aria-label="Move file up" disabled={index === 0} onClick={() => moveFile(index, -1)}>↑</button><button aria-label="Move file down" disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}>↓</button></>}<button aria-label="Remove file" onClick={() => setFiles(old => old.filter(x => x.id !== f.id))}><X size={16}/></button></div>)}</div>}
        {(tool==='split'||tool==='delete'||tool==='extract')&&<label className="field-label">PAGE NUMBERS <input value={pages} onChange={e=>setPages(e.target.value)} placeholder="e.g. 1, 3-5, 8"/><small>{tool==='delete'?'Pages to remove':'Pages to include'} · Comma-separated ranges</small></label>}
        {tool==='rotate'&&<label className="field-label">ROTATION ANGLE <select value={rotation} onChange={e=>setRotation(e.target.value)}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></label>}
        {tool==='compress'&&<><label className="field-label">IMAGE QUALITY <select value={compressionQuality} onChange={e=>setCompressionQuality(e.target.value)}><option value="0.45">Smaller file · lower quality</option><option value="0.65">Balanced</option><option value="0.82">Higher quality · larger file</option></select></label><p className="compression-warning">Compression converts pages into images. Searchable text, links, forms and vector quality will not be preserved. File size reduction is not guaranteed.</p></>}
        <button className="primary-btn" onClick={run} disabled={busy||files.length===0}>{busy?<><LoaderCircle className="spin" size={18}/> Processing locally…</>:<>Process PDF <ArrowDownToLine size={17}/></>}</button>
        {progress && <div className="notice" role="status">{progress}</div>}{error&&<div className="notice error"><AlertCircle size={17}/>{error}</div>}{message&&<div className="notice success"><CheckCircle2 size={17}/>{message}</div>}
        <p className="panel-foot"><LockKeyhole size={13}/> Files are processed locally in your browser and are never uploaded.</p>
      </section></section>
      <section className="below" id="privacy"><div><span className="section-label">PRIVATE BY DESIGN</span><h2>Your files are yours.<br/><span>Not ours.</span></h2><p>PDF processing happens directly in your browser using open-source libraries. ARNZO does not receive, store, or inspect your PDF documents. No account is required.</p></div><div className="privacy-points"><div><ShieldCheck/><span><b>Local processing</b><small>Your files remain on your device from start to finish.</small></span></div><div><LockKeyhole/><span><b>No server uploads</b><small>PDF contents are not sent to ARNZO servers for processing.</small></span></div><div><CheckCircle2/><span><b>No account required</b><small>Open the tool and get to work. No sign-up.</small></span></div></div></section>
      <section className="content-section" id="how-it-works"><div className="section-label">SIMPLE WORKFLOW</div><h2>How to use ARNZO PDF Toolkit</h2><div className="steps-grid"><article><b>01 · Choose a tool</b><p>Select Merge, Split, Compress, Rotate, Extract, Delete pages or a conversion tool.</p></article><article><b>02 · Add your files</b><p>Choose PDF, JPG or PNG files from your device. Your documents stay in your browser.</p></article><article><b>03 · Process and save</b><p>Run the selected action and download the generated file directly to your device.</p></article></div></section>
      <section className="content-section" id="faq"><div className="section-label">HELP & ANSWERS</div><h2>Frequently asked questions</h2><div className="faq-grid">
        <details><summary>Are ARNZO PDF tools free?</summary><p>Yes. ARNZO PDF Toolkit is free to use and does not require an account.</p></details>
        <details><summary>Are my PDF files uploaded to ARNZO?</summary><p>No. PDF documents are processed locally in your browser. Their contents are not uploaded to ARNZO servers.</p></details>
        <details><summary>How can I merge PDF files?</summary><p>Choose Merge PDF, select at least two PDF files, and click Process PDF. Your combined document downloads to your device.</p></details>
        <details><summary>How do I split or extract pages?</summary><p>Choose Split PDF or Extract pages and enter page numbers such as 1, 3-5. Split downloads separate page PDFs in a ZIP file; Extract creates one PDF with the selected pages.</p></details>
        <details><summary>Does compression keep searchable text?</summary><p>No. The current compression method converts pages into JPEG images. Searchable text, links, forms and vector quality are not retained, and a smaller file is not guaranteed.</p></details>
        <details><summary>Can I use the tools on my phone?</summary><p>The interface supports modern mobile browsers. Very large PDFs may exceed the available memory on some phones.</p></details>
        <details><summary>Which image formats can I convert to PDF?</summary><p>The Images to PDF tool accepts JPG and PNG images.</p></details>
        <details><summary>Do I need to install software?</summary><p>No installation or account is required. Open the website in a modern browser with JavaScript enabled.</p></details>
      </div></section>
    </main>
    <footer className="site-footer"><div className="footer-brand"><a className="brand" href="https://arnzo.com/"><span className="brand-mark">A</span><span>ARNZO<span className="brand-sub">PDF TOOLKIT</span></span></a><p>Free, browser-based PDF utilities from ARNZO. Designed for private document workflows.</p></div><div className="footer-column"><b>PDF TOOLS</b><a href="/merge-pdf/">Merge PDF</a><a href="/split-pdf/">Split PDF</a><a href="/compress-pdf/">Compress PDF</a><a href="/jpg-to-pdf/">Convert images to PDF</a></div><div className="footer-column"><b>ARNZO</b><a href="https://arnzo.com/" target="_blank" rel="noreferrer">ARNZO Home</a><a href="https://arnzo.com/" target="_blank" rel="noreferrer">ARNZO Home</a><a href="#how-it-works">How it works</a><a href="#faq">FAQs</a></div><div className="footer-column"><b>INFORMATION</b><a href="/privacy-policy/">Privacy Policy</a><a href="/terms/">Terms of Use</a><a href="/about/">About ARNZO</a><a href="https://arnzo.com/" target="_blank" rel="noreferrer">ARNZO website</a><a href="/llms.txt">LLM information</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ARNZO PDF Toolkit. All rights reserved.</span><span>Free to use · No account · Browser-based processing</span></div></footer>
  </div>
}