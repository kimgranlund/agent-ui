// @agent-ui/data/stream — ONE streaming contract (`Streamed<T>`, re-exported from core for
// convenience) + the bridge + three native adapters (SPEC §3.4).

export type { Streamed } from '../core/types.ts'
export type { Backpressure, PushToPullOptions, PushToPull } from './bridge.ts'
export { pushToPull } from './bridge.ts'
export { readNdjsonLines } from './ndjson-lines.ts'
export type { StreamFrame, SseEvent, FromFetchStreamInit } from './from-fetch-stream.ts'
export { fromFetchStream } from './from-fetch-stream.ts'
export type { FromEventSourceOptions } from './from-event-source.ts'
export { fromEventSource } from './from-event-source.ts'
export type { HeartbeatOptions, ReconnectOptions, FromWebSocketOptions, WebSocketStream } from './from-web-socket.ts'
export { fromWebSocket } from './from-web-socket.ts'
