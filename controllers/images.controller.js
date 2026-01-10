// CONSTANTS
const sasToken ="sp=r&st=2025-06-14T06:04:13Z&se=2029-06-14T14:04:13Z&sv=2024-11-04&sr=c&sig=Nc1NAZbfhxK9sYcAd%2BhVuwq1Ek%2B0rfeQ2ED%2FkkI5mD8%3D";
const blobBaseUrl =
  "https://cclrfidvts.blob.core.windows.net/weighment-images/";

async function getAbnormalWeighmentImg(req, res) {
  const slNo = req.query.slNo;
  const weightType = req.query.weightType;
  //console.log("Fetching images for weighment SL No:", slNo);
  //console.log("Weighment Type:", weightType);

  let imageUrls = [];

  switch (weightType) {
    case "Sending": {
      imageUrls = [
        `${blobBaseUrl}${slNo}_sw1.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw2.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw3.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw4.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw_c0.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw_c1.jpg?${sasToken}`
      ];
      break;
    }
    case "Receiving": {
      imageUrls = [
        `${blobBaseUrl}${slNo}_fw1.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_fw2.jpg?${sasToken}`,
        //  `${blobBaseUrl}${slNo}_fw3.jpg?${sasToken}`,
        // `${blobBaseUrl}${slNo}_fw4.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_fw_c0.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_fw_c1.jpg?${sasToken}`
      ];
      break;
    }
    case "Dispatch": {
      imageUrls = [
        `${blobBaseUrl}${slNo}_sw1.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw2.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw3.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw4.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw_c0.jpg?${sasToken}`,
        `${blobBaseUrl}${slNo}_sw_c1.jpg?${sasToken}`
      ];
      break;
    }
    default: {
      return res.status(400).json({ error: "Invalid weight type" });
    }
  }
  
  res.status(200).json({
    slNO: slNo,
    weightType: weightType,
    success: true,
    imageUrls
  });
}

export { getAbnormalWeighmentImg };
