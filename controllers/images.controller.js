import fs from "fs";
import path from "path";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8500";
const IMAGE_BASE_DIR = path.resolve(process.env.IMG_PATH);

async function getAbnormalWeighmentImg(req, res) {
  const { slNo, weightType } = req.query;

  if (!slNo || !weightType) {
    return res.status(400).json({
      success: false,
      message: "slNo and weightType are required"
    });
  }

  let expectedImages = [];

  switch (weightType) {
    case "Test":
      expectedImages = [`${slNo}.jpg`];
      break;
      
    case "Sending":
      expectedImages = [
        `${slNo}_sw1.jpg`,
        `${slNo}_sw2.jpg`,
        `${slNo}_sw3.jpg`,
        `${slNo}_sw4.jpg`,
        `${slNo}_sw_c0.jpg`,
        `${slNo}_sw_c1.jpg`
      ];
      break;

    case "Receiving":
      expectedImages = [
        `${slNo}_fw1.jpg`,
        `${slNo}_fw2.jpg`,
        // `${slNo}_fw3.jpg`,
        // `${slNo}_fw4.jpg`,
        `${slNo}_fw_c0.jpg`,
        `${slNo}_fw_c1.jpg`
      ];
      break;

    case "Dispatch":
      expectedImages = [
        `${slNo}_sw1.jpg`,
        `${slNo}_sw2.jpg`,
        `${slNo}_sw3.jpg`,
        `${slNo}_sw4.jpg`,
        `${slNo}_sw_c0.jpg`,
        `${slNo}_sw_c1.jpg`
      ];
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Invalid weight type"
      });
  }

  // check if file exists
  const imageUrls = expectedImages
    .filter(fileName =>
      fs.existsSync(path.join(IMAGE_BASE_DIR, fileName))
    )
    .map(fileName =>
      // `${SERVER_URL}/anprimages/wbdata/${fileName}`
      `${SERVER_URL}/images/${fileName}`
    );

  return res.status(200).json({
    slNo,
    weightType,
    success: true,
    imageCount: imageUrls.length,
    imageUrls
  });
}

export { getAbnormalWeighmentImg };
