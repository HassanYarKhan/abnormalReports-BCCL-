import { Router } from "express";
import { getUnitFromAreaCode, getWBfromUnitCode } from "../controllers/wb.controller.js";
const weighbridgeRouter = Router();

weighbridgeRouter.get('/getUnitFromAreaCode', getUnitFromAreaCode);
weighbridgeRouter.get('/getWBfromUnitCode', getWBfromUnitCode);

export default weighbridgeRouter;