import express from "express";
import type { Request, Response } from "express";
import connectDb from "./config/db";

const app = express();
app.use(express.json());

connectDb();

app.get("/", function(req: Request, res: Response) {
    console.log("welcome to the first get request");
    res.send("hello word");
}) 

app.listen(5000, () => {
    console.log("listenting on port 3000")
});