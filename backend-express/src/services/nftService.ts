import { ethers } from "ethers";


const ABI = [
  "function mintBatteryNFT(address to, string memory cid) public returns (uint256)",
  "function updateBatteryMetadata(uint256 tokenId, string memory cid) public",
  "function safeTransferFrom(address from, address to, uint256 tokenId) public",
  "function burn(uint256 tokenId) public",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function ownerOf(uint256 tokenId) public view returns (address)"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const wallet = new ethers.Wallet(
  process.env.MINTER_PRIVATE_KEY!,
  provider
);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS!,
  ABI,
  wallet
);

export async function mintBatteryNFT(
  batteryId: string,
  healthScore: number,
  cid: string,
  to: string
) {
  const tokenURI = `ipfs://${cid}`;

  const tx = await contract.mintBatteryNFT(
    to,
    batteryId,
    Math.floor(healthScore),
    "active",
    tokenURI
  );

  const receipt = await tx.wait();

  const tokenId = receipt.logs[0].args[2].toString();

  return {
    tokenId,
    txHash: receipt.hash
  };
}


export async function updateBatteryHealth(
  tokenId: string,
  newHealth: number
) {
  const tx = await contract.updateBatteryHealth(
    tokenId,
    Math.floor(newHealth)
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash
  };
}

export async function updateBatteryMetadata(
  tokenId: string,
  cid: string
) {
  const tx = await contract.updateBatteryMetadata(
    tokenId,
    cid
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function transferBatteryNFT(
  tokenId: string,
  from: string,
  to: string
) {
  const tx = await contract.safeTransferFrom(
    from,
    to,
    tokenId
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function burnBatteryNFT(
  tokenId: string
) {
  const tx = await contract.burn(
    tokenId
  );

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function getBatteryOnChain(
  tokenId: string
) {
  const uri = await contract.tokenURI(tokenId);
  const owner = await contract.ownerOf(tokenId);

  return {
    tokenId,
    tokenURI: uri,
    owner
  };
}
