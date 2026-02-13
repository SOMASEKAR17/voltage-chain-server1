import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
});

export const uploadJSONToIPFS = async (metadata: any): Promise<string> => {
  try {
    const upload = await pinata.upload.json(metadata);
    return upload.IpfsHash;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error("Failed to upload metadata to IPFS");
  }
};
