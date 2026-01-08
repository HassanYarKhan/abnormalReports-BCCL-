import { Router } from "express";
import { getAbnormalWeighmentImg } from "../controllers/images.controller.js";

const imagesRouter = Router();

imagesRouter.get("/abnormalWeighmentImg", getAbnormalWeighmentImg);

export default imagesRouter;