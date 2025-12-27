import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ObjectStorageClient, ConfigFileAuthenticationDetailsProvider } from "oci-sdk";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

const {
  PORT,
  REGION,
  NAMESPACE,
  BUCKET,
  CONFIG_FILE_PATH,
  CONFIG_PROFILE,
  PAR_URL
} = process.env;

// Oracle Auth provider
const provider = new ConfigFileAuthenticationDetailsProvider(CONFIG_FILE_PATH!, CONFIG_PROFILE!);
const client = new ObjectStorageClient({
  authenticationDetailsProvider: provider,
  regionId: REGION!
});

// Route to serve env variable to frontend
app.get("/api/config", (req, res) => {
  res.json({ parUrl: PAR_URL });
});

// Route to delete file
app.delete("/api/delete/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    await client.deleteObject({
      namespaceName: NAMESPACE!,
      bucketName: BUCKET!,
      objectName: filename
    });
    res.json({ success: true, message: `Deleted ${filename}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/", (req, res) => {
  res.send("Hello, World!");
});
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
console.log(`✅ Using bucket:`);
