import { fromExtendedKey, fromMnemonic } from "ethers/utils/hdnode";
import { IConnextClient, CF_PATH } from "@connext/types";
import * as connext from "@connext/client";

import { prettyPrint, verifyPayload, getChainData } from "../../helpers/utilities";
import { IAppState } from "../../App";
import { getAppControllers } from "src/controllers";

export let activeChannel: IConnextClient;

export async function createChannel(chainId: number) {
  const network = getChainData(chainId).network.toLowerCase();
  const hdNode = fromExtendedKey(
    fromMnemonic(getAppControllers().wallet.getMnemonic()).extendedKey,
  ).derivePath(CF_PATH);
  const xpub = hdNode.neuter().extendedKey;
  const keyGen = (index: string) => Promise.resolve(hdNode.derivePath(index).privateKey);
  const channel = await connext.connect(network, { xpub, keyGen });
  activeChannel = channel;
  return channel;
}

export async function onCreateChannelEvent(state: IAppState, setState: any) {
  const { chainId } = state;

  await setState({ loading: true });

  try {
    await createChannel(chainId);
  } catch (e) {
    console.error(e.toString());
    await setState({ loading: false });
    return;
  }

  await setState({ loading: false });
}

export async function handleChannelRequests(payload: any) {
  if (!activeChannel) {
    throw new Error("No Active Channel");
  }
  let result;
  try {
    verifyPayload(payload);
    result = await activeChannel.channelProvider.send(payload.method, payload.params);
  } catch (e) {
    console.error(`Unknown error: ${prettyPrint(e)}`);
  }
  return result;
}