import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const Plan = z.object({
  steps: z.array(z.string()).describe("5 to 8 small, concrete steps, each doable in one sitting of 25 to 90 minutes"),
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI breakdown isn't set up yet (no ANTHROPIC_API_KEY)." }, { status: 501 });
  }

  let body: { title?: string; course?: string; due?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const title = (body.title ?? "").slice(0, 300);
  if (!title) return Response.json({ error: "Missing title" }, { status: 400 });

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Plan) },
      system:
        "You help a university student who procrastinates and is behind on coursework. " +
        "Break a piece of coursework into small, concrete, unintimidating steps in the order they should be done. " +
        "The first step should take under 30 minutes and be very easy to start. Each step starts with a verb. Keep each under 12 words.",
      messages: [
        {
          role: "user",
          content: `Coursework: ${title}\nModule: ${body.course ?? "unknown"}\nDue: ${body.due ?? "unknown"}\nToday: ${new Date().toDateString()}\n${body.notes ? `Notes: ${body.notes.slice(0, 1000)}` : ""}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't break that one down. Try adding steps by hand." }, { status: 502 });
    }
    return Response.json({ steps: response.parsed_output.steps.slice(0, 10) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many requests right now. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `AI service error (${err.status ?? "network"})` }, { status: 502 });
    }
    throw err;
  }
}
