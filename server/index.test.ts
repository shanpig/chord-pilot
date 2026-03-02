import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app, extractChord4ChordSheet } from './index'

describe('api health and analytics', () => {
  it('returns health payload', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('accepts analytics event', async () => {
    const response = await request(app)
      .post('/api/analytics/event')
      .send({ name: 'play_chord', value: 1 })
    expect(response.status).toBe(202)
    expect(response.body.accepted).toBe(true)
  })
})

describe('chord4 extractor', () => {
  it('extracts sectioned chord sheet block from chord4 html', () => {
    const html = `
      <html><body>
        <div>random navigation</div>
        <article>
          <h1>幸福在歌唱</h1>
          <p>[前奏]</p>
          <p>D C#m Bm E</p>
          <p>[主歌]</p>
          <p>A D</p>
          <p>如果有遠方 你就是方向</p>
          <p>[副歌]</p>
          <p>A C#m F#m Em A</p>
        </article>
        <div>### 和弦圖片</div>
      </body></html>
    `
    const extracted = extractChord4ChordSheet(html)
    expect(extracted).toContain('[前奏]')
    expect(extracted).toContain('[主歌]')
    expect(extracted).toContain('[副歌]')
    expect(extracted).not.toContain('### 和弦圖片')
  })

  it('filters common chord4 toolbox and recommendation noise lines', () => {
    const html = `
      <html><body>
        <div>
          [主歌]
          C G Am F
          這是歌詞第一行
          工具箱
          變調 ↑ ↓ 節拍器
          推薦吉他譜
          [副歌]
          F C Dm Bb
          這是副歌歌詞
        </div>
      </body></html>
    `
    const extracted = extractChord4ChordSheet(html)
    expect(extracted).toContain('[主歌]')
    expect(extracted).toContain('[副歌]')
    expect(extracted).toContain('這是歌詞第一行')
    expect(extracted).not.toContain('工具箱')
    expect(extracted).not.toContain('推薦吉他譜')
  })
})
