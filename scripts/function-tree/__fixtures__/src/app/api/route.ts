import { createTransaction } from "../../server/actions.ts";

export async function GET(): Promise<Response> {
  const result = await createTransaction(100);
  return new Response(result);
}

export async function POST(): Promise<Response> {
  return new Response("ok");
}
