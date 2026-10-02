// Reads a Server-Sent Events response body and passes each `data:` payload to onData.
// Network reads don't line up with SSE lines, so the incomplete trailing line of each
// read is kept until the rest of it arrives.

export const MAX_SSE_LINE_LENGTH = 1024 * 1024;

export async function readSSEData(body, onData) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (rawLine) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data && data !== "[DONE]") onData(data);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) handleLine(line);

      if (done) break;
      if (buffer.length > MAX_SSE_LINE_LENGTH) {
        throw new Error(`SSE line exceeds ${MAX_SSE_LINE_LENGTH} characters`);
      }
    }
    if (buffer) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }
}
