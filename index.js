require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express()
app.use(cors(
  {
    origin: [process.env.CLIENT_DOMAIN],
    credentials: true
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

const verifyFbToken = async (req, res, next) => {
  // console.log('headers in the middleware',req.headers.authorization);
  const token = req.headers.authorization
  if (!token) {
    return res.status(401).send({ message: 'unauthorized message' })
  }
  try {
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(idToken)
    console.log('decoded', decoded);
    req.decoded_email = decoded.email
    next()
  } catch (err) {
    return res.status(401).send({ message: 'unauthorized message' })

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
    const scholarshipCollection = db.collection('scholarships')
    const usersCollection = db.collection('users');
    const applicationsCollection = db.collection('applications');
    const reviewsCollection = db.collection('reviews')



    // ===== USERS =====
    //       app.post('/users', async (req, res) => {
    //   const user = req.body;
    //    const exists = await users.findOne({ email: user.email });
    //   if (exists) return res.send({ message: 'user exists' });
    //    user.role = 'student';
    //      res.send(await users.insertOne(user));
    //   });
    // user update or post data
    app.post('/user', async (req, res) => {
      const userData = req.body
      console.log(userData);
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
      console.log('user already exist', !!alreadyExisting)
      if (alreadyExisting) {
        console.log('uploading user data');
        const result = await usersCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString()
          }
        })
        return res.send(result)
      }

      console.log('saving new user data');
      const result = await usersCollection.insertOne(userData)
      res.send(result)
    })

    // all users get in client
    // 1st sob gula users dekhanor jonno eta korsi
    app.get('/users', async (req, res) => {

      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    // users role get
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email
      const user = await usersCollection.findOne({ email });
      // console.log({role:user?.role});
      res.send({ role: user?.role });

    });

    //  role update
    app.patch('/update-role', async (req, res) => {
      console.log(req.body);
      const {email, role } = req.body;
      const alreadyExist = await usersCollection.findOne({email})
      console.log(alreadyExist);
      const update =  { $set: {role}  }
      const result = await usersCollection.updateOne({email} , update)
      res.send(result)
    });

    //  delete manage users theke user er api 
    app.delete('/manage-user/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })


    // scholarship
    // ===scholarship====
    //  add scholarship
    app.post('/scholarship', async (req, res) => {
      const scholarshipData = req.body
      const result = await scholarshipCollection.insertOne(scholarshipData)
      res.send(result);
    });

    // all scholarship
    app.get('/scholarship', async (req, res) => {
      const { limit, skip } = req.query
      const cursor = scholarshipCollection.find().limit(Number(limit)).skip(Number(skip))
      const result = await cursor.toArray()
      const count = await scholarshipCollection.countDocuments()
      res.send({ result, count })
    })
    // details scholarship
    app.get('/scholarship/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await scholarshipCollection.findOne(query)
      res.send(result)
    })

    // manage scholarship 
    app.get('/manage-scholarship', verifyFbToken, async (req, res) => {
      const email = req.body
      const result = await scholarshipCollection.find().toArray()
      res.send(result)
    })
    // manage scholarship 
    app.patch('/scholarship/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updateData = req.body
      delete updateData._id
      const update = { $set: updateData }
      const result = await scholarshipCollection.updateOne(query, update)
      res.send(result)
    })
    // manage scholarship 
    app.delete('/scholarship/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await scholarshipCollection.deleteOne(query)
      res.send(result);
    });

    // paymentInfo stripe 
    app.post('/create-checkout-session', async (req, res) => {
      try {
        const paymentInfo = req.body
        console.log(paymentInfo)
        // res.send(paymentInfo)
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              // Provide the exact Price ID (for example, price_1234) of the product you want to sell
              price_data: {
                currency: 'usd',
                product_data: {
                  name: paymentInfo?.scholarshipName,
                  images: [paymentInfo?.universityImage]
                },
                unit_amount: paymentInfo?.applicationFees * 100,
              },
              quantity: 1,
            },
          ],
          customer_email: paymentInfo?.studentInfo.email,
          mode: 'payment',
          metadata: {
            scholarshipName: paymentInfo?.scholarshipName,
            universityName: paymentInfo?.universityName,
            scholarshipId: paymentInfo?.scholarshipId,
            studentEmail: paymentInfo?.studentInfo.email,
            studentName: paymentInfo?.studentInfo.name,
          },
          success_url: `${process.env.CLIENT_DOMAIN}/success-payment?session_id={CHECKOUT_SESSION_ID}`,
          // cancel_url:`${process.env.CLIENT_DOMAIN}/cardDetails/${paymentInfo?.scholarshipId}&scholarshipName=${paymentInfo?.scholarshipName}`
          // cancel_url:`${process.env.CLIENT_DOMAIN}/canceled-payment?scholarshipId=${paymentInfo?.scholarshipId}&scholarshipName=${paymentInfo?.scholarshipName}`
          cancel_url: `${process.env.CLIENT_DOMAIN}/canceled-payment?scholarshipId=${paymentInfo?.scholarshipId}`
        });
        res.send({ url: session.url })
      } catch (err) {
        return res.status(500).send({ message: 'error create an checkout session', err: err.message })
      }

    });

    app.post('/success-payment', async (req, res) => {
      const { sessionId } = req.body
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const scholarshipId = session.metadata.scholarshipId
      console.log('session retrieve', session);
      // console.log(scholarshipId);
      // console.log(session.metadata);
      const scholarship = await scholarshipCollection.findOne({ _id: new ObjectId(scholarshipId) })
      const user = await usersCollection.findOne({ email: session.metadata.studentEmail })
      const application = await applicationsCollection.findOne({
        scholarshipId,
        studentEmail: session.metadata.studentEmail
      })
      // console.log('application', application);

      if (session.payment_status === 'paid' && !application) {
        // save applications data in db
        const applicationInfo = {
          universityName: session.metadata.universityName,
          scholarshipName: session.metadata.scholarshipName,
          scholarshipId,
          userId: user?._id,
          amount: session.amount_total / 100,
          studentEmail: session.metadata.studentEmail,
          studentName: session.metadata.studentName,
          transactionId: session.payment_intent,
          scholarshipCategory: scholarship.scholarshipCategory,
          subjectCategory: scholarship.subjectCategory,
          universityCity: scholarship.universityCity,
          universityCountry: scholarship.universityCountry,
          degree: scholarship.degree,
          serviceCharge: scholarship.serviceCharge,
          applicationStatus: 'pending',
          payment_status: 'paid',
          appliedAt: new Date(),
          feedback: "",
        }

        //   feedback (added by moderator).
        await applicationsCollection.insertOne(applicationInfo)
        return res.send({ success: true, data: applicationInfo })

      }

      else if (session.payment_status === 'paid' && application) {
        const query = {
          scholarshipId,
          studentEmail: session.metadata.studentEmail
        };

        // console.log('rich here');
        const update = {
          $set: {
            payment_status: 'paid',
            transactionId: session.payment_intent,
            amount: session.amount_total / 100
          }
        };

        await applicationsCollection.updateOne(query, update);

        return res.send({ success: true });
      }

      return res.send({ success: false })
    })

    // payment failed
    app.post('/canceled-payment', async (req, res) => {

      const { scholarshipId, studentEmail, studentName, sessionId } = req.body
      const scholarship = await scholarshipCollection.findOne({ _id: new ObjectId(scholarshipId) })
      const user = await usersCollection.findOne({ email: studentEmail })
      const existing = await applicationsCollection.findOne({
        scholarshipId,
        studentEmail
      });
      // const application = await applicationsCollection.findOne({scholarshipId,studentEmail,payment_status:'unpaid',})
      if (!existing) {
        const applicationInfo = {
          universityName: scholarship?.universityName,
          scholarshipName: scholarship?.scholarshipName,
          studentName,
          studentEmail,
          scholarshipId,
          userId: user?._id,
          universityImage: scholarship.universityImage,
          scholarshipCategory: scholarship.scholarshipCategory,
          subjectCategory: scholarship.subjectCategory,
          universityCity: scholarship.universityCity,
          universityCountry: scholarship.universityCountry,
          degree: scholarship.degree,
          serviceCharge: scholarship.serviceCharge,
          amount: 0,
          applicationStatus: 'pending',
          payment_status: 'unpaid',
          appliedAt: new Date(),
          feedback: ""
        }


        await applicationsCollection.insertOne(applicationInfo)
      }
      res.send({ success: true, scholarshipName: scholarship?.scholarshipName })
    })




    // ===== APPLICATIONS =====
    //       app.post('/applications', async (req, res) => {
    //         const body = req.body
    //         const result = await applications.insertOne(body)
    //        res.send(result);
    //          });
    // applications get all 
    app.get('/applications', verifyFbToken, async (req, res) => {
      const result = await applicationsCollection.find().toArray()
      res.send(result);
    });

    // applications feedback patch
    app.patch('/applications/feedback/:id', verifyFbToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const { feedback } = req.body;
      const update = { $set: { feedback } }
      const result = await applicationsCollection.updateOne(query, update)
      res.send(result)
    })
    // applications status patch
    app.patch('/applications/status/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const { applicationStatus } = req.body;
      const update = { $set: { applicationStatus } }
      const result = await applicationsCollection.updateOne(
        query, update);
      res.send(result);
    });
    // applications get my applications er jonno
    app.get('/my-applications/:email', verifyFbToken, async (req, res) => {
      const email = req.decoded_email
      // console.log(email);
      const query = { studentEmail: email }
      // console.log(query);
      const result = await applicationsCollection.find(query).toArray()
      // same
      // const result = await applicationsCollection.find({studentEmail:req.decoded_email}).toArray()
      res.send(result)
    })
    // my applications e update er jonno
    app.patch('/my-applications/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updateData = req.body
      const update = { $set: updateData }
      const result = await applicationsCollection.updateOne(query, update)
      res.send(result)
    })
    //  my applications e delete 
    app.delete('/my-applications/:id', async (req, res) => {
      const id = req.params.id
      const email = req.decoded_email
      const query = { _id: new ObjectId(id) }
      const result = await applicationsCollection.deleteOne(query)
      res.send(result)
    })


    // reviews
    // all reviews dashboard
    app.get('/reviews', verifyFbToken, async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })
    // reviews post mongodb in my-application e
    app.post('/reviews', async (req, res) => {
      const review = req.body
      const existingReviews = await reviewsCollection.findOne({
        scholarshipId: review.scholarshipId,
        userEmail: review.userEmail
      })
      // console.log('existingReviews' , existingReviews);

      if (existingReviews) {
        return res.status(400).send({ message: "You already reviewed this scholarship" })
      }
      const result = await reviewsCollection.insertOne(review)
      res.send(result);
    });

    // reviews id get in all scholarship
    app.get('/reviews/:id', async (req, res) => {
      const id = req.params.id
      // const email = req.decoded_email;
      // console.log(email);
      // console.log(id);
      const query = { scholarshipId: id }
      // query.userEmail = email
      const result = await reviewsCollection.find(query).toArray()
      // console.log(result);
      res.send(result);
    });
    //  all reviews theke delete dashboard
    app.delete('/reviews/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await reviewsCollection.deleteOne(query)
      res.send(result)
    })
    // my reviews 
    app.get('/my-reviews', verifyFbToken, async (req, res) => {
      // const email =req.decoded_email 
      // const userEmail = {userEmail:email}
      const result = await reviewsCollection.find({ userEmail: req.decoded_email }).toArray()
      res.send(result)
    })
    //  my reviews e delete 
    app.delete('/my-reviews/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await reviewsCollection.deleteOne(query)
      res.send(result)
    })
    //  my reviews theke edit e click kore update api 
    app.patch('/my-reviews/:id', async (req, res) => {
      // const id = req.params.id 
      const { id } = req.params
      const body = req.body
      console.log(body);
      const query = { _id: new ObjectId(id) }
      const update = { $set: { ratings: body.ratings, review: body.review } }
      const result = await reviewsCollection.updateOne(query, update)
      res.send(result)
    })



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);








app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})