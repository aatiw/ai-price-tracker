import mongoose from "mongoose";
import "dotenv/config";


const connectDb = async(): Promise<void> => {
    try {
        const mongoUrl = process.env.MONGO_URI || "invalide";

        const conn = await mongoose.connect(mongoUrl);

        console.log(`MongoDb connection established on: ${conn.connection.host}`)
    } catch (error) {
        console.error("error establishing connection", error);
        process.exit(1);
    }
}

mongoose.connection.on("disconnect", () => {
    console.log("connection disconnected");
});

mongoose.connection.on("error", (error) => {
    console.log("there was an error with connection", error);
});

process.on('SIGINT', async () => {
    try {
        console.log("connection closed with mongo")
        process.exit(0);
    } catch (error) {
        console.log("error while shutting down connection", error);
        process.exit(1);
    }
})

export default connectDb;