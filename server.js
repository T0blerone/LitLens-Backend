import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

import generateRoutes from './routes/generate.js';
import processPhotoRoutes from './routes/processPhoto.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('LitLens Backend is running!');
});

app.use('/api/generate', generateRoutes);
app.use('/api/processphoto', processPhotoRoutes);

// To add an "analyze" service:
// 1. Create 'routes/analyze.js'
// 2. Import it: import analyzeRoutes from './routes/analyze.js';
// 3. Add it: app.use('/api/analyze', analyzeRoutes);
//

app.listen(port, host, () => {
  console.log(`LitLens backend server listening on http://${host}:${port}`);
});