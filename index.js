const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))


// validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  console.log(authorization);
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


async function run() {
  try {

    const usersCollection = client.db('fluengodb').collection('users')
    const classesCollection = client.db('fluengodb').collection('classes')
    const selectClassCollection = client.db('fluengodb').collection('selectClass')
    const paymentCollection = client.db('fluengodb').collection('payments')


    // generate client secret
    app.post("/create-payment-intent", verifyJWT,  async (req, res) => {
      const {price} = req.body;
      if(price){
        const amount = parseFloat(price) * 100
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        })
        res.send({clientSecret: paymentIntent.client_secret})
      }
    });


    // Generate jwt token
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d'
      });
      res.send({token})
    })

    // warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'Admin'){
        return res.status(403).send({error: true, message:'forbidden access'})
      }
      next();
    }
    
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
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // Get user
    app.get('/users/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await usersCollection.findOne(query)
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
    
    // get popular  instructor
    app.get('/users/instructors/fixed', async(req, res) => {
      const query = {role: "Instructor"};
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    })

    // get popular  instructor
    app.get('/users/instructors/all', async(req, res) => {
      const query = {role: "Instructor"};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })


// class related API

// save class to db
app .post('/classes', verifyJWT, async(req, res) => {
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

// get a class from db
app.get('/classes/oneClass/:id', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await classesCollection.findOne(query);
  res.send(result);
})

// Get Popular Classes
app.get('/classes/approved/fixed', async(req, res) => {
  const query = {status: "Approved"}
  const result = await classesCollection.find(query).limit(6).toArray();
  res.send(result);
})
// Get all Classes
app.get('/classes/approved/all', async(req, res) => {
  const query = {status: "Approved"}
  const result = await classesCollection.find(query).toArray();
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
      status: "Denied",
      feedback: updatedStatus,
    }
  };
  const result = await classesCollection.updateOne(filter, updateDoc, options);
  res.send(result)
});

// update class
app.put('/classes/update/:id', async (req, res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const options = {upsert: true};
  const updatedClass = req.body;
  const updateDoc = {
    $set: {
      className: updatedClass.className,
      image: updatedClass.image,
      price: updatedClass.price,
      availableSeat: updatedClass.availableSeat,
      description: updatedClass.description,
      status: updatedClass.status,
    }
  };
  const result = await classesCollection.updateOne(filter, updateDoc, options);
  res.send(result)
});

// Get filter classes for instructor
app.get('/classes/instructor/:email', verifyJWT, async(req, res) => {
    const email = req.params.email;
    const query = {'instructorEmail': email}
    const result = await classesCollection.find(query).toArray()
    res.send(result);
})
// Get denied classes for instructor
app.get('/classes/denied/:email', verifyJWT, async(req, res) => {
    const email = req.params.email;
    const query = {'instructorEmail': email, 'status': 'Denied'}
    const result = await classesCollection.find(query).toArray()
    res.send(result);
})

// select related DB

// add select class to db
app .post('/classes/selected', async(req, res) => {
  const selected =req.body;
  const result = await selectClassCollection.insertOne(selected);
  res.send(result)
})

// Update class selected status
app.patch('/classes/selected/:email', async(req, res) => {
  const email = req.params.email;
  const query = {"student.email": email}
  const updateDoc = {
      $set: {
          place: "selected",
      }
  }
  const update = await selectClassCollection.updateOne(query, updateDoc)
  res.send(update);
})

// Get selected classes from db
app.get('/classes/selected', async(req, res) => {
  const email = req.query.email;
  if(!email){
    res.send([]);
  }
    const query = {"student.email": email}
    const result = await selectClassCollection.find(query).toArray();
    res.send(result);
});

// Get a selected class from db
app.get('/classes/selected/pay/:id', async(req, res) => {
  const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await selectClassCollection.findOne(query)
    res.send(result);
});

// delete a selected class from db
app.delete('/classes/selected/:id', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await selectClassCollection.deleteOne(query)
  res.send(result);
})


// payment related api
app.post('/payments', verifyJWT, async(req, res) => {
  const payment = req.body;
  const insertResult = await paymentCollection.insertOne(payment);
  const id = payment._id;
  console.log(id);
  const query = {_id: new ObjectId(id)};
  const deleteResult = await selectClassCollection.deleteOne(query);
  res.send({insertResult, deleteResult});
})

// get enrolled classes with payment history
app.get('/payments/:email', async(req, res) => {
  const email = req.params.email;
  const query = {"student.email": email}
  console.log(query)
  const result = await paymentCollection.find(query).toArray();
  res.send(result);

})

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