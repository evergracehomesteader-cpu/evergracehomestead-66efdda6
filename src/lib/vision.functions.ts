import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKETS = ["animal-photos", "barter-photos"] as const;

const InputSchema = z.object({
  bucket: z.enum(BUCKETS),
  path: z.string().min(1).max(500),
  kind: z.enum(["animal", "general"]).default("general"),
  hint: z.string().max(300).optional(),
});

const ANIMAL_PROMPT = `You are helping a homesteader describe an animal from a photo so they can identify that individual animal later.

Describe ONLY what is genuinely visible:
- likely species (only if reasonably confident; otherwise say the species is unclear)
- coat / plumage / hide colour and pattern
- distinctive markings (blazes, socks, spots, patches, ear tips, moonspots or roaning if visible)
- horns vs polled appearance, if visible
- ear type / carriage (erect, airplane, pendulous, lop), wattles, comb type, if visible
- eye colour only if clearly visible
- approximate age class (e.g. appears to be a juvenile or a mature adult) ONLY when the photo makes that visually reasonable
- body condition or obvious visible concerns (e.g. appears thin, visibly matted coat) ONLY with cautious wording, and never a diagnosis
- other distinctive visible traits useful for telling this animal apart

Do NOT state breed, sex, exact age, pregnancy, disease, identity, or lineage as fact from appearance. If something is only suggested, phrase it as a possibility ("appears to", "possibly") and make the uncertainty clear. Never invent details you cannot see. If the photo is too unclear to describe usefully, say so plainly instead of guessing.


Write 2-5 plain-language sentences. No headings, no bullet lists, no preamble.`;

const GENERAL_PROMPT = `You are helping a homesteader describe a photo attached to a farm record (feed, supplies, equipment, inventory, garden or plants, pens, buildings, receipts or labels, produce, etc.).

Describe what is actually visible and useful for record-keeping: what the item appears to be, quantity if countable, condition, colour, size cues, and setting. If readable text is visible and useful (brand, product name, weight, price, dates), include it verbatim — never guess at text you cannot read. Phrase uncertain observations as possibilities.

Write 2-5 plain-language sentences. No headings, no bullet lists, no preamble.`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const describePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "AI is not configured for this project yet." };
    }

    // Download via the caller's RLS-scoped client: a user can only read images
    // their homestead's storage policies allow.
    const { data: blob, error } = await context.supabase.storage
      .from(data.bucket)
      .download(data.path);
    if (error || !blob) {
      return { ok: false as const, error: "Could not read that photo (or you don't have access to it)." };
    }
    if (blob.size > 12_000_000) {
      return { ok: false as const, error: "That image is too large to analyze (max 12 MB)." };
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;

    const system = data.kind === "animal" ? ANIMAL_PROMPT : GENERAL_PROMPT;
    const userText = data.hint
      ? `Context from the record (may be wrong — trust the photo): ${data.hint}`
      : "Describe this photo.";

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.7-flash",
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
    } catch {
      return { ok: false as const, error: "Could not reach the AI service. Please try again." };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[describePhoto] gateway error", res.status, body);
      if (res.status === 429) return { ok: false as const, error: "Too many requests right now — try again in a moment." };
      if (res.status === 402) return { ok: false as const, error: "AI credits are exhausted for this workspace. Add credits to keep using AI descriptions." };
      if (res.status === 403) return { ok: false as const, error: "AI access is blocked for this workspace by an admin setting." };
      if (res.status === 401) return { ok: false as const, error: "AI is not configured correctly (invalid key)." };
      return { ok: false as const, error: "The AI service failed to analyze this photo." };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false as const, error: "The AI returned an empty description." };
    return { ok: true as const, description: text };
  });
