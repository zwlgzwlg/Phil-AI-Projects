import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(__dirname));
app.listen(PORT, () => {
    console.log(`Philosopher running at http://localhost:${PORT}`);
});
