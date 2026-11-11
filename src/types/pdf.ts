export type FieldType = 
  | 'text'
  | 'name'
  | 'address'
  | 'date'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'signature';

export type CheckboxState = 'empty' | 'check' | 'cross' | 'dot';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type ModelType = 'ffdnet-s' | 'ffdnet-l' | 'heuristic';
export type DetectionScope = 'current' | 'all';

export interface BoundingBox {
  // Coordinates normalized to [0, 1] relative to page dimensions
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormField {
  id: string;
  pageIndex: number; // 0-based
  type: FieldType;
  label?: string;
  box: BoundingBox; // Normalized 0..1
  
  // Text content & styling
  value: string;
  fontFamily: string;
  fontSize: number;
  autoFontSize: boolean;
  customFontSize?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color: string;
  hAlign: HorizontalAlign;
  vAlign: VerticalAlign;
  multiline: boolean;
  lineHeight?: number; // Line spacing multiplier in multi-line mode (default: 1.35)
  
  // Checkbox specific
  checkboxState: CheckboxState;
  
  // Interaction & Lock state
  locked: boolean;
  confidence?: number;
  source: 'ai' | 'acroform' | 'heuristic' | 'manual';
}

export interface PageInfo {
  pageNumber: number; // 1-based
  pageIndex: number;  // 0-based
  width: number;      // PDF points
  height: number;     // PDF points
  scale: number;
  aspectRatio: number;
}

export interface DetectionProgress {
  status: 'idle' | 'downloading' | 'loading' | 'detecting' | 'completed' | 'error';
  model: ModelType;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  message: string;
  error?: string;
}

export interface FontOption {
  id: string;
  name: string;
  family: string;
  isBangla: boolean;
  url?: string;
  isCustom?: boolean;
}

export interface HistoryState {
  fields: FormField[];
  selectedFieldId: string | null;
}
