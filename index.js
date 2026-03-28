require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express()
app.use(cors(
{
  origin: [process.env.CLIENT_DOMAIN],
  credentials:true
  }
))
const port = process.env.PORT || 5000
app.use(express.json())


// firebase 
const admin = require("firebase-admin");

const serviceAccount = require("./student-scholarship-firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// firebase jwttoken 

const verifyFbToken =async (req,res,next)=>{
      console.log('headers in the middleware',req.headers.authorization);
      const token = req.headers.authorization
      if(!token){
        return res.status(401).send({message:'unauthorized message'})
      }
      try{
         const idToken = token.split(' ')[1] 
         const decoded = await admin.auth().verifyIdToken(idToken)
         console.log('decoded', decoded);
         req.decoded_email = decoded.email
         next()
      }catch(err) {
        return res.status(401).send({message:'unauthorized message'})
        
      }
}




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
       const usersCollection = db.collection('users');
       const applicationsCollection = db.collection('applications');

       

       // ===== USERS =====
      //       app.post('/users', async (req, res) => {
      //   const user = req.body;
      //    const exists = await users.findOne({ email: user.email });
      //   if (exists) return res.send({ message: 'user exists' });
      //    user.role = 'student';
      //      res.send(await users.insertOne(user));
      //   });
 // user update or post data
  app.post('/user', async(req,res)=>{
    const userData = req.body 

    // user role set
    userData.created_at = new Date().toISOString()
    userData.last_loggedIn = new Date().toISOString()
    // role inisially 
    userData.role = 'student'
    const query = {
      email: userData.email
    }
    // userexisting 
    const alreadyExisting = await usersCollection.findOne(query)
    console.log('user already exist' , !!alreadyExisting)
     if(alreadyExisting){
      console.log('uploading user data');
      const result = await usersCollection.updateOne(query,{$set:{
        last_loggedIn:new Date().toISOString()
      }})
      return res.send(result)
     }
     
     console.log('saving new user data');
    const result = await usersCollection.insertOne(userData)
    res.send(result)
  })

  // all users get in client
  // 1st sob gula users dekhanor jonno eta korsi
    app.get('/users' ,verifyFbToken , async(req , res)=>{
  
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


     // users role get
    // app.get('/users/role/:email', async (req, res) => {
    // const user = await usersCollection.findOne({ email: req.params.email });
    // res.send({ role: user?.role});
    //    });


      //  app.patch('/users/role/:id', async (req, res) => {
      //   const { role } = req.body;
      //     res.send(await users.updateOne(
      //       { _id: new ObjectId(req.params.id) },
      //    { $set: { role } }
      //        ));
      //             });




       // scholarship
       // ===scholarship====
    //  add scholarship
       app.post('/scholarship', async (req, res) => {
        const scholarshipData = req.body
        const result = await scholarshipCollection.insertOne(scholarshipData)
         res.send(result);
        });

// all scholarship
       app.get('/scholarship' , async(req,res)=>{
        const {limit , skip} = req.query
        const cursor = scholarshipCollection.find().limit(Number(limit)).skip(Number(skip)) 
        const result = await cursor.toArray() 
        const count =await scholarshipCollection.countDocuments()
        res.send({result  , count} )
       })
      // details scholarship
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
            images:[paymentInfo?.universityImage]
          },
          unit_amount:paymentInfo?.tuitionFees * 100,
        },
        quantity: 1,
      },
    ],
    customer_email:paymentInfo?.studentInfo.email,
    mode: 'payment',
    metadata:{
       scholarshipName: paymentInfo?.scholarshipName,
  universityName: paymentInfo?.universityName,
      scholarshipId:paymentInfo?.scholarshipId , 
       studentEmail: paymentInfo?.studentInfo.email,
    },
    success_url:`${process.env.CLIENT_DOMAIN}/success-payment?session_id={CHECKOUT_SESSION_ID}`,
    // cancel_url:`${process.env.CLIENT_DOMAIN}/cardDetails/${paymentInfo?.scholarshipId}`
    cancel_url:`${process.env.CLIENT_DOMAIN}/canceled-payment`

  });
  res.send({url:session.url})

});

app.post('/success-payment' , async (req,res)=>{
  const {sessionId} = req.body
   const session = await stripe.checkout.sessions.retrieve(sessionId);
   console.log('session retrieve',session);
  //  const scholarship = await scholarshipCollection.findOne({_id:new ObjectId(session.metadata.scholarshipId)})
   if(session.payment_status === 'paid'){
    // save applications data in db
    const applicationInfo = {
      universityName:session.metadata.universityName,
      scholarshipName:session.metadata.scholarshipName,
      scholarshipId:session.metadata.scholarshipId,
      amount:session.amount_total / 100 ,
      studentEmail:session.metadata.studentEmail,
      transactionId:session.payment_intent,
      payment_status:'paid',
      appliedAt:new Date()
    }
    await applicationsCollection.insertOne(applicationInfo)
   return res.send({success:true,data:applicationInfo})
    //  save scholarship data in db
    // const scholarshipInfo={
    //   scholarshipId:session.metadata.scholarshipId
    // }
  //   const id = session.metadata.scholarshipId
  //   const query = {_id:new ObjectId(id)}
  //   const update = {
  //     $set:{
  //       paymentStatus:'paid'
  //     }
  //   }
  //   const result = await scholarshipCollection.updateOne(query , update)
    
  //    save scholarship data in db
  //   const scholarshipInfo={
  //     scholarshipId:session.metadata.scholarshipId,
  //     transactionId: session.payment_intent ,
  //     customer: session.metadata.customer ,
  //     status: 'pending',
  //     // seller: plant.seller ,
  //     name: scholarshipInfo.name, 
  //     category:plant.category , 
  //     quantity: 1 ,
  //     price: session.amount_total / 100,
  //     image: plant?.image
  //   }
    
  //   res.send(result) 
  }

  return res.send({success:false})
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