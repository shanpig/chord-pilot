import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { load } from 'cheerio'
import Stripe from 'stripe'
import { parseChordText } from '../src/lib/chords'

const app = express()
const port = Number(process.env.PORT ?? 4173)
const stripeSecret = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecret ? new Stripe(stripeSecret) : null

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chordpilot-api',
    time: new Date().toISOString(),
  })
})

const CHORD4_HOST_PATTERNS = ['chord4.com', 'www.chord4.com']
const CHORD4_SECTION_REGEX = /\[(前奏|主歌|副歌|間奏|尾奏|Verse|Chorus|Bridge|Intro|Outro)\]/i
const CHORD4_STOP_LINE_REGEX =
  /(和弦圖片|工具箱|按歌手檢索|推薦吉他譜|您剛剛看過|也許喜歡|我来回应|請先登錄|添加到譜單|友情链接|免责声明|觀看視頻)/i
const CHORD4_NOISE_LINE_REGEX =
  /^(首頁|廣場|時刻|譜單|論壇區|收 藏|創建取消|取消 保存|註 冊|帳號|密碼|記住我|忘記密碼|滾動|變調|節拍器|字體|錄音|發音)\b/i

function isChord4Url(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    return CHORD4_HOST_PATTERNS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`))
  } catch {
    return false
  }
}

function normalizeChord4Text(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function scoreChord4Block(text: string): number {
  const sectionHeaders = text.match(/\[(前奏|主歌|副歌|間奏|尾奏|Verse|Chorus|Bridge|Intro|Outro)\]/gi)?.length ?? 0
  const chordLikeTokens = text.match(/\b[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\b/g)?.length ?? 0
  const lineCount = text.split('\n').length
  return sectionHeaders * 35 + chordLikeTokens * 2 + lineCount
}

function isLikelyChordLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  let chordLike = 0
  for (const token of tokens) {
    if (/^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?$/.test(token)) {
      chordLike += 1
    }
  }
  return chordLike >= 2 && chordLike / tokens.length >= 0.5
}

function sanitizeChord4Lines(text: string): string {
  const rawLines = text.split('\n').map((line) => line.trim())
  const kept: string[] = []
  let started = false

  for (const line of rawLines) {
    if (!line) {
      if (kept.length > 0 && kept[kept.length - 1] !== '') {
        kept.push('')
      }
      continue
    }

    if (!started) {
      if (CHORD4_SECTION_REGEX.test(line)) {
        started = true
      } else {
        continue
      }
    }

    if (CHORD4_STOP_LINE_REGEX.test(line)) {
      continue
    }
    if (CHORD4_NOISE_LINE_REGEX.test(line)) {
      continue
    }

    const isSection = CHORD4_SECTION_REGEX.test(line)
    const isChord = isLikelyChordLine(line)
    const isLyric =
      /[\u4e00-\u9fff]/.test(line) ||
      /[a-zA-Z]/.test(line)

    if (isSection || isChord || isLyric) {
      kept.push(line)
    }
  }

  return normalizeChord4Text(kept.join('\n'))
}

export function extractChord4ChordSheet(html: string): string {
  const $ = load(html)
  $('script, style, nav, footer, header, aside').remove()
  $('br').replaceWith('\n')

  const candidates: string[] = []
  $('main, article, section, pre, div').each((_, node) => {
    const text = $(node).text()
    if (!text) return
    const normalized = normalizeChord4Text(text)
    if (normalized.length < 120) return
    if (!CHORD4_SECTION_REGEX.test(normalized)) return
    candidates.push(normalized)
  })

  let best = candidates.sort((a, b) => scoreChord4Block(b) - scoreChord4Block(a))[0] ?? ''
  if (!best) {
    best = normalizeChord4Text($('body').text())
  }

  const startMarkerMatch = best.match(CHORD4_SECTION_REGEX)
  const startIndex = startMarkerMatch?.index ?? 0
  const selected = best.slice(startIndex)

  return sanitizeChord4Lines(selected)
}

function extractGenericChordText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped
}

app.post('/api/import/url', async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
  if (!url) {
    res.status(400).json({ message: 'Missing URL' })
    return
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChordPilotImporter/1.0)',
      },
    })
    if (!response.ok) {
      res.status(502).json({
        message: `Failed to fetch URL (${response.status})`,
      })
      return
    }
    const content = await response.text()
    const extracted = isChord4Url(url) ? extractChord4ChordSheet(content) : extractGenericChordText(content)
    const parsed = parseChordText(extracted)
    res.json(parsed)
  } catch (error) {
    res.status(500).json({
      message: 'Failed to import URL',
      error: (error as Error).message,
    })
  }
})

app.post('/api/analytics/event', (req, res) => {
  const event = req.body ?? {}
  console.info('[analytics]', event)
  res.status(202).json({ accepted: true })
})

app.post('/api/billing/checkout', async (req, res) => {
  const plan = typeof req.body?.plan === 'string' ? req.body.plan : 'pro-monthly'
  if (!stripe) {
    res.json({
      mode: 'mock',
      checkoutUrl: `https://example.com/mock-checkout?plan=${encodeURIComponent(plan)}`,
    })
    return
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'ChordPilot Pro',
            },
            recurring: { interval: 'month' },
            unit_amount: 1900,
          },
        },
      ],
    })
    res.json({ checkoutUrl: session.url })
  } catch (error) {
    res.status(500).json({
      message: 'Failed to create checkout session',
      error: (error as Error).message,
    })
  }
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.info(`ChordPilot API listening on port ${port}`)
  })
}

export { app }
