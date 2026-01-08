import { Router } from "express";
import { getDONumberFromUnitCode } from "../controllers/do.controller.js";

const DORouter = Router();

DORouter.get('/getDONumberFromUnitCode', getDONumberFromUnitCode);

export default DORouter;