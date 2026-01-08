import 'dotenv/config';
import app from './app.js';
import connectDB from './config/connectDB.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();
 
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
