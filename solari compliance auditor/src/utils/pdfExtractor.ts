import * as pdfjsLib from 'pdfjs-dist';
// Use local Vite-bundled worker asset URL for 100% air-gap compliance (zero external CDN dependencies)
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

interface ExtractedTextItem {
  str: string;
  tx: number;
  ty: number;
  width: number;
  height: number;
}

interface TextLine {
  ty: number;
  items: ExtractedTextItem[];
}

/**
 * Layout-aware spatial text reconstruction:
 * - Detects dual-column layouts and prevents interleaving column lines.
 * - Clusters text items into visual lines by vertical baseline matching.
 * - Sequences items horizontally by X-coordinate with boundary-aware spacing.
 * - Sorts lines from top to bottom and handles paragraph breaks and dehyphenation.
 */
function processPageItemsWithLayoutAwareness(items: any[], pageWidth: number): string {
  if (!items || items.length === 0) return '';

  const validItems: ExtractedTextItem[] = [];
  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const str = item.str;
    const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const tx = transform[4] ?? 0;
    const ty = transform[5] ?? 0;
    const width = typeof item.width === 'number' && item.width > 0 ? item.width : Math.max(str.length * 5.5, 6);
    const height = typeof item.height === 'number' && item.height > 0 ? item.height : 10;
    validItems.push({ str, tx, ty, width, height });
  }

  if (validItems.length === 0) return '';

  // Determine if multi-column layout is present
  const midX = pageWidth > 0 ? pageWidth / 2 : 306; // standard US Letter half-width
  let isMultiColumn = false;

  if (pageWidth > 320) {
    let itemsLeftOfMid = 0;
    let itemsRightOfMid = 0;
    let itemsCrossingMid = 0;

    for (const item of validItems) {
      if (item.tx + item.width < midX - 12) {
        itemsLeftOfMid++;
      } else if (item.tx > midX + 12) {
        itemsRightOfMid++;
      } else {
        itemsCrossingMid++;
      }
    }

    // Multi-column criteria: significant items on both flanks with a clear central gutter
    if (
      itemsLeftOfMid > 10 &&
      itemsRightOfMid > 10 &&
      itemsCrossingMid < (itemsLeftOfMid + itemsRightOfMid) * 0.18
    ) {
      isMultiColumn = true;
    }
  }

  const columns: ExtractedTextItem[][] = isMultiColumn
    ? [
        validItems.filter((i) => i.tx + i.width <= midX + 6),
        validItems.filter((i) => i.tx >= midX - 6),
      ]
    : [validItems];

  const columnTexts: string[] = [];

  for (const colItems of columns) {
    if (colItems.length === 0) continue;

    // Group items into visual lines by matching vertical baseline
    const lines: TextLine[] = [];
    const sortedByYDesc = [...colItems].sort((a, b) => b.ty - a.ty);

    for (const item of sortedByYDesc) {
      const tolerance = Math.max(item.height * 0.45, 3.5);
      const existingLine = lines.find((l) => Math.abs(l.ty - item.ty) <= tolerance);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ ty: item.ty, items: [item] });
      }
    }

    // Sort lines from top of page downwards
    lines.sort((a, b) => b.ty - a.ty);

    const lineStrings: string[] = [];
    let previousLineTy = lines[0]?.ty ?? 0;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // Sort items within each line horizontally
      line.items.sort((a, b) => a.tx - b.tx);

      let lineText = '';
      for (let ii = 0; ii < line.items.length; ii++) {
        const item = line.items[ii];
        if (ii === 0) {
          lineText += item.str;
        } else {
          const prevItem = line.items[ii - 1];
          const gap = item.tx - (prevItem.tx + prevItem.width);
          if (gap > 2 && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
            lineText += ' ';
          }
          lineText += item.str;
        }
      }

      // Detect paragraph separation via vertical drop
      const verticalGap = previousLineTy - line.ty;
      const isParagraphBreak = li > 0 && verticalGap > 18;

      if (isParagraphBreak && lineStrings.length > 0) {
        lineStrings.push('\n');
      }

      lineStrings.push(lineText.trim());
      previousLineTy = line.ty;
    }

    // Dehyphenate across linebreaks (e.g., "limi-\ntation" -> "limitation")
    let assembled = lineStrings.join('\n');
    assembled = assembled.replace(/(\b[a-zA-Z]{3,})-\n([a-z]{3,}\b)/g, '$1$2');
    columnTexts.push(assembled);
  }

  return columnTexts.join('\n\n');
}

/**
 * Extracts clean plaintext from a PDF File or ArrayBuffer with layout-aware spatial reconstruction.
 */
export async function extractTextFromPdf(fileOrBuffer: File | ArrayBuffer): Promise<string> {
  try {
    const arrayBuffer = fileOrBuffer instanceof File 
      ? await fileOrBuffer.arrayBuffer() 
      : fileOrBuffer;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let i = 1; i <= Math.min(numPages, 50); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      
      const pageStr = processPageItemsWithLayoutAwareness(textContent.items, viewport.width);
      if (pageStr.trim().length > 0) {
        pageTexts.push(pageStr);
      }
    }

    const fullText = pageTexts.join('\n\n');
    if (fullText.trim().length > 20) {
      return fullText;
    }
  } catch (err) {
    console.warn('[PDF Extractor] Layout-aware extraction notice:', err);
  }

  // Fallback: If pdfjs fails or if it was plain text masquerading as pdf
  if (fileOrBuffer instanceof File) {
    try {
      const fallbackText = await fileOrBuffer.text();
      // Filter out pure binary null bytes
      const cleanFallback = fallbackText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      if (cleanFallback.trim().length > 50) {
        return cleanFallback;
      }
    } catch {
      // ignore
    }
  }

  return '';
}
