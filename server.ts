import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// 1. Backend API Endpoint for Map Export & Direct File Download
app.post('/api/map/export', (req, res) => {
  try {
    const { mapName, terrainHeightOffsets, placedProps } = req.body;

    const exportData = {
      mapName: mapName || 'Solaria Custom Map',
      exportedAt: new Date().toISOString(),
      terrainHeightOffsets: terrainHeightOffsets || [],
      placedProps: placedProps || []
    };

    const fileName = `Solaria_Map_${Date.now()}.json`;

    // Set Download HTTP Headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export API error:', error);
    return res.status(500).json({ error: 'Failed to generate map download' });
  }
});

// 2. Backend API Endpoint for Map Import Validation
app.post('/api/map/import', (req, res) => {
  try {
    const mapData = req.body;
    if (!mapData || typeof mapData !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON map payload' });
    }

    return res.status(200).json({
      success: true,
      message: 'Peta kustom berhasil divalidasi oleh Server Backend API',
      data: mapData
    });
  } catch (error) {
    return res.status(400).json({ error: 'Failed to process JSON map data' });
  }
});

// Mount Vite middleware in dev or static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
