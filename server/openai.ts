import OpenAI from "openai";

// Using user's own OpenAI API key
// User will configure OPENAI_API_KEY environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-development",
});

export default openai;
