import { Router } from "express";
import  getAllVehicles  from "../controllers/vehicles.controller.js";

const vehiclesRouter = Router();

vehiclesRouter.get("/getAllVehicles", getAllVehicles);

export default vehiclesRouter;
