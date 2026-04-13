const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// CONNECT TO MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/user_db")
.then(() => console.log("Connected to User DB"))
.catch(err => console.log(err));

// USER SCHEMA
const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true },
    phone: String,
    role_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    created_at: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true }
});

// USER MODEL
const User = mongoose.model("User", userSchema);

//ROLES SCHEMA
const roleSchema = new mongoose.Schema({
    role_name: {
        type: String,
        required: true,
        unique: true
    },
    permissions: [{
        type: String,
        required: true
    }]
});

//ROLES MODEL
const Role = mongoose.model("Role", roleSchema);

// TEST ROUTE
app.get("/", (req, res) => {
    res.send("Server working");
});

// CREATE USER ROUTE (POST/users)
app.post("/users", async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ message: "User created successfully", data: newUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET ALL USERS (GET/users)
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE USER ROUTE (PUT/users/:id) - Added for Profile updates
app.put("/users/:id", async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true } // returns the modified document
        );
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User updated successfully", data: updatedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /user
app.delete("/users/:id", async (req, res) => {
    try {
        const deleted = await User.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



//CREATE ROLE (POST/roles)
app.post("/roles", async (req, res) => {
    try {
        const role = new Role(req.body);
        await role.save();
        res.json({ message: "Role created", data: role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET ROLES (GET/roles)
app.get("/roles", async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// START SERVER (ALWAYS LAST)
app.listen(3000, () => {
    console.log("User service running on port 3000");
});