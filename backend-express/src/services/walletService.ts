import { Wallet } from "ethers";
import { encryptPrivateKey } from "../utils/encryption";

export function createCustodialWallet() {
  const wallet = Wallet.createRandom();

  const encrypted = encryptPrivateKey(wallet.privateKey);

  return {
    address: wallet.address,
    encryptedPrivateKey: encrypted
  };
}
