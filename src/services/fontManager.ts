import { FontOption } from '../types/pdf';
import { sanitizeFontBuffer } from '../utils/fontSanitizer';

export const BUILT_IN_FONTS: FontOption[] = [
  {
    id: 'kalpurush',
    name: 'Kalpurush (Bangla Classic)',
    family: 'Kalpurush',
    isBangla: true,
    url: '/fonts/Kalpurush.ttf',
  },
  {
    id: 'nikosh',
    name: 'Nikosh (Bangla Official)',
    family: 'Nikosh',
    isBangla: true,
    url: '/fonts/Nikosh.ttf',
  },
  {
    id: 'noto-sans-bengali',
    name: 'Noto Sans Bengali',
    family: 'Noto Sans Bengali',
    isBangla: true,
    url: '/fonts/NotoSansBengali-Regular.ttf',
  },
  {
    id: 'inter',
    name: 'Inter (English Modern)',
    family: 'Inter, sans-serif',
    isBangla: false,
  },
  {
    id: 'helvetica',
    name: 'Helvetica / Arial',
    family: 'Helvetica, Arial, sans-serif',
    isBangla: false,
  },
  {
    id: 'times',
    name: 'Times New Roman (Serif)',
    family: '"Times New Roman", Times, serif',
    isBangla: false,
  },
  {
    id: 'courier',
    name: 'Courier (Monospace)',
    family: '"Courier New", Courier, monospace',
    isBangla: false,
  },
];

class FontManager {
  private customFonts: FontOption[] = [];
  private fontBuffers: Map<string, ArrayBuffer> = new Map();
  private loadedFaces: Set<string> = new Set();

  constructor() {
    // Fonts are loaded on-demand via CSS @font-face with font-display: swap
    // Zero blocking font downloads on startup
  }

  public async initBuiltInFonts(): Promise<void> {
    // Lazy, non-blocking font buffer preloader
  }

  public async loadCustomFont(file: File): Promise<FontOption> {
    const rawBuffer = await file.arrayBuffer();
    // Sanitize TrueType / OpenType binary buffer to fix broken / oversized metadata records (e.g. Nikosh.ttf)
    const buffer = sanitizeFontBuffer(rawBuffer);

    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const familyName = `Custom_${cleanName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
    
    // Test if font contains Bengali Unicode block
    const isBangla = cleanName.toLowerCase().includes('bangla') || 
                     cleanName.toLowerCase().includes('bengali') ||
                     cleanName.toLowerCase().includes('kalpurush') ||
                     cleanName.toLowerCase().includes('siam') ||
                     cleanName.toLowerCase().includes('solaiman') ||
                     cleanName.toLowerCase().includes('nikosh');

    const mimeType = file.name.toLowerCase().endsWith('.woff2')
      ? 'font/woff2'
      : file.name.toLowerCase().endsWith('.woff')
      ? 'font/woff'
      : file.name.toLowerCase().endsWith('.otf')
      ? 'font/otf'
      : 'font/ttf';

    let loaded = false;
    let loadError: unknown = null;

    // Strategy 1: FontFace with direct sanitized ArrayBuffer (fastest & most reliable across browsers)
    try {
      const fontFace = new FontFace(familyName, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);
      this.loadedFaces.add(familyName);
      loaded = true;
    } catch (e1) {
      loadError = e1;
      console.warn('FontFace ArrayBuffer load failed, trying typed Blob URL...', e1);
    }

    // Strategy 2: FontFace with explicitly typed Blob URL
    if (!loaded) {
      try {
        const blob = new Blob([buffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const fontFace = new FontFace(familyName, `url(${blobUrl})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        this.loadedFaces.add(familyName);
        loaded = true;
      } catch (e2) {
        loadError = e2;
        console.warn('FontFace Blob URL load failed, trying CSS @font-face Data URI...', e2);
      }
    }

    // Strategy 3: Dynamic CSS @font-face with Base64 Data URL
    if (!loaded) {
      try {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:${mimeType};charset=utf-8;base64,${base64}`;

        const style = document.createElement('style');
        style.textContent = `
          @font-face {
            font-family: "${familyName}";
            src: url("${dataUrl}");
            font-display: swap;
          }
        `;
        document.head.appendChild(style);
        await document.fonts.load(`16px "${familyName}"`);
        this.loadedFaces.add(familyName);
        loaded = true;
      } catch (e3) {
        loadError = e3;
      }
    }

    if (!loaded) {
      throw new Error(`Failed to load font "${file.name}": ${loadError instanceof Error ? loadError.message : 'Invalid font format'}`);
    }

    this.fontBuffers.set(familyName, buffer);

    const fontOption: FontOption = {
      id: familyName,
      name: `${cleanName} (Custom)`,
      family: familyName,
      isBangla,
      isCustom: true,
    };

    this.customFonts.push(fontOption);
    return fontOption;
  }

  public getAllFonts(): FontOption[] {
    return [...BUILT_IN_FONTS, ...this.customFonts];
  }

  public getFontBuffer(family: string): ArrayBuffer | undefined {
    return this.fontBuffers.get(family);
  }
}

export const fontManager = new FontManager();
