import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import vehiclesRouter from "./routes/vehicles.routes.js";
import reportsRouter from "./routes/reports.routes.js";
import weighbridgeRouter from "./routes/wb.routes.js";
import summaryRouter from "./routes/summary.routes.js";
import DORouter from "./routes/do.routes.js";
import geofenceRouter from "./routes/geofences.routes.js";
import imagesRouter from "./routes/images.routes.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// Fix __dirname for ES modules   
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  credentials: true
}));

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/weighbridges", weighbridgeRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/do", DORouter);
app.use("/api/images", imagesRouter);
app.use("/api/geofences", geofenceRouter);

export default app;