import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import path from "node:path";
import { registry } from "./registry.js";
import { generateObject, generateText } from "ai";
import { z } from "zod";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// A super simple ai example
app.post("/simple-ai-example", async (c) => {
  const response = await generateText({
    // Specify the model you want to use from the registry
    model: registry.default,

    // Set the temperature to 0 to have a more consistent behaviour of the LLM
    // If you want more randomness, you can incrase this (range: [0, 1])
    temperature: 0,

    // Pass it the history of the chat, this is the 'context window'
    messages: [
      {
        role: "user",
        content: "Oi mate!",
      },
    ],
  });

  return c.text(response.text);
});

app.post("/process", async (c) => {
  const pdfBuffer = readFileSync(
    path.join(process.cwd(), "/storage/contract.pdf"),
  );

  const response = await generateObject({
    model: registry.default,
    temperature: 0,

    // The system prompt goes here, this helps the LLM with understanding its task.
    system: `You are an AI assistant specialized in contract analysis. Your task is to carefully read the provided contract text and extract three specific pieces of information related to billing: the Billing Period, the Billing Term, and the Contract Amount (per period).

**Definitions:**

1.  **Billing Period:** This refers to the *frequency* with which a payment is due or occurs. Look for keywords indicating recurrence like "per month", "monthly", "annually", "yearly", "quarterly", "weekly", "one-time", "upon completion", etc.
    *   *Example:* In the phrase "The fee is \( \$500 \) per month for a duration of 12 months", the Billing Period is "monthly".
    *   *Example:* In "A one-time payment of \( \$10,000 \) is due upon signing", the Billing Period is "one-time".

2.  **Billing Term:** This refers to the *duration* of the commitment or the length of time the specified payment structure is in effect. Look for durations like "1 year", "24 months", "term of this agreement", "until cancelled", "month-to-month", "indefinite", "per project", etc.
    *   *Example:* In the phrase "The fee is \( \$500 \) per month for a duration of 12 months", the Billing Term is "12 months".
    *   *Example:* In "Service will continue on a month-to-month basis", the Billing Term is "month-to-month".

3.  **Contract Amount:** This refers to the *monetary value* that is due *per billing period*. Extract the specific amount and include the currency symbol if present. Do **not** calculate the total contract value over the entire term unless the payment is explicitly defined as a single, one-time amount.
    *   *Example:* In the phrase "The fee is \( \$500 \) per month for a duration of 12 months", the Contract Amount is "\( \$500 \)".
    *   *Example:* In "A one-time payment of \( \$10,000 \) is due upon signing", the Contract Amount is "\( \$10,000 \)".

**Instructions:**

*   Analyze the provided contract text carefully.
*   Identify the text segments that define the payment frequency, duration, and amount per period.
*   Extract these three pieces of information accurately.
*   If any piece of information is not explicitly stated or cannot be reasonably inferred from the text, use the value \`null\`.
*   Focus solely on these three defined data points. Do not extract other information unless it directly defines one of these three items.
*   Present the extracted information in a clear JSON format with the following keys: \`billingPeriod\`, \`billingTerm\`, \`contractAmount\`.

**Example Input Text:**

"This Service Agreement outlines a subscription fee of \( €99 \) per month, commencing on the Effective Date, for a minimum term of one (1) year. Payments are due on the first day of each calendar month."

**Example Output:**

\`\`\`json
{
  "billingPeriod": "monthly",
  "billingTerm": 12,
  "contractAmount": "€99"
}
\`\`\`
`,

    schema: z.object({
      billingTerm: z
        .number()
        .nullable()
        .describe("The duration of the contract in months."),
      billingPeriod: z
        .enum(["monthly", "quarterly", "yearly"])
        .nullable()
        .describe("The frequency of the payment."),
      contractAmount: z
        .string()
        .nullable()
        .describe("The agreed upon price, including the currency symbol."),
    }),

    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the key details from the following contract.",
          },
          {
            type: "file",
            data: pdfBuffer,
            mimeType: "application/pdf",
            filename: "contract.pdf",
          },
        ],
      },
    ],
  });

  return c.json(response.object);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
