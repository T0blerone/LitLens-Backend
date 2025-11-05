import express from 'express';
import multer from 'multer';
import { model, modelName, apiKey } from '../lib/gemini.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage })

const PHOTO_PROMPT_TEMPLATE = `
You are an expert visual analysis AI and librarian. Your task is to analyze the provided image of a bookshelf, identify every visible book, and return the real results in a structured CSV format.
Instructions:
Analyze the Image: Scan the entire image and identify the bounding box for every visible book (spines or covers).
Extract Information: For each book, extract the following:
Title: The full title of the book.
Author: The name of the author(s).
Coordinates: The bounding box of the book.
Format Output: Return a single string in CSV (Comma Separated Values) format.
The first line must be the header row: title,author,coordinates
Each subsequent line must represent one book.
Formatting Rules:
Title/Author:
If the title or author is clearly visible, include it.
If the title or author is blurry, unreadable, or not visible, use the string Unknown.
Ensure that every book you list, is a real recognizable book. If it is not, rescan the book to extract the data.
Enclose titles and authors in double quotes ("") to handle any commas within them.
Coordinates:
First, find the precise pixel coordinates for the four corners of the book's visible edges (e.g., [x_tl, y_tl, x_tr, y_tr, x_br, y_br, x_bl, y_bl]).
Next, create a padded box by adding 10 pixels outside of each edge. For example, the new top-left x would be x_tl - 10 and the new top-left y would be y_tl - 10. The new bottom-right x would be x_br + 10 and y would be y_br + 10, and so on for all corners.
Format these four padded corner coordinates (Top-Left, Top-Right, Bottom-Right, Bottom-Left) as a JSON-style array string.
This entire coordinate string must be enclosed in double quotes in the CSV.
Example Output:
title,author,coordinates
"The Catcher in the Rye","J.D. Salinger","[90, 190, 140, 192, 141, 342, 91, 340]"
"To Kill a Mockingbird","Harper Lee","[145, 193, 195, 194, 196, 343, 146, 341]"
"Unknown","Unknown","[200, 195, 250, 195, 251, 344, 201, 344]"

Process the attached image and provide only the CSV-formatted string as your response.
`;

const PHOTO_SECOND_PROMPT = `
You are an expert in puzzles, and a librarian. Your task is to take a csv table of books in format (title, author, coordinates) and validate each book to make sure it is a real title. 
These were scanned off of the spine, so some may have an incorrect title or author entry. 
For each row, you are to pay attention to the title and author, and ignore the coordinates. 
You will see if the book exists as entered, if it does make sure the capitalization is correct and move on.
If it does not, determine what book was trying to be entered and update the csv.
Do not guess what a book is if you are missing the title or the author entirely.
Only guess what the book is if you have sufficient evidence from the input to make a good guess.
Your output will be only the csv, just corrected with any updates you made.
Here is the csv:
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

    const image_prompt = PHOTO_PROMPT_TEMPLATE;

    console.log(`Processing photo...`);
    
    const result = await model.generateContent({
      model: modelName,
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

    const validation_prompt = PHOTO_SECOND_PROMPT + csvData;

    /*
    const result2 = await model.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: validation_prompt },
          ]
        }
      ],
    });
    
    const new_csvData = result2.text*/


    console.log('Successfully processed photo.');
    res.status(200).json({ csv: csvData });

  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to process photo.' });
  }
});

export default router;