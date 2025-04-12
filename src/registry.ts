import { openai } from "@ai-sdk/openai";
import dotenv from "dotenv";

// populate process.env with the variables of our .env file
dotenv.config();

/**
 * A registry of models, based on task.
 */
export const registry = {
  default: openai("gpt-4o"),
} as const; // as const tells typescript this won't change, so the type hinting can be more strict.
