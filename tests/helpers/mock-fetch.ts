export function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

export function createTextResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: 500,
    headers: {
      "Content-Type": "text/plain",
    },
    ...init,
  });
}