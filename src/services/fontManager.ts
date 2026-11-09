import { FontOption } from '../types/pdf';

export const BUILT_IN_FONTS: FontOption[] = [
  {
    id: 'kalpurush',
    name: 'Kalpurush (Bangla Classic)',
    family: 'Kalpurush',
    isBangla: true,
    url: '/fonts/Kalpurush.ttf',
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
    this.initBuiltInFonts();
  }

  public async initBuiltInFonts(): Promise<void> {
    for (const font of BUILT_IN_FONTS) {
      if (font.url && !this.loadedFaces.has(font.family)) {
        try {
          const resp = await fetch(font.url);
          if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            this.fontBuffers.set(font.family, buffer);
            const fontFace = new FontFace(font.family, buffer);
            await fontFace.load();
            document.fonts.add(fontFace);
            this.loadedFaces.add(font.family);
          }
        } catch (err) {
          console.warn(`Could not preload font ${font.name}:`, err);
        }
      }
    }
  }

  public async loadCustomFont(file: File): Promise<FontOption> {
    const buffer = await file.arrayBuffer();
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const familyName = `Custom_${cleanName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
    
    // Test if font contains Bengali Unicode block
    const isBangla = cleanName.toLowerCase().includes('bangla') || 
                     cleanName.toLowerCase().includes('bengali') ||
                     cleanName.toLowerCase().includes('kalpurush') ||
                     cleanName.toLowerCase().includes('siam') ||
                     cleanName.toLowerCase().includes('solaiman');

    const fontFace = new FontFace(familyName, buffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    this.loadedFaces.add(familyName);
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
