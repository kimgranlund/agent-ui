// weather.ts — LLD-C3 (SPEC-R16): the Open-Meteo manifest, migrated from the retired `integrations.ts`
// array. Keyless (`auth: 'none'`); geocode the place name, then read current conditions + a 3-day
// forecast, and return compact TEXT for the model (never a raw response dump). Registers itself on
// import — the barrel (`index.ts`) is what a host imports.

import { registerIntegration } from './registry.ts'
import type { ExecuteContext } from './registry.ts'
import { getJson } from './fetch-json.ts'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

registerIntegration({
  id: 'weather',
  version: '1.0.0',
  label: 'Weather (Open-Meteo)',
  description: 'Current conditions + short forecast for a named place. Keyless.',
  tool: {
    name: 'weather',
    description: 'Get current weather and a short forecast for a city or place name.',
    input_schema: {
      type: 'object',
      properties: { place: { type: 'string', description: 'City or place name, e.g. "Helsinki"' } },
      required: ['place'],
    },
  },
  auth: 'none',
  async execute(input, ctx: ExecuteContext) {
    const place = str(input.place).trim()
    if (place.length === 0) throw new Error('weather: `place` is required')
    const geo = (await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
      ctx.signal,
    )) as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> }
    const hit = geo.results?.[0]
    if (!hit) throw new Error(`weather: no place matched "${place}"`)
    const wx = (await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
        `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`,
      ctx.signal,
    )) as {
      current?: { temperature_2m?: number; apparent_temperature?: number; precipitation?: number; wind_speed_10m?: number }
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] }
    }
    const c = wx.current ?? {}
    const days = (wx.daily?.time ?? [])
      .map((d, i) => `${d}: ${wx.daily?.temperature_2m_min?.[i]}–${wx.daily?.temperature_2m_max?.[i]}°C, precip ${wx.daily?.precipitation_probability_max?.[i]}%`)
      .join('; ')
    return (
      `Weather for ${hit.name}${hit.country ? `, ${hit.country}` : ''}: now ${c.temperature_2m}°C ` +
      `(feels ${c.apparent_temperature}°C), wind ${c.wind_speed_10m} km/h, precipitation ${c.precipitation} mm. ` +
      `Next days — ${days}.`
    )
  },
})
