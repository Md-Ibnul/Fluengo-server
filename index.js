const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3rhi256.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({error: true, message: 'Unauthorized'});
  }
  const token = authorization.split(' ')[1];

  // token verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({error: true, message: 'Unauthorized access'})
    }
    req.decoded = decoded
  })

  next();
}

async function run() {
  try {

    const usersCollection = client.db('fluengodb').collection('users')
    const classesCollection = client.db('fluengodb').collection('classes')
    const selectClassCollection = client.db('aircncDb').collection('selectClass')


    // Generate jwt token
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d'
      });
      res.send({token})
    })
    
// User related API
    // Save user Email and role im DB
    app.put('/users/:email', async(req, res) => {
        const email = req.params.email;
        const user = req.body;
        const query = {email: email}
        const options = {upsert: true}
        const updateDoc = {
            $set: user
        }
        const result = await usersCollection.updateOne(query, updateDoc, options)
        res.send(result);
    })

    // Get all users
    app.get('/users', verifyJWT, async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // make admin 
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'Admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // make Instructor 
    app.patch('/users/instructor/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'Instructor'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

     // check admin
     app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({Admin: false})
      }

      const query = {email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role == 'Admin'}
      res.send(result);
    })

     // check Instructor
     app.get('/users/instructor/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({instructor: false})
      }

      const query = {email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role == 'Instructor'}
      res.send(result);
    })
    

// class related API

// save class to db
app .post('/classes', async(req, res) => {
  const cls =req.body;
      if(!cls){
        return res.status(404).send({message: "Data not found, Not Valid Request."})
      }
  const result = await classesCollection.insertOne(cls)
  res.send(result)
})
// get all classes from db
app.get('/classes', async(req, res) => {
  const result = await classesCollection.find().toArray()
  res.send(result);
})

// approve class
app.patch('/classes/admin/:id', async(req, res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      status: 'Approved'
    }
  };
  const result = await classesCollection.updateOne(filter, updateDoc);
  res.send(result);
})

// Deny class with feedback
app.put('/classes/admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const options = {upsert: true};
  const updatedStatus = req.body;
  const updateDoc = {
    $set: {
      status: "Deny",
      feedback: updatedStatus,
    }
  };
  const result = await classesCollection.updateOne(filter, updateDoc, options);
  res.send(result)
});


    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Fluengo Server is running..')
})

app.listen(port, () => {
  console.log(`Fluengo is running on port: ${port}`)
})