import express from 'express';
import cors from 'cors';
import { saveUserIfNotExists } from './auth/saveUser';
import { verifyToken } from './auth/firebaseVerify';
const app=express();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => res.json({ ok: true }));
app.get("/me",verifyToken,async(req,res)=>{
    await saveUserIfNotExists(req.user);
    res.json({
        uid:req.user.uid,
        name:req.user.name,
        email:req.user.email,
    });
})
export default app;