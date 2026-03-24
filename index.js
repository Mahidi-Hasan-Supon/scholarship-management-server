require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express()
app.use(cors(
{
  origin: [process.env.CLIENT_DOMAIN],
  }
))
const port = process.env.PORT || 5000
app.use(express.json())


app.get('/', (req, res) => {
  res.send('Hello World!')
})

// mongodb

// scholarship
// YwqrE54Qyib9Z3iX
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

       const db = client.db('scholarship') 
       const scholarshipCollection = db.collection('scholarship-db')
      //  const reviewCollection = db.collection('reviews')
      //  const users = db.collection('users');
      //  const applications = db.collection('applications');

       

       // ===== USERS =====
      //       app.post('/users', async (req, res) => {
      //   const user = req.body;
      //    const exists = await users.findOne({ email: user.email });
      //   if (exists) return res.send({ message: 'user exists' });
      //    user.role = 'student';
      //      res.send(await users.insertOne(user));
      //   });


      //      app.get('/users/role/:email', async (req, res) => {
      //     const user = await users.findOne({ email: req.params.email });
      //       res.send({ role: user?.role || 'student' });
      //         });


      //  app.patch('/users/role/:id', async (req, res) => {
      //   const { role } = req.body;
      //     res.send(await users.updateOne(
      //       { _id: new ObjectId(req.params.id) },
      //    { $set: { role } }
      //        ));
      //             });




       // scholarship
       // ===scholarship====

       app.post('/scholarship', async (req, res) => {
        const scholarshipData = req.body
        const result = await scholarshipCollection.insertOne(scholarshipData)
         res.send(result);
        });


       app.get('/scholarship' , async(req,res)=>{
        const {limit , skip} = req.query
        const cursor = scholarshipCollection.find().limit(Number(limit)).skip(Number(skip)) 
        const result = await cursor.toArray() 
        const count =await scholarshipCollection.countDocuments()
        res.send({result  , count} )
       })
      
      app.get('/scholarship/:id' , async(req,res)=>{
        const id = req.params.id
        const query = {_id:new ObjectId(id)}
        const result = await scholarshipCollection.findOne(query)
        res.send(result) 
      })

    //   app.delete('/scholarship/:id', async (req, res) => {
    //     const id = req.params.id
    //     const query = {_id: new ObjectId(id)}
    //     const result = await scholarships.deleteOne(query)
    //     res.send(result);
    // });

// paymentInfo stripe 
app.post('/create-checkout-session', async (req, res) => {
  const paymentInfo = req.body
  console.log(paymentInfo)
  // res.send(paymentInfo)
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
        price_data: {
          currency:'usd',
          product_data:{
            name:paymentInfo?.scholarshipName,
            description:paymentInfo?.description,
            images:[paymentInfo?.universityImage]
          },
          unit_amount:paymentInfo?.applicationFee * 100,
        },
        quantity: 1,
      },
    ],
    customer_email:paymentInfo?.studentInfo.email,
    mode: 'payment',
    metadata:{
      scholarshipId:paymentInfo?.scholarshipId , 
       studentEmail: paymentInfo.studentInfo.email,
    },
    success_url:`${process.env.CLIENT_DOMAIN}/success-payment?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${process.env.CLIENT_DOMAIN}/cardDetails/${paymentInfo?.scholarshipId}`

  });
  res.send({url:session.url})

});

app.post('/success-payment' , async (req,res)=>{
  const {sessionId} = req.body
   const session = await stripe.checkout.sessions.retrieve(sessionId);
   console.log(session);
   const scholarship = await scholarshipCollection.findOne({_id:new ObjectId(session.metadata.scholarshipId)})
   if(session.status === 'complete'){
    //  save scholarship data in db
    const scholarshipInfo={
      scholarshipId:session.metadata.scholarshipId
    }
   }
})







    // ===== APPLICATIONS =====
//       app.post('/applications', async (req, res) => {
//         const body = req.body
//         const result = await applications.insertOne(body)
//        res.send(result);
//          });


//       app.get('/applications', async (req, res) => {
//         const result = await applications.find().toArray()
//         res.send(result);
//          });


//         app.get('/applications/user/:email', async (req, res) => {
//         res.send(await applications.find({ userEmail: req.params.email }).toArray());
//           });


//           app.patch('/applications/status/:id', async (req, res) => {
//       const { status } = req.body;
//         res.send(await applications.updateOne(
//          { _id: new ObjectId(req.params.id) },
//        { $set: { status } }
//         ));
//         });

//    app.patch('/applications/status/:id', async (req, res) => {
// const { status } = req.body;
// const result = await applications.updateOne(
// { _id: new ObjectId(req.params.id) },
// { $set: { status } }
// );
// res.send(result);
// });



      // reviews
    //   app.get('/reviews/:scholarshipId' , async(req,res)=>{
    //     const scholarshipId = req.params.scholarshipId 
    //     const review = await reviewCollection
    //  .find({ scholarshipId })
    //   .toArray();
    //   res.send(review);
    //   })
    // app.post('/reviews', async (req, res) => {
    //   const body = req.body 
    //   const result = await reviewCollection.insertOne(body)
    //   res.send(result);
    //     });


    //  app.get('/reviews/:email', async (req, res) => {
    //    res.send(await reviews.find({ userEmail: req.params.email }).toArray());
    //      });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);








app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})