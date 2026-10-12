// Reads text out of a photo (e.g. a referral sent on WhatsApp) — free, and the picture never leaves the device:
// the OCR engine runs inside the browser. The language files are served from this site and cached by the browser.

export const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif)$/i
export const isImageFile = (f: File) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name)

const LANG_PATH = '/tessdata'
const MAX_SIDE = 2400
const MIN_SIDE = 1400

/** scales a phone photo to a sensible size and turns it grayscale with a little contrast */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const long = Math.max(bmp.width, bmp.height)
  const scale = long > MAX_SIDE ? MAX_SIDE / long : long < MIN_SIDE ? Math.min(2, MIN_SIDE / long) : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    const c = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128))
    d[i] = d[i + 1] = d[i + 2] = c
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export async function ocrImage(file: File, onStatus?: (text: string) => void): Promise<string> {
  onStatus?.('מכין את התמונה…')
  const canvas = await prepare(file)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['heb', 'eng'], 1, {
    langPath: LANG_PATH,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onStatus?.(`קורא טקסט מהתמונה… ${Math.round(m.progress * 100)}%`)
      else if (m.status.includes('loading')) onStatus?.('טוען מנוע זיהוי טקסט (בפעם הראשונה לוקח קצת)…')
    },
  })
  try {
    const { data } = await worker.recognize(canvas)
    return data.text
  } finally {
    await worker.terminate()
  }
}
