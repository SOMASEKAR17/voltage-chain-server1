import { ethers } from "ethers";


const ABI = [
  "function mintBatteryNFT(address to, string _batteryId, uint256 _healthScore, string _status, string _tokenURI)",
  "function updateBatteryHealth(uint256 tokenId, uint256 newHealth)",
  "function updateBatteryStatus(uint256 tokenId, string newStatus)",
  "function burnBatteryNFT(uint256 tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)"
];

let contract: ethers.Contract | null = null;


function getContract(): ethers.Contract {
  if (contract) return contract;

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL not found in environment variables");
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let privateKey = process.env.PRIVATE_KEY || process.env.MINTER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Private key not found in environment variables");
  }

  // Sanitize private key
  privateKey = privateKey.trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const wallet = new ethers.Wallet(
    privateKey,
    provider
  );

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS not found in environment variables");

  contract = new ethers.Contract(
    contractAddress,
    ABI,
    wallet
  );

  return contract;
}

export async function mintBatteryNFT(
  batteryId: string,
  healthScore: number,
  cid: string,
  to: string
) {
  const contract = getContract();
  const tokenURI = `ipfs://${cid}`;

  const tx = await contract.mintBatteryNFT(
    to,
    batteryId,
    Math.floor(healthScore),
    "active",
    tokenURI
  );

  const receipt = await tx.wait();

  let tokenId: string | null = null;

for (const log of receipt.logs) {
  try {
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === "Transfer") {
      tokenId = parsed.args.tokenId.toString();
      break;
    }
  } catch {}
}

if (!tokenId) {
  console.error("Logs parsing failed. Logs:", JSON.stringify(receipt.logs, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value // Handle BigInt serialization
  , 2));
  throw new Error("Mint succeeded but tokenId not found in logs");
}

  return {
    tokenId,
    txHash: receipt.hash
  };
}


export async function updateBatteryHealth(
  tokenId: string,
  newHealth: number
) {
  const contract = getContract();
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
  const contract = getContract();
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
  const contract = getContract();

  // 1. Verify ownership
  const currentOwner = await contract.ownerOf(tokenId);
  if (currentOwner.toLowerCase() !== from.toLowerCase()) {
    throw new Error(`Transfer failed: Address ${from} is not the owner of token ${tokenId}. Current owner is ${currentOwner}.`);
  }

  // 2. Verify that the wallet executing the transaction (msg.sender) is either the owner 
  //    or has been approved to transfer this token.
  //    In this setup, the server wallet is the signer.
  //    So, we need to check if serverWallet == currentOwner OR serverWallet is approved.
  
  // We can skip explicit approval check here if we assume the server wallet IS the owner, 
  // but if we are building a marketplace, the server might be an operator.
  // For now, let's just proceed with the transfer if the 'from' check passes.

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
  const contract = getContract();

  const tx = await contract.burnBatteryNFT(tokenId);

  const receipt = await tx.wait();

  return receipt.hash;
}

export async function getBatteryOnChain(
  tokenId: string
) {
  const contract = getContract();
  const uri = await contract.tokenURI(tokenId);
  const owner = await contract.ownerOf(tokenId);

  return {
    tokenId,
    tokenURI: uri,
    owner
  };
}

