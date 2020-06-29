import * as ethers from "ethers";
// import { getChainData } from "../helpers/utilities";
import { setLocal, getLocal } from "../helpers/local";
import {
  ENTROPY_KEY,
  MNEMONIC_KEY,
  DEFAULT_ACTIVE_INDEX,
  DEFAULT_CHAIN_ID,
} from "../constants/default";
import { getAppConfig } from "../config";
import * as Cfx from 'js-conflux-sdk/dist/js-conflux-sdk.umd.min.js';

class WalletCfx extends ethers.Wallet {
  public cfxAccount: any;
  public cfxAddr: string;
  public cfx: any;
}

export class WalletController {
  public path: string;
  public entropy: string;
  public mnemonic: string;
  public wallet: WalletCfx;

  public activeIndex: number = DEFAULT_ACTIVE_INDEX;
  public activeChainId: number = DEFAULT_CHAIN_ID;

  constructor() {
    this.path = this.getPath();
    this.entropy = this.getEntropy();
    this.mnemonic = this.getMnemonic();
    this.wallet = this.init();
  }

  public isActive() {
    if (!this.wallet) {
      return this.wallet;
    }
    return null;
  }

  public getIndex() {
    return this.activeIndex;
  }

  public getWallet(index?: number, chainId?: number): ethers.Wallet {
    if (!this.wallet || this.activeIndex === index || this.activeChainId === chainId) {
      return this.init(index, chainId);
    }
    return this.wallet;
  }

  public getAccounts(count = getAppConfig().numberOfAccounts) {
    const accounts = [];
    let wallet = null;
    for (let i = 0; i < count; i++) {
      wallet = this.generateWallet(i);
      accounts.push('0x' + wallet.cfxAddr);
    }
    return accounts;
  }

  public getData(key: string): string {
    let value = getLocal(key);
    if (!value) {
      switch (key) {
        case ENTROPY_KEY:
          value = this.generateEntropy();
          break;
        case MNEMONIC_KEY:
          value = this.generateMnemonic();
          break;
        default:
          throw new Error(`Unknown data key: ${key}`);
      }
      setLocal(key, value);
    }
    return value;
  }

  public getPath(index: number = this.activeIndex) {
    this.path = `${getAppConfig().derivationPath}/${index}`;
    return this.path;
  }

  public generateEntropy(): string {
    this.entropy = ethers.utils.hexlify(ethers.utils.randomBytes(16));
    return this.entropy;
  }

  public generateMnemonic() {
    this.mnemonic = ethers.utils.HDNode.entropyToMnemonic(this.getEntropy());
    return this.mnemonic;
  }

  public generateWallet(index: number) {
    // this.wallet = ethers.Wallet.fromMnemonic(this.getMnemonic(), this.getPath(index));
    const privateKey = '6D8B0B2E3700B904B3B63CF69B320E6575A06679281B62F1DF7B6AD17C3828E3';

    const privateKeyToAddress = Cfx.util.sign.privateKeyToAddress
    const privateKeyBuf = Buffer.from(privateKey.toLowerCase(), 'hex')
    const cfxAddress = privateKeyToAddress(privateKeyBuf).toString('hex');

    this.wallet = new WalletCfx(privateKey);
    this.wallet.cfxAddr = cfxAddress;
    this.wallet.cfxAccount = new Cfx.Account(privateKeyBuf);
    this.wallet.cfx = new Cfx.Conflux({
      url: window.location.origin + '/api',
    })

    // console.log(this.wallet)
    return this.wallet;
  }

  public getEntropy(): string {
    return this.getData(ENTROPY_KEY);
  }

  public getMnemonic(): string {
    return this.getData(MNEMONIC_KEY);
  }

  public init(index = DEFAULT_ACTIVE_INDEX, chainId = DEFAULT_CHAIN_ID) {
    return this.update(index, chainId);
  }

  public update(index: number, chainId: number) {
    this.activeIndex = index;
    this.activeChainId = chainId;
    // const rpcUrl = getChainData(chainId).rpc_url;
    this.wallet = this.generateWallet(index);
    // const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const newWallet = new WalletCfx(this.wallet.privateKey)
    // newWallet.cfxAccount = this.wallet.cfxAccount;
    // console.log(provider, 'provider', this.wallet)
    return newWallet;
  }

  public async sendTransaction(transaction: any) {
    if (this.wallet) {
      if (
        transaction.from &&
        transaction.from.toLowerCase() !== this.wallet.address.toLowerCase()
      ) {
        console.error("Transaction request From doesn't match active account");
      }

      if (transaction.from) {
        delete transaction.from;
      }

      // ethers.js expects gasLimit instead
      if ("gas" in transaction) {
        transaction.gasLimit = transaction.gas;
        delete transaction.gas;
      }

      const result = await this.wallet.sendTransaction(transaction);
      return result.hash;
    } else {
      console.error("No Active Account");
    }
    return null;
  }

  public async signTransaction(data: any) {
    if (this.wallet) {
      if (data && data.from) {
        delete data.from;
      }
      const result = await this.wallet.sign(data);
      return result;
    } else {
      console.error("No Active Account");
    }
    return null;
  }

  public async signMessage(data: any) {
    if (this.wallet) {
      const signingKey = new ethers.utils.SigningKey(this.wallet.privateKey);
      const sigParams = await signingKey.signDigest(ethers.utils.arrayify(data));
      const result = await ethers.utils.joinSignature(sigParams);
      return result;
    } else {
      console.error("No Active Account");
    }
    return null;
  }

  public async signPersonalMessage(message: any) {
    if (this.wallet) {
      const result = await this.wallet.signMessage(
        ethers.utils.isHexString(message) ? ethers.utils.arrayify(message) : message,
      );
      return result;
    } else {
      console.error("No Active Account");
    }
    return null;
  }
}
