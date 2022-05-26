const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const cors = require("cors");
const Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
require("dotenv").config();

// Define Port Number
const port = process.env.PORT || 8080;

// Use Cors and bodyParser
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  console.log(req.hostname);
  res.send("Hello World");
});

// MongoDB Connection
const uri = process.env.MONGODB_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
client.connect((err) => {
  console.log(
    `${!!err ? "Database Connection Failed" : "Database Connection Successful"}`
  );
  const productsCollection = client.db("Ronix").collection("products");
  const usersCollection = client.db("Ronix").collection("users");
  const ordersCollection = client.db("Ronix").collection("orders");

  // Create a new account
  app.post("/api/create-account", async (req, res) => {
    const { email, role, profile_picture } = req.body;
    const user = await usersCollection.findOne({ email });

    if (!user) {
      usersCollection.insertOne(
        {
          email: email.toLowerCase(),
          role: !role ? "user" : role.toLowerCase(),
          profile_picture,
        },
        (err, result) => {
          if (err) {
            res.status(500).send({
              status: 0,
              message: "Error Occured",
            });
          } else {
            res.status(201).send({
              status: 1,
              message: "Account Created Successfully",
            });
          }
        }
      );
    } else {
      res.status(400).send({
        status: 0,
        message: "Account Already Exists",
      });
    }
  });

  // Make Admin
  app.post("/api/promote-user", (req, res) => {
    const { email, role } = req.body;
    usersCollection.updateOne(
      { email },
      { $set: { role: !role ? "admin" : role.toLowerCase() } },
      (err, result) => {
        if (err) {
          res.status(500).send({
            status: 0,
            message: "Error Occured",
          });
        } else {
          res.status(201).send({
            status: 1,
            message: "User Promoted Successfully",
          });
        }
      }
    );
  });

  //  Get Single Product
  app.get("/api/product/:id", async (req, res) => {
    const { id } = req.params;
    const product = await productsCollection.findOne({ _id: ObjectID(id) });
    if (product) {
      res.status(200).send({
        status: 1,
        message: "Product Found",
        product,
      });
    } else {
      res.status(404).send({
        status: 0,
        message: "Product Not Found",
      });
    }
  });

  // Get All Products
  app.get("/api/products", async (req, res) => {
    const products = await productsCollection.find().toArray();
    res.status(200).send({
      status: 1,
      message: "Products Found",
      products,
    });
  });

  // Store Product
  app.post("/api/add-product", async (req, res) => {
    productsCollection.insertOne(req.body, (err, result) => {
      if (err) {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      } else {
        res.status(201).send({
          status: 1,
          message: "Product Added Successfully",
        });
      }
    });
  });

  // Update Product
  app.post("/api/update-product", async (req, res) => {
    const { id } = req.query;
    const product = await productsCollection.findOne({ _id: ObjectID(id) });
    if (product) {
      productsCollection.updateOne(
        { _id: ObjectID(id) },
        { $set: req.body },
        (err, result) => {
          if (err) {
            res.status(500).send({
              status: 0,
              message: "Error Occured",
            });
          } else {
            res.status(201).send({
              status: 1,
              message: "Product Updated Successfully",
            });
          }
        }
      );
    } else {
      res.status(404).send({
        status: 0,
        message: "Product Not Found",
      });
    }
  });

  // Delete Product
  app.post("/api/delete-product", async (req, res) => {
    const { id } = req.query;
    productsCollection.deleteOne({ _id: ObjectID(id) }, (err, result) => {
      if (err) {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      } else {
        res.status(201).send({
          status: 1,
          message: "Product Deleted Successfully",
        });
      }
    });
  });

  // Process Order
  app.post("/api/process-order", async (req, res) => {
    const { email, orders, total } = req.body;
    const storedOrders = await ordersCollection.insertOne({
      email,
      orders,
      status: "pending",
    });
    if (storedOrders) {
      const payment = await Stripe.paymentIntents.create({
        amount: total * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.status(201).send({
        status: 1,
        message: "Order Placed Successfully",
        client_secret: payment.client_secret,
        created: payment.created,
        amount: payment.amount,
        currency: payment.currency,
        orderId: storedOrders.insertedId,
      });
    } else {
      res.status(500).send({
        status: 0,
        message: "Error Occured",
      });
    }
  });

  // Update Order Status
  app.post("/api/update-order-status", async (req, res) => {
    const { email, status, id } = req.query;
    const updatedOrder = await ordersCollection.updateOne(
      { email, _id: ObjectID(id) },
      { $set: { status } }
    );
    if (updatedOrder) {
      res.status(201).send({
        status: 1,
        message: "Order Status Updated Successfully",
      });
    } else {
      res.status(500).send({
        status: 0,
        message: "Error Occured",
      });
    }
  });

  // Get All Orders
  app.get("/api/orders", async (req, res) => {
    const orders = await ordersCollection.find().toArray();
    res.status(200).send({
      status: 1,
      message: "Orders Found",
      orders,
    });
  });

  // Get Single Order
  app.get("/api/get-order", async (req, res) => {
    const { email } = req.query;
    const order = await ordersCollection.findOne({ email });
    if (order) {
      res.status(200).send({
        status: 1,
        message: "Order Found",
        order,
      });
    } else {
      res.status(404).send({
        status: 0,
        message: "Order Not Found",
      });
    }
  });

  // Delete Order
  app.post("/api/delete-order", async (req, res) => {
    const { id } = req.query;
    const order = await ordersCollection.findOne({ _id: ObjectID(id) });

    if (order.status === "paid") {
      res.status(400).send({
        status: 0,
        message: "Order Already Paid",
      });
    } else {
      const deletedOrder = await ordersCollection.deleteOne({
        _id: ObjectID(id),
      });
      if (deletedOrder) {
        res.status(201).send({
          status: 1,
          message: "Order Deleted Successfully",
        });
      } else {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      }
    }
  });
});

app.listen(port, () => {
  console.log(`App Listening at http://localhost:${port}`);
});
