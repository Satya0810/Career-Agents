import assert from 'assert';
import { readSSEData, MAX_SSE_LINE_LENGTH } from '../packages/ai-router/utils/sse-reader.js';

console.log('=== STARTING SSE STREAM TESTS ===');

const encoder = new TextEncoder();

// ReadableStream that delivers the given pieces (strings or bytes) as separate reads.
function streamOf(pieces) {
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) {
        controller.enqueue(typeof piece === 'string' ? encoder.encode(piece) : piece);
      }
      controller.close();
    }
  });
}

async function collect(pieces) {
  const payloads = [];
  await readSSEData(streamOf(pieces), (data) => payloads.push(data));
  return payloads;
}

// Split a string into reads at the given character offsets.
function splitAt(text, offsets) {
  const parts = [];
  let last = 0;
  for (const offset of offsets) {
    parts.push(text.slice(last, offset));
    last = offset;
  }
  parts.push(text.slice(last));
  return parts;
}

const chatDeltaEvent = (text) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const contentBlockEvent = (text) => `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`;
const chatDeltaText = (payloads) => payloads.map(p => JSON.parse(p).choices[0].delta.content).join('');
const contentBlockText = (payloads) => payloads.map(p => JSON.parse(p).delta.text).join('');

async function testJsonSplitAcrossReads() {
  const body = chatDeltaEvent('Hello') + chatDeltaEvent(' world') + 'data: [DONE]\n\n';
  const payloads = await collect(splitAt(body, [body.indexOf('Hel') + 3]));
  assert.strictEqual(payloads.length, 2);
  assert.strictEqual(chatDeltaText(payloads), 'Hello world');
  console.log('[PASS] JSON split across reads');
}

async function testLineSplitBeforeNewline() {
  const body = chatDeltaEvent('Hello') + chatDeltaEvent(' world');
  const newline = body.indexOf('\n');
  assert.strictEqual(chatDeltaText(await collect([body.slice(0, newline), body.slice(newline)])), 'Hello world');
  console.log('[PASS] SSE line split before its newline');
}

async function testMultipleEventsInOneRead() {
  const payloads = await collect([chatDeltaEvent('Hello') + chatDeltaEvent(' wor') + chatDeltaEvent('ld') + 'data: [DONE]\n\n']);
  assert.strictEqual(payloads.length, 3);
  assert.strictEqual(chatDeltaText(payloads), 'Hello world');
  console.log('[PASS] Multiple events in one read');
}

async function testCrlf() {
  const body = (chatDeltaEvent('Hello') + chatDeltaEvent(' world') + 'data: [DONE]\n\n').replace(/\n/g, '\r\n');
  const payloads = await collect(splitAt(body, [body.indexOf(' wor') + 4]));
  assert.strictEqual(chatDeltaText(payloads), 'Hello world');
  console.log('[PASS] CRLF line endings');
}

async function testFinalEventWithoutNewline() {
  const payloads = await collect([chatDeltaEvent('Hello'), chatDeltaEvent(' world').trimEnd()]);
  assert.strictEqual(chatDeltaText(payloads), 'Hello world');
  console.log('[PASS] Final event without trailing newline');
}

async function testDoneAndNonDataLines() {
  const body = ': keep-alive\n\nevent: ping\nid: 1\n\n' + chatDeltaEvent('Hello') + 'retry: 1000\n' + chatDeltaEvent(' world') + 'data: [DONE]\n\n';
  const payloads = await collect([body]);
  assert.ok(!payloads.includes('[DONE]'), '[DONE] should not be delivered');
  assert.strictEqual(chatDeltaText(payloads), 'Hello world');
  console.log('[PASS] [DONE], comments and other SSE fields are skipped');
}

async function testEveryFragmentBoundary() {
  const chatStream = chatDeltaEvent('Hello') + chatDeltaEvent(' world') + 'data: [DONE]\n\n';
  const blockStream = 'event: message_start\ndata: {"type":"message_start"}\n\n' + contentBlockEvent('Hello') + contentBlockEvent(' world');
  for (let i = 1; i < chatStream.length; i++) {
    assert.strictEqual(chatDeltaText(await collect(splitAt(chatStream, [i]))), 'Hello world', `choices[].delta stream split at ${i}`);
  }
  for (let i = 1; i < blockStream.length; i++) {
    const payloads = (await collect(splitAt(blockStream, [i]))).filter(p => JSON.parse(p).type === 'content_block_delta');
    assert.strictEqual(contentBlockText(payloads), 'Hello world', `content_block_delta stream split at ${i}`);
  }
  const bytes = encoder.encode(chatStream);
  const reads = [];
  for (let i = 0; i < bytes.length; i += 3) reads.push(bytes.slice(i, i + 3));
  assert.strictEqual(chatDeltaText(await collect(reads)), 'Hello world', '3-byte reads');
  console.log('[PASS] Every single split point and 3-byte reads (choices[].delta and content_block_delta formats)');
}

async function testMultibyteCharacterSplit() {
  const bytes = encoder.encode(chatDeltaEvent('Café ☕'));
  const cut = bytes.indexOf(0xe2) + 1; // inside the 3-byte encoding of the coffee cup
  const payloads = await collect([bytes.slice(0, cut), bytes.slice(cut)]);
  assert.strictEqual(chatDeltaText(payloads), 'Café ☕');
  console.log('[PASS] Multi-byte UTF-8 character split across reads');
}

async function testOversizedLineIsRejected() {
  const chunk = 'x'.repeat(64 * 1024);
  const pieces = ['data: '];
  for (let size = 0; size <= MAX_SSE_LINE_LENGTH; size += chunk.length) pieces.push(chunk);
  const stream = streamOf(pieces);
  await assert.rejects(readSSEData(stream, () => {}), /SSE line exceeds/);
  assert.strictEqual(stream.locked, false, 'Reader lock should be released after an error');
  console.log('[PASS] A line without a newline cannot grow past the limit');
}

try {
  await testJsonSplitAcrossReads();
  await testLineSplitBeforeNewline();
  await testMultipleEventsInOneRead();
  await testCrlf();
  await testFinalEventWithoutNewline();
  await testDoneAndNonDataLines();
  await testEveryFragmentBoundary();
  await testMultibyteCharacterSplit();
  await testOversizedLineIsRejected();
  console.log('=== ALL SSE STREAM TESTS PASSED ===\n');
  process.exit(0);
} catch (e) {
  console.error('SSE STREAM TEST FAILED:', e.message);
  process.exit(1);
}
