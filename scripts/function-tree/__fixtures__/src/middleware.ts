// Top-level middleware — Next.js convention. Sits directly under src/.

export function middleware(req: Request): Response {
  return new Response(req.url);
}
