import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import * as Linking from "expo-linking";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { decryptPayload } from "./utils/decryptPayload";

const BASE_URL = "https://phantom.app/ul/v1/";

const onConnectRedirectLink = Linking.createURL("onConnect");

export default function App() {
  const [deeplink, setDeepLink] = useState<string>("");
  const [dappKeyPair] = useState(nacl.box.keyPair());

  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] =
    useState<PublicKey>();

  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };
    initializeDeeplinks();
    const listener = Linking.addEventListener("url", handleDeepLink);
    return () => {
      listener.remove();
    };
  }, []);

  const handleDeepLink = ({ url }: Linking.EventType) => setDeepLink(url);

  // Handle in-bound links
  useEffect(() => {
    if (!deeplink) return;

    const url = new URL(deeplink);
    const params = url.searchParams;

    if (params.get("errorCode")) {
      console.log(
        "error: ",
        JSON.stringify(Object.fromEntries([...params]), null, 2)
      );
      return;
    }

    // Handle a `connect` response from Phantom
    if (/onConnect/.test(url.pathname)) {
      console.log("we're connecting! deeplink: ", deeplink);

      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get("phantom_encryption_public_key")!),
        dappKeyPair.secretKey
      );

      const connectData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecretDapp
      );

      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));
    }
  }, [deeplink]);

  // Initiate a new connection to Phantom
  const connect = async () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: "devnet",
      app_url: "https://phantom.app",
      redirect_link: onConnectRedirectLink,
    });

    const myUrl = `${BASE_URL}connect?${params.toString()}`;

    Linking.openURL(myUrl);
  };

  return (
    <View style={styles.container}>
      <Text>Phantom Deeplinking Tutorial</Text>
      {phantomWalletPublicKey ? (
        <>
          <Text>Connected with:</Text>
          <Text>{phantomWalletPublicKey.toString()}</Text>
        </>
      ) : (
        <Button title="Connect" onPress={connect} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
