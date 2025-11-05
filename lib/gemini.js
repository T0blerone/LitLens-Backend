import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not set.');
  process.exit(1);
}

const genAI = new GoogleGenAI({apiKey: apiKey});
const modelsService = genAI.models;
const modelName = 'gemini-2.5-flash-lite';

export { modelsService as model, modelName, apiKey };