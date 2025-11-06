import express from 'express';
import multer from 'multer';
import { model, apiKey } from '../lib/gemini.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage })

const VISION_PROMPT = `
You are an expert visual analysis AI. Your task is to analyze the provided image of a bookshelf, identify every visible book, and return the raw extracted data in a structured CSV format.
Instructions:
Analyze the Image: Scan the entire image and identify the bounding box for every visible book (spines or covers).
Extract Information: For each book, extract the following:
Title: The raw text of the book's title, exactly as it appears.
Author: The raw text of the author's name, exactly as it appears.
Coordinates: The normalized bounding box for the book spine [ymin, xmin, ymax, xmax].
Format Output: Return a single string in CSV (Comma Separated Values) format.
The first line must be the header row: title,author,coordinates
Each subsequent line must represent one book.
Formatting Rules:
Title/Author:
Transcribe the text for the title and author as accurately as possible, even if it is blurry, partially obscured, or appears misspelled.
Your goal is to extract the literal text you see, not to correct it or identify the real book. Output the "messed up" text exactly as you read it.
Only use the string Unknown as a last resort if a title or author is completely unreadable or not visible (e.g., a blank spine, a solid blur, facing away).
Enclose titles and authors in double quotes ("") to handle any commas within them.
Coordinates:
Provide the normalized bounding box [ymin, xmin, ymax, xmax].
All four values must be floats between 0.0 and 1.0.
This entire array string must be enclosed in double quotes in the CSV.
Example Output:
title,author,coordinates
"The Crtcher in the Tye","J.D. Salnger","[0.25, 0.10, 0.45, 0.15]"
"To Kill a Mockingbirdf","Hprper Lee","[0.25, 0.16, 0.45, 0.21]"
"Unknown","Unknown","[0.25, 0.22, 0.45, 0.27]"
Process the attached image and provide only the CSV-formatted string as your response.
`;

const VERIFICATION_PROMPT = `
You are an expert librarian and data verification AI. Your task is to clean and verify a CSV string of book data provided by an upstream OCR model. This raw data contains the model's best guess of the text, which may be misspelled, garbled, or partially correct.
You will receive a single CSV string as input. Your goal is to parse it, use your knowledge to identify the real book and author, and then output a new, cleaned CSV string in the exact same format.
Instructions:
Parse CSV: The input will be a CSV string with the header: title,author,coordinates.
Process Each Row:
Coordinates: Copy the coordinates value from the input to the output exactly as-is. Do not modify or analyze it.
Verification & Correction: Use your extensive knowledge of literature to identify the most likely real book and author based on the garbled text.
Correct obvious OCR errors and misspellings (e.g., "The Crtcher in the Tye" -> "The Catcher in the Rye"; "J.D. Salnger" -> "J.D. Salinger").
Fix errors where letters are mistaken for numbers or vice-versa (e.g., "1q84" -> "1Q84"; "Haruk1 Murakani" -> "Haruki Murakami").
If one field is 'Unknown' but the other is recognizable (e.g., Title: "Unknown", Author: "Steven Kng"), use the recognizable field to find the correct title or author.
If a field is literally "Unknown" and the other field provides no context, copy it as "Unknown".
If a field contains complete gibberish that cannot be plausibly corrected to a real title or author (e.g., "aj%@k*!"), output "Unknown" for that field.
If the capitalization is non-standard, normalize it (e.g., Title: "THE LONG WALK", Author: "Stephen King" -> Title: "The Long Walk", Author: "Stephen King").
Format Output:
Your entire response must be a single CSV-formatted string.
It must begin with the header row: title,author,coordinates
Enclose all fields (title, author, and coordinates) in double quotes ("").
Example Input:
title,author,coordinates
"The Crtcher in the Tye","J.D. Salnger","[0.25, 0.10, 0.45, 0.15]"
"1q84","Haruk1 Murakani","[0.25, 0.16, 0.45, 0.21]"
"Unknown","Steven Kng","[0.25, 0.22, 0.45, 0.27]"
"Moby Dck","Herman Melvlle","[0.25, 0.28, 0.45, 0.33]"
"The lluminatlons","Artbur Rimbaudl","[0.25, 0.34, 0.45, 0.39]"
"aj%@k*!","as dflkj","[0.25, 0.40, 0.45, 0.45]"

Example Output (Your Response):
title,author,coordinates
"The Catcher in the Rye","J.D. Salinger","[0.25, 0.10, 0.45, 0.15]"
"1Q84","Haruki Murakami","[0.25, 0.16, 0.45, 0.21]"
"The Shining","Stephen King","[0.25, 0.22, 0.45, 0.27]"
"Moby-Dick","Herman Melville","[0.25, 0.28, 0.45, 0.33]"
"Illuminations","Arthur Rimbaud","[0.25, 0.34, 0.45, 0.39]"
"Unknown","Unknown","[0.25, 0.40, 0.45, 0.45]"

Here is the csv input:
`;

router.post('/', upload.single('image'), async (req, res) => {
  console.log('Received request for /api/processphoto');

  if (!apiKey) {
    console.error('Missing API key. Cannot process request.');
    return res.status(500).json({ error: 'Server is missing API key configuration.' });
  }

  try {
    if (!req.file) {
      console.log('Request failed: No image file provided.');
      return res.status(400).json({ error: 'Please provide an image file to process.' });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const imageBase64 = imageBuffer.toString('base64');

    const image_prompt = VISION_PROMPT;

    console.log(`Processing photo...`);
    
    const result = await model.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          role: "user",
          parts: [
            { text: image_prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
    });

    const csvData = result.text;

    const verification_prompt = VERIFICATION_PROMPT + csvData;

    const result2 = await model.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          role: "user",
          parts: [
            { text: verification_prompt },
          ]
        }
      ],
    });
    
    const new_csvData = result2.text


    console.log('Successfully processed photo.');
    res.status(200).json({ csv: new_csvData });

  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to process photo.' });
  }
});

export default router;