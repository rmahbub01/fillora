# Fillora — Privacy-First AI-Powered PDF Form Detection & Filling

**Fillora** is a modern, high-performance, browser-native PDF form detection and filling web application inspired by [pdf-forms.tools](https://app.pdf-forms.tools/).

It operates **100% on the user's device (client-side)**. Document files, user entries, uploaded fonts, and extracted metadata never leave the browser sandbox.

---

## 🌟 Key Features

### 1. 100% Client-Side Privacy Architecture
- **Zero Server Uploads**: PDFs, user input, and extracted data are processed purely in-memory within the browser.
- **On-Device AI Inference**: Uses `onnxruntime-web` with **WebGPU** acceleration and multithreaded SIMD **WebAssembly (WASM)** fallback.
- **Offline Capable**: All neural models, WASM runtimes, and Bangla fonts are cached locally via the browser Cache API.

### 2. AI-Powered Form Field Detection
Supports both official **CommonForms FFDNet** models running locally in a Web Worker:
- **FFDNet-S (Small)**: ~36 MB, ~6M parameters. Optimized for low-latency client-side CPU/GPU inference.
- **FFDNet-L (Large)**: ~97 MB, ~25M parameters. High accuracy model ideal for complex, irregular, or scanned documents.
- **Instant Visual & AcroForm Detector**: Instant 0ms visual detection for line underlines, boxes, checkboxes, and pre-existing AcroForms.
- **Hybrid Mode**: Combines neural object detection with structural document contours.
- **Detection Scopes**: Detect on the *Current Page* or scan *All Pages*.

### 3. Automatic Text Overlays & Direct Form Filling
- Detected bounding boxes immediately receive perfectly aligned text input overlays.
- **Locked by Default**: Overlays cannot accidentally move or resize while typing, preserving original form alignment.
- **Unlock / Lock Controls**: Toggle lock to freely reposition and resize fields with 8 draggable handles.
- **Auto-Fit Typography**: Dynamically scales font size to fit field dimensions, with manual override sliders.
- **Single-line & Multiline**: Dedicated support for single-line inputs and expansive textarea summary boxes.

### 4. Flawless Bangla (Bengali) & Complex Unicode Support
- **OpenType Complex Script Shaping**: Built specifically to avoid broken glyphs and disconnected letters in Indic scripts.
- **Full Support for**:
  - Bengali vowel signs (কার: া, ি, ী, ু, ূ, ৃ, ে, ৈ, ো, ৌ)
  - Consonant clusters and conjuncts (যুক্তাক্ষর: ক্ত, ক্ষ, জ্ঞ, ষ্ণ, ঙ্ক, ঙ্গ, ত্র, ক্র, ইত্যাদি)
  - Reph (রেফ র্ক) and Phala forms (য-ফলা, র-ফলা, ব-ফলা)
- **High-DPI Flattening Pipeline**: Renders shaped typography via high-resolution (300+ DPI) transparent canvas layers into `pdf-lib`, guaranteeing that the exported PDF looks identical to what is displayed on screen without fontkit anchor lookup crashes.
- **Font Management**:
  - Bundled with `Kalpurush`, `Noto Sans Bengali` (Regular & Bold), and standard English typography.
  - Custom font uploader supporting user TTF and OTF files.
  - Apply fonts per-field or globally across the document.

### 5. Checkbox Detection & Multi-State Interaction
- Automatic detection of checkbox widgets.
- 4-state click cycle:
  1. Check mark (**✓**)
  2. Cross mark (**✗**)
  3. Dot (**•**)
  4. Empty / Unchecked
- Manual checkbox creator to place and resize checkboxes anywhere on any page.

### 6. Clean Flattened PDF Export
- Generates clean, flattened PDFs preserving original dimensions, vector lines, and page quality.
- Unfilled/empty fields and all editing controls (handles, borders, selections) are completely stripped away.
- Flawless vector and high-DPI output with zero overlay artifacts.

---

## 🛠️ Technology Stack

- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide Icons
- **PDF Engine**: `pdfjs-dist` (rendering, thumbnails, AcroForms) & `pdf-lib` (document generation and flattening)
- **AI Inference Engine**: `onnxruntime-web` (WebGPU / WASM execution providers)
- **Concurrency**: Dedicated Web Worker (`detection.worker.ts`) for non-blocking neural inference

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/rmahbub01/fillora.git
cd fillora

# Install dependencies
npm install
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
npm run build
npm run preview
```

### Running Verification Tests

```bash
node tests/core-functionality.test.mjs
```

---

## 📋 Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Z` / `Cmd + Z` | Undo |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo |
| `Ctrl + L` / `Cmd + L` | Lock / Unlock selected field |
| `Tab` | Focus next field on current page |
| `Shift + Tab` | Focus previous field on current page |
| `Delete` / `Backspace` | Delete selected field |
| `Escape` | Deselect active field |

---

## 👨‍💻 Developer

**Fillora** is designed and developed by **[Mahbub Rahman](https://github.com/rmahbub01)**.

- **GitHub Profile**: [@rmahbub01](https://github.com/rmahbub01)
- **GitHub Repository**: [https://github.com/rmahbub01/fillora](https://github.com/rmahbub01/fillora)

---

## 📄 License

MIT License. Designed and engineered for privacy-conscious users worldwide.
