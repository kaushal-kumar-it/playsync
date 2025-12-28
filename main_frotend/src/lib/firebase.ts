"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBgln2p4eKBtTI0cuisqI8lNc_Mh4Ixg9A",
  authDomain: "playsync-a89e7.firebaseapp.com",
  projectId: "playsync-a89e7",
  appId: "1:692025017392:web:51dbf97c496de37dd059f5",
};

// ⛑ Prevent duplicate initialization
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
