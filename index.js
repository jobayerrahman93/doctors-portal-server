const express = require('express')
const app = express();
const cors = require('cors');
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const fileUpload=require('express-fileupload');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());


// generate jwt firebase jwt token

const serviceAccount = require("./doctors-portal-52632-firebase-adminsdk-5jx0g-d132a87cc2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ipq6z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



async function verifyToken(req, res, next) {

  if (req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch {

    }
  }

  next();

}



async function run() {

  try {

    await client.connect();
    console.log("succefully connected to the database");

    const database = client.db("doctors_portal");
    const appointmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    const doctorsCollection = database.collection("doctors");


    // get appointment

    app.get("/appointments", verifyToken, async (req, res) => {

      const email = req.query.email;
      const date = req.query.date;
      // console.log(date);

      const query = { email: email, date: date };
      const cursor = appointmentsCollection.find(query);
      const result = await cursor.toArray();
      // console.log(result);
      res.json(result);
    });


    // get appointment for payment

    app.get("/payment/:id", async (req, res) => {

      const id = req.params.id;
      console.log("hitting payment");
      const query = { _id: ObjectId(id) };
      const result = await appointmentsCollection.findOne(query);
      res.json(result);


    })


    // appointment post api

    app.post("/appointments", async (req, res) => {

      const appointment = req.body;

      // console.log(appointment);

      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
      // console.log(result);

    });


    // user save in database

    app.post("/users", async (req, res) => {

      const user = req.body;

      // console.log(user);

      const result = await usersCollection.insertOne(user);
      res.json(result);
      // console.log(result);

    });


    // google sign in update user

    app.put("/users", async (req, res) => {

      const user = req.body;
      // console.log(user)

      const email = user.email;
      const displayName = user.displayName;

      const filter = { email: user.email };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          email, displayName
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
      // console.log(result);

    });

    // admin role

    app.put("/users/admin", verifyToken, async (req, res) => {

      const user = req.body;
      console.log("admin", user);
      console.log(req.headers.authorization);

      const requester = req.decodedEmail;

      if (requester) {
        const requesterAccount = await usersCollection.findOne({ email: requester });

        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: {
              role: "admin"
            }
          }
          const result = await usersCollection.updateOne(filter, updateDoc);
          console.log(result);
          res.json(result)
        }
        else {
          res.status(403).json({ message: 'you do not have access to make admin' })
        }
      }



    });

    // save database doctors

    app.post("/addDoctor",async(req,res)=>{
       
      const name= req.body.name;
      const email=req.body.email;
      const pic= req.files.image;
      
      const picData=pic.data;
      const encodedPic=picData.toString('base64');
      
      const imageBuffer= Buffer.from(encodedPic,'base64')

        const doctor={
          name,
          email,
          image:imageBuffer
        }

        const result=await doctorsCollection.insertOne(doctor);
console.log(result);

      res.json(result)
      
    });


    // get doctors
    app.get("/doctors",async(req,res)=>{

        const cursor = doctorsCollection.find({});
        const result = await cursor.toArray();
        res.json(result);
      
    })

    //  admin check

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query);

      let isAdmin = false;

      if (user?.role === "admin") {
        isAdmin = true;
      }
      console.log(isAdmin)
      res.json({ admin: isAdmin });

    });


    // payment api

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      console.log("hitting ");
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentInfo.price * 100,
        currency: "usd",
        payment_method_types: [
          "card"
        ],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    // save payment success info

    app.put("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const payment = req.body;
      const updateDoc = {
        $set: {
          payment: payment
        }
      }
      const result = await appointmentsCollection.updateOne(filter,updateDoc);
      res.json(result);

    })




  }

  finally {
    // await client.close();
  }

}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('doctors portal server is working')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})