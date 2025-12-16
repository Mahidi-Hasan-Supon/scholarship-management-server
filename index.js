const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
app.use(cors())
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
    await client.connect();

       const db = client.db('scholarship') 
       const scholarshipCollection = db.collection('scholarship-db')
       const reviewCollection = db.collection('review')

       app.get('/scholarship' , async(req,res)=>{
        const query = req.body
        const cursor = scholarshipCollection.find() 
        const result = await cursor.toArray() 
        res.send(result)
       })
      
      app.get('/scholarship/:id' , async(req,res)=>{
        const id = req.params.id
        const query = {_id:new ObjectId(id)}
        const result = await scholarshipCollection.findOne(query)
        res.send(result) 
      })

      app.get('/review/:scholarshipId' , async(req,res)=>{
        const scholarshipId = req.params.scholarshipId 
        const review = await reviewCollection
.find({ scholarshipId })
.toArray();
res.send(review);
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