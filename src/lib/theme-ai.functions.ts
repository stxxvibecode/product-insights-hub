import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ThemeSchema = z.object({
  preset: z.enum(["coral", "ink", "forest", "indigo", "rose", "solar"]).optional(),
  accent: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  background: z.enum(["solid", "gradient", "dots"]).optional(),
  font: z.enum(["sans", "serif", "mono", "soft"]).optional(),
  radius: z.enum(["sharp", "soft", "pill"]).optional(),
});

const SYSTEM = `You translate a short brand/style brief into a survey theme.
Return ONLY the structured fields. Map vibes to values:
- "warm/orange/coral" -> preset coral or accent #FF7A45
- "minimal/black/ivory" -> preset ink
- "fresh/green/calm" -> preset forest
- "tech/blue/studio" -> preset indigo
- "playful/pink" -> preset rose
- "bright/yellow/sunny" -> preset solar
- "rounded/soft" -> radius soft; "pill/bubbly" -> radius pill; "sharp/brutalist" -> radius sharp
- "gradient/glow" -> background gradient; "dotted/grid" -> background dots; otherwise solid
- "editorial/serif" -> font serif; "mono/code" -> font mono; "soft/friendly" -> font soft; default sans
If the user names a specific hex color, set accent to that hex (with leading #).
Only include fields you're confident about.`;

export const generateTheme = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string }) =>
    z.object({ prompt: z.string().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: ThemeSchema }),
      system: SYSTEM,
      prompt: data.prompt,
    });
    const theme = experimental_output as z.infer<typeof ThemeSchema>;
    if (theme.accent && !theme.accent.startsWith("#")) theme.accent = `#${theme.accent}`;
    return theme;
  });