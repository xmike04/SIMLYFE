/* global process */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : null;

if (!apiKey) {
    console.error("No API key found in .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const generationConfig = {
  temperature: 0.8,
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      description: { type: SchemaType.STRING },
      choices: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
             text: { type: SchemaType.STRING },
             effects: { type: SchemaType.OBJECT }
          }
        }
      }
    }
  }
};

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Generate an event for a 2 year old." }] }],
            generationConfig
        });
        console.log("SUCCESS:");
        console.log(result.response.text());
    } catch(e) {
        console.error("ERROR:");
        console.error(e);
        console.error(e.message);
    }
}
test();
